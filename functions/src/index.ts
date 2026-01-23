import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { WebClient } from '@slack/web-api';
import axios from 'axios';

admin.initializeApp();

const db = admin.firestore();

interface MessageRecipient {
  type: 'channel' | 'user' | 'email';
  id?: string;
  name: string;
  email?: string;
}

interface SenderConfig {
  type: 'bot' | 'user';
  userId?: string;
  userName?: string;
}

interface SendMessageData {
  workspaceId: string;
  content: string;
  blocks?: any[];
  recipients: MessageRecipient[];
  sender: SenderConfig;
  templateId?: string;
  scheduledMessageId?: string;
}

/**
 * Send a Slack message
 */
export const sendSlackMessage = functions.https.onCall(
  async (data: SendMessageData, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    try {
      const { workspaceId, content, blocks, recipients, sender, templateId, scheduledMessageId } = data;

      // Get workspace
      const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
      if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found');
      }

      const workspace = workspaceDoc.data();
      if (!workspace) {
        throw new functions.https.HttpsError('not-found', 'Workspace data not found');
      }

      // Determine which token to use
      let token: string | undefined;

      if (sender.type === 'user' && sender.userId) {
        const userToken = workspace.userTokens?.find(
          (t: any) => t.id === sender.userId
        );
        if (!userToken) {
          throw new functions.https.HttpsError(
            'not-found',
            'User token not found'
          );
        }
        token = userToken.token;
      } else {
        token = workspace.botToken;
      }

      if (!token) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No token available for sending messages'
        );
      }

      // Initialize Slack client
      const slackClient = new WebClient(token);

      // Send to each recipient
      const results = [];
      for (const recipient of recipients) {
        let channel = recipient.id || recipient.name;

        // If recipient is email, try to lookup user ID
        if (recipient.type === 'email' && recipient.email) {
          try {
            const userLookup = await slackClient.users.lookupByEmail({
              email: recipient.email,
            });
            if (userLookup.user?.id) {
              channel = userLookup.user.id;
            }
          } catch (error) {
            console.error('Error looking up user by email:', error);
          }
        }

        // Send message
        try {
          const messagePayload: any = {
            channel,
            text: content,
          };

          if (blocks && blocks.length > 0) {
            messagePayload.blocks = blocks;
          }

          const result = await slackClient.chat.postMessage(messagePayload);
          results.push({ recipient, success: true, result });

          // Log to history
          await db.collection('message_history').add({
            workspaceId,
            scheduledMessageId,
            templateId,
            content,
            blocks,
            recipients: [recipient],
            sender,
            sentAt: admin.firestore.Timestamp.now(),
            sentBy: context.auth.uid,
            status: 'sent',
            slackResponse: result,
          });
        } catch (error: any) {
          console.error('Error sending to recipient:', error);
          results.push({ recipient, success: false, error: error.message });

          // Log failed attempt
          await db.collection('message_history').add({
            workspaceId,
            scheduledMessageId,
            templateId,
            content,
            blocks,
            recipients: [recipient],
            sender,
            sentAt: admin.firestore.Timestamp.now(),
            sentBy: context.auth.uid,
            status: 'failed',
            errorMessage: error.message,
          });
        }
      }

      return { success: true, results };
    } catch (error: any) {
      console.error('Error in sendSlackMessage:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Get Slack channels for a workspace
 */
export const getSlackChannels = functions.https.onCall(
  async (data: { workspaceId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    try {
      const { workspaceId } = data;

      const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
      if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found');
      }

      const workspace = workspaceDoc.data();
      const token = workspace?.botToken || workspace?.userTokens?.[0]?.token;

      if (!token) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No token available'
        );
      }

      const slackClient = new WebClient(token);
      const result = await slackClient.conversations.list({
        types: 'public_channel,private_channel',
        limit: 200,
      });

      return {
        channels: result.channels?.map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          isPrivate: ch.is_private,
          isMember: ch.is_member,
        })),
      };
    } catch (error: any) {
      console.error('Error getting channels:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Get Slack users for a workspace
 */
export const getSlackUsers = functions.https.onCall(
  async (data: { workspaceId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    try {
      const { workspaceId } = data;

      const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
      if (!workspaceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workspace not found');
      }

      const workspace = workspaceDoc.data();
      const token = workspace?.botToken || workspace?.userTokens?.[0]?.token;

      if (!token) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No token available'
        );
      }

      const slackClient = new WebClient(token);
      const result = await slackClient.users.list();

      return {
        users: result.members?.map((user: any) => ({
          id: user.id,
          name: user.name,
          realName: user.real_name,
          email: user.profile?.email,
          isBot: user.is_bot,
          profileImage: user.profile?.image_72,
        })).filter((u: any) => !u.isBot),
      };
    } catch (error: any) {
      console.error('Error getting users:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Get HubSpot contact data
 */
export const getHubSpotContact = functions.https.onCall(
  async (
    data: { connectionId: string; contactId?: string; email?: string },
    context
  ) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    try {
      const { connectionId, contactId, email } = data;

      // Get HubSpot connection
      const connectionDoc = await db
        .collection('hubspot_connections')
        .doc(connectionId)
        .get();

      if (!connectionDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'HubSpot connection not found'
        );
      }

      const connection = connectionDoc.data();
      const accessToken = connection?.accessToken;

      if (!accessToken) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No access token available'
        );
      }

      let endpoint = '';
      if (contactId) {
        endpoint = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`;
      } else if (email) {
        endpoint = `https://api.hubapi.com/crm/v3/objects/contacts/${email}?idProperty=email`;
      } else {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Either contactId or email must be provided'
        );
      }

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return { contact: response.data };
    } catch (error: any) {
      console.error('Error getting HubSpot contact:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Scheduled function to process scheduled messages
 * Runs every minute to check for messages that need to be sent
 */
export const processScheduledMessages = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();

      // Get all scheduled messages that are due
      const messagesSnapshot = await db
        .collection('scheduled_messages')
        .where('status', '==', 'scheduled')
        .where('scheduledAt', '<=', now)
        .limit(50)
        .get();

      console.log(`Found ${messagesSnapshot.size} messages to send`);

      const promises = messagesSnapshot.docs.map(async (doc) => {
        const message = doc.data();

        try {
          // Update status to sending
          await doc.ref.update({ status: 'sending' });

          // Get workspace
          const workspaceDoc = await db
            .collection('workspaces')
            .doc(message.workspaceId)
            .get();

          if (!workspaceDoc.exists) {
            throw new Error('Workspace not found');
          }

          const workspace = workspaceDoc.data();

          // Determine token
          let token: string | undefined;
          if (message.sender?.type === 'user' && message.sender.userId) {
            const userToken = workspace?.userTokens?.find(
              (t: any) => t.id === message.sender.userId
            );
            token = userToken?.token;
          } else {
            token = workspace?.botToken;
          }

          if (!token) {
            throw new Error('No token available');
          }

          // Send message
          const slackClient = new WebClient(token);

          for (const recipient of message.recipients) {
            let channel = recipient.id || recipient.name;

            const messagePayload: any = {
              channel,
              text: message.content,
            };

            if (message.blocks && message.blocks.length > 0) {
              messagePayload.blocks = message.blocks;
            }

            await slackClient.chat.postMessage(messagePayload);

            // Log to history
            await db.collection('message_history').add({
              workspaceId: message.workspaceId,
              scheduledMessageId: doc.id,
              templateId: message.templateId,
              content: message.content,
              blocks: message.blocks,
              recipients: [recipient],
              sender: message.sender,
              sentAt: admin.firestore.Timestamp.now(),
              sentBy: message.createdBy,
              status: 'sent',
            });
          }

          // Update message status
          if (message.recurrence) {
            // Calculate next run time based on recurrence
            // For now, just mark as sent
            await doc.ref.update({
              status: 'sent',
              lastRun: now,
            });
          } else {
            await doc.ref.update({ status: 'sent' });
          }
        } catch (error: any) {
          console.error(`Error sending message ${doc.id}:`, error);
          await doc.ref.update({
            status: 'failed',
            errorMessage: error.message,
          });
        }
      });

      await Promise.all(promises);
      return null;
    } catch (error) {
      console.error('Error in processScheduledMessages:', error);
      return null;
    }
  });
