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
 * TEMPORARY: Auth check disabled for development
 */
export const sendSlackMessage = functions.https.onCall(
  async (data: SendMessageData, context) => {
    // TEMPORARY: Disabled auth check for development
    // TODO: Restore this when Firebase Auth is enabled
    // if (!context.auth) {
    //   throw new functions.https.HttpsError(
    //     'unauthenticated',
    //     'User must be authenticated'
    //   );
    // }

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
            sentBy: context.auth?.uid || 'mock-user-id', // TEMPORARY: fallback for dev
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
            sentBy: context.auth?.uid || 'mock-user-id', // TEMPORARY: fallback for dev
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
 * TEMPORARY: Auth check disabled for development
 */
export const getSlackChannels = functions.https.onCall(
  async (data: { workspaceId: string }, context) => {
    // TEMPORARY: Disabled for development
    // if (!context.auth) {
    //   throw new functions.https.HttpsError(
    //     'unauthenticated',
    //     'User must be authenticated'
    //   );
    // }

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
 * TEMPORARY: Auth check disabled for development
 */
export const getSlackUsers = functions.https.onCall(
  async (data: { workspaceId: string }, context) => {
    // TEMPORARY: Disabled for development
    // if (!context.auth) {
    //   throw new functions.https.HttpsError(
    //     'unauthenticated',
    //     'User must be authenticated'
    //   );
    // }

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
 * TEMPORARY: Auth check disabled for development
 */
export const getHubSpotContact = functions.https.onCall(
  async (
    data: { connectionId: string; contactId?: string; email?: string },
    context
  ) => {
    // TEMPORARY: Disabled for development
    // if (!context.auth) {
    //   throw new functions.https.HttpsError(
    //     'unauthenticated',
    //     'User must be authenticated'
    //   );
    // }

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

// ==========================================================================
// =                     SALES COACHING SYSTEM FUNCTIONS                    =
// ==========================================================================

interface HubSpotMetricsData {
  salesUserId: string;
  startDate: string; // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
  endDate: string;
}

interface CategoriaDesempeno {
  solicitudes: 'critico' | 'alerta' | 'preocupante' | 'rezagado' | 'en_linea' | 'destacado' | 'excepcional';
  ventas: 'critico' | 'alerta' | 'preocupante' | 'rezagado' | 'en_linea' | 'destacado' | 'excepcional';
  final: 'critico' | 'alerta' | 'preocupante' | 'rezagado' | 'en_linea' | 'destacado' | 'excepcional';
}

/**
 * Calculate sales metrics from HubSpot for a sales user
 * Queries HubSpot API for deals and calculates performance metrics
 */
export const calculateSalesMetrics = functions.https.onCall(
  async (data: HubSpotMetricsData, context) => {
    try {
      const { salesUserId, startDate, endDate } = data;

      // Get sales user
      const salesUserDoc = await db.collection('sales_users').doc(salesUserId).get();
      if (!salesUserDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Sales user not found');
      }

      const salesUser = salesUserDoc.data();
      if (!salesUser) {
        throw new functions.https.HttpsError('not-found', 'Sales user data not found');
      }

      // Get HubSpot connection for the workspace
      const hubspotConnections = await db
        .collection('hubspot_connections')
        .where('workspaceId', '==', salesUser.workspaceId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (hubspotConnections.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'No active HubSpot connection found for this workspace'
        );
      }

      const hubspotConnection = hubspotConnections.docs[0].data();
      const accessToken = hubspotConnection.accessToken;

      if (!accessToken) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No HubSpot access token available'
        );
      }

      const pipeline = salesUser.pipeline || 'default';
      const ownerIds = [salesUser.hubspotOwnerId];

      // Query HubSpot for deals
      const dealsResponse = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/deals/search',
        {
          filterGroups: [
            {
              filters: [
                { propertyName: 'createdate', operator: 'GTE', value: startDate },
                { propertyName: 'createdate', operator: 'LTE', value: endDate },
                { propertyName: 'hubspot_owner_id', operator: 'IN', values: ownerIds },
                { propertyName: 'pipeline', operator: 'EQ', value: pipeline },
              ],
            },
          ],
          properties: ['amount', 'dealstage', 'hs_v2_date_entered_33823866'],
          limit: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const deals = dealsResponse.data.results || [];

      // Calculate metrics
      const solicitudes = deals.length;
      let ventasAvanzadas = 0;
      let ventasReales = 0;

      // Advanced stages (varies by pipeline)
      const advancedStages =
        pipeline === '76732496'
          ? ['146251806', '146251807', '150228300']
          : ['69785436', '33642516', '171655337', '33642518', '61661493', '151337783', '150187097'];

      deals.forEach((deal: any) => {
        const amount = parseFloat(deal.properties.amount || '0');
        const dealstage = deal.properties.dealstage;
        const dateEnteredDesembolso = deal.properties.hs_v2_date_entered_33823866;

        // Ventas avanzadas: deals in advanced stages
        if (advancedStages.includes(dealstage)) {
          ventasAvanzadas += amount;
        }

        // Ventas reales: deals that entered "desembolso" stage
        if (dateEnteredDesembolso) {
          const desembolsoDate = new Date(dateEnteredDesembolso);
          const startDateObj = new Date(startDate);
          const endDateObj = new Date(endDate);

          if (desembolsoDate >= startDateObj && desembolsoDate <= endDateObj) {
            ventasReales += amount;
          }
        }
      });

      // Calculate progress percentages
      const progresoSolicitudes =
        salesUser.metaSolicitudes > 0
          ? Math.round((solicitudes / salesUser.metaSolicitudes) * 100)
          : 0;

      const progresoVentas =
        salesUser.metaVentas > 0
          ? Math.round((ventasReales / salesUser.metaVentas) * 100)
          : 0;

      // Calculate expected progress based on day of week
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = now.getHours();
      const isMorning = hour < 12;

      let progresoEsperado = 0;
      switch (dayOfWeek) {
        case 1: progresoEsperado = isMorning ? 5 : 15; break;  // Monday
        case 2: progresoEsperado = isMorning ? 25 : 35; break; // Tuesday
        case 3: progresoEsperado = isMorning ? 45 : 55; break; // Wednesday
        case 4: progresoEsperado = isMorning ? 65 : 75; break; // Thursday
        case 5: progresoEsperado = isMorning ? 80 : 90; break; // Friday
        case 6: progresoEsperado = isMorning ? 95 : 100; break; // Saturday
        default: progresoEsperado = 100; // Sunday
      }

      // Determine performance categories
      const categoria = determinarCategoria(progresoVentas, progresoSolicitudes, progresoEsperado);

      // Save metrics to Firestore
      await db.collection('metricas_desempeno').add({
        userId: salesUserId,
        workspaceId: salesUser.workspaceId,
        fecha: admin.firestore.Timestamp.now(),
        periodoInicio: admin.firestore.Timestamp.fromDate(new Date(startDate)),
        periodoFin: admin.firestore.Timestamp.fromDate(new Date(endDate)),
        solicitudes,
        ventasAvanzadas,
        ventasReales,
        progresoSolicitudes,
        progresoVentas,
        progresoEsperado,
        categoria: categoria.final,
        notificacionEnviada: false,
        createdAt: admin.firestore.Timestamp.now(),
      });

      return {
        success: true,
        metrics: {
          solicitudes,
          ventasAvanzadas,
          ventasReales,
          progresoSolicitudes,
          progresoVentas,
          progresoEsperado,
          categoria: categoria.final,
        },
      };
    } catch (error: any) {
      console.error('Error calculating sales metrics:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * Helper function to determine performance category
 */
function determinarCategoria(
  progresoVentas: number,
  progresoSolicitudes: number,
  progresoEsperado: number
): CategoriaDesempeno {
  const determinarCategoriMetrica = (progreso: number, esperado: number) => {
    const diferencia = progreso - esperado;

    if (diferencia <= -30) return 'critico';
    if (diferencia <= -20) return 'alerta';
    if (diferencia <= -10) return 'preocupante';
    if (diferencia <= -5) return 'rezagado';
    if (diferencia <= 5) return 'en_linea';
    if (diferencia <= 15) return 'destacado';
    return 'excepcional';
  };

  let catVentas = determinarCategoriMetrica(progresoVentas, progresoEsperado);
  const catSolicitudes = determinarCategoriMetrica(progresoSolicitudes, progresoEsperado);

  // Adjust sales category if very close to goal
  if (progresoVentas >= 95) {
    if (catVentas === 'critico' || catVentas === 'alerta') {
      catVentas = 'preocupante';
    }
  } else if (progresoVentas >= 80) {
    if (catVentas === 'critico') {
      catVentas = 'alerta';
    }
  }

  // Determine final category based on both metrics
  let categoriaFinal: typeof catVentas = catVentas;

  if (catVentas === 'excepcional') {
    categoriaFinal = 'destacado';
  } else if (catVentas === 'destacado') {
    if (catSolicitudes === 'critico' || catSolicitudes === 'alerta') {
      categoriaFinal = 'rezagado';
    } else {
      categoriaFinal = 'en_linea';
    }
  } else if (catVentas === 'en_linea') {
    if (catSolicitudes === 'critico') {
      categoriaFinal = 'preocupante';
    } else if (catSolicitudes === 'alerta' || catSolicitudes === 'preocupante') {
      categoriaFinal = 'rezagado';
    }
  } else if (catVentas === 'rezagado') {
    if (catSolicitudes === 'critico' || catSolicitudes === 'alerta') {
      categoriaFinal = 'preocupante';
    }
  }

  return {
    solicitudes: catSolicitudes,
    ventas: catVentas,
    final: categoriaFinal,
  };
}
