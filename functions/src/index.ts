import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { WebClient } from '@slack/web-api';
import axios from 'axios';

admin.initializeApp();

const db = admin.firestore();

// ==========================================================================
// =                         SHARED INTERFACES                              =
// ==========================================================================

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

type CategoriaNombre = 'critico' | 'alerta' | 'preocupante' | 'rezagado' | 'en_linea' | 'destacado' | 'excepcional';

interface CategoriaResult {
  solicitudes: CategoriaNombre;
  ventas: CategoriaNombre;
  final: CategoriaNombre;
}

// ==========================================================================
// =                       HELPER: GET SLACK TOKEN                          =
// ==========================================================================

async function getSlackToken(workspaceId: string, sender?: SenderConfig): Promise<{ token: string; workspace: any }> {
  const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
  if (!workspaceDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Workspace not found');
  }

  const workspace = workspaceDoc.data();
  if (!workspace) {
    throw new functions.https.HttpsError('not-found', 'Workspace data not found');
  }

  let token: string | undefined;

  if (sender?.type === 'user' && sender.userId) {
    const userToken = workspace.userTokens?.find(
      (t: any) => t.id === sender.userId
    );
    if (userToken) {
      token = userToken.token;
    }
  }

  if (!token) {
    token = workspace.botToken;
  }

  if (!token) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No token available for sending messages'
    );
  }

  return { token, workspace };
}

// ==========================================================================
// =                      HELPER: RECURRENCE CALCULATOR                     =
// ==========================================================================

function calculateNextRun(recurrence: any, lastRun: Date): Date | null {
  if (!recurrence || !recurrence.type) return null;

  const now = new Date();

  switch (recurrence.type) {
    case 'daily': {
      const next = new Date(lastRun);
      next.setDate(next.getDate() + 1);
      if (recurrence.time) {
        const [hours, minutes] = recurrence.time.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
      }
      if (recurrence.endDate && next > new Date(recurrence.endDate.toDate ? recurrence.endDate.toDate() : recurrence.endDate)) {
        return null;
      }
      return next;
    }

    case 'weekly': {
      const daysOfWeek: number[] = recurrence.daysOfWeek || [];
      if (daysOfWeek.length === 0) return null;

      const currentDay = lastRun.getDay();
      let nextDay: number | null = null;
      let daysToAdd = 0;

      // Find next matching day
      for (let i = 1; i <= 7; i++) {
        const candidateDay = (currentDay + i) % 7;
        if (daysOfWeek.includes(candidateDay)) {
          nextDay = candidateDay;
          daysToAdd = i;
          break;
        }
      }

      if (nextDay === null) return null;

      const next = new Date(lastRun);
      next.setDate(next.getDate() + daysToAdd);
      if (recurrence.time) {
        const [hours, minutes] = recurrence.time.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
      }
      if (recurrence.endDate && next > new Date(recurrence.endDate.toDate ? recurrence.endDate.toDate() : recurrence.endDate)) {
        return null;
      }
      return next;
    }

    case 'monthly': {
      const next = new Date(lastRun);
      next.setMonth(next.getMonth() + 1);
      if (recurrence.dayOfMonth) {
        next.setDate(recurrence.dayOfMonth);
      }
      if (recurrence.time) {
        const [hours, minutes] = recurrence.time.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
      }
      if (recurrence.endDate && next > new Date(recurrence.endDate.toDate ? recurrence.endDate.toDate() : recurrence.endDate)) {
        return null;
      }
      return next;
    }

    case 'cron': {
      // Simple cron-like support for common patterns
      // For full cron, consider using a library
      // For now, calculate based on interval
      const next = new Date(now);
      next.setMinutes(next.getMinutes() + 1);
      return next;
    }

    default:
      return null;
  }
}

// ==========================================================================
// =                    HELPER: WEEK DATE RANGE                             =
// ==========================================================================

function getWeekDateRange(dateRangeType: string): { startDate: string; endDate: string } {
  const now = new Date();

  switch (dateRangeType) {
    case 'current_week':
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() + mondayOffset);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return {
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
      };
    }
    case 'last_week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() + mondayOffset);
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
      startOfLastWeek.setHours(0, 0, 0, 0);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
      endOfLastWeek.setHours(23, 59, 59, 999);
      return {
        startDate: startOfLastWeek.toISOString(),
        endDate: endOfLastWeek.toISOString(),
      };
    }
    case 'today': {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      return {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      };
    }
    case 'current_month':
    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString(),
      };
    }
    default:
      // Default to current week
      return getWeekDateRange('current_week');
  }
}

// ==========================================================================
// =              HELPER: EXPECTED PROGRESS BY DAY OF WEEK                  =
// ==========================================================================

function calcularProgresoEsperado(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isMorning = now.getHours() < 12;

  switch (dayOfWeek) {
    case 1: return isMorning ? 5 : 15;   // Monday
    case 2: return isMorning ? 25 : 35;  // Tuesday
    case 3: return isMorning ? 45 : 55;  // Wednesday
    case 4: return isMorning ? 65 : 75;  // Thursday
    case 5: return isMorning ? 80 : 90;  // Friday
    case 6: return isMorning ? 95 : 100; // Saturday
    default: return 100;                 // Sunday
  }
}

// ==========================================================================
// =                    HELPER: DETERMINE CATEGORY                          =
// ==========================================================================

function determinarCategoria(
  progresoVentas: number,
  progresoSolicitudes: number,
  progresoEsperado: number
): CategoriaResult {
  const determinarCategoriaMetrica = (progreso: number, esperado: number): CategoriaNombre => {
    const diferencia = progreso - esperado;
    if (diferencia <= -30) return 'critico';
    if (diferencia <= -20) return 'alerta';
    if (diferencia <= -10) return 'preocupante';
    if (diferencia <= -5) return 'rezagado';
    if (diferencia <= 5) return 'en_linea';
    if (diferencia <= 15) return 'destacado';
    return 'excepcional';
  };

  let catVentas = determinarCategoriaMetrica(progresoVentas, progresoEsperado);
  const catSolicitudes = determinarCategoriaMetrica(progresoSolicitudes, progresoEsperado);

  if (progresoVentas >= 95) {
    if (catVentas === 'critico' || catVentas === 'alerta') {
      catVentas = 'preocupante';
    }
  } else if (progresoVentas >= 80) {
    if (catVentas === 'critico') {
      catVentas = 'alerta';
    }
  }

  let categoriaFinal: CategoriaNombre = catVentas;

  if (catVentas === 'excepcional') {
    categoriaFinal = 'destacado';
  } else if (catVentas === 'destacado') {
    categoriaFinal = (catSolicitudes === 'critico' || catSolicitudes === 'alerta') ? 'rezagado' : 'en_linea';
  } else if (catVentas === 'en_linea') {
    if (catSolicitudes === 'critico') categoriaFinal = 'preocupante';
    else if (catSolicitudes === 'alerta' || catSolicitudes === 'preocupante') categoriaFinal = 'rezagado';
  } else if (catVentas === 'rezagado') {
    if (catSolicitudes === 'critico' || catSolicitudes === 'alerta') categoriaFinal = 'preocupante';
  }

  return { solicitudes: catSolicitudes, ventas: catVentas, final: categoriaFinal };
}

// ==========================================================================
// =                 HELPER: HUBSPOT DEALS QUERY WITH PAGINATION            =
// ==========================================================================

async function queryHubSpotDeals(
  accessToken: string,
  filters: any[],
  properties: string[]
): Promise<any[]> {
  const allDeals: any[] = [];
  let after: string | undefined;

  do {
    const body: any = {
      filterGroups: [{ filters }],
      properties,
      limit: 100,
    };
    if (after) body.after = after;

    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/deals/search',
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    allDeals.push(...(data.results || []));
    after = data.paging?.next?.after;
  } while (after);

  return allDeals;
}

// ==========================================================================
// =                 HELPER: REPLACE TEMPLATE VARIABLES                     =
// ==========================================================================

function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    let displayValue: string;
    if (typeof value === 'number') {
      // Format numbers: currency for ventas/montos, plain for counts
      if (key.includes('ventas') || key.includes('meta_ventas') || key.includes('monto')) {
        displayValue = `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      } else if (key.includes('pct_') || key.includes('progreso')) {
        displayValue = `${value}%`;
      } else {
        displayValue = value.toString();
      }
    } else {
      displayValue = String(value ?? '');
    }
    result = result.replace(regex, displayValue);
  }
  return result;
}

// ==========================================================================
// =                         SEND SLACK MESSAGE                             =
// ==========================================================================

export const sendSlackMessage = functions.https.onCall(
  async (data: SendMessageData, context) => {
    try {
      const { workspaceId, content, blocks, recipients, sender, templateId, scheduledMessageId } = data;
      const { token } = await getSlackToken(workspaceId, sender);
      const slackClient = new WebClient(token);

      const results = [];
      for (const recipient of recipients) {
        let channel = recipient.id || recipient.name;

        if (recipient.type === 'email' && recipient.email) {
          try {
            const userLookup = await slackClient.users.lookupByEmail({ email: recipient.email });
            if (userLookup.user?.id) {
              channel = userLookup.user.id;
            }
          } catch (error) {
            console.error('Error looking up user by email:', error);
          }
        }

        try {
          const messagePayload: any = { channel, text: content };
          if (blocks && blocks.length > 0) {
            messagePayload.blocks = blocks;
          }

          const result = await slackClient.chat.postMessage(messagePayload);
          results.push({ recipient, success: true, result });

          await db.collection('message_history').add({
            workspaceId, scheduledMessageId, templateId, content, blocks,
            recipients: [recipient], sender,
            sentAt: admin.firestore.Timestamp.now(),
            sentBy: context.auth?.uid || 'system',
            status: 'sent', slackResponse: result,
          });
        } catch (error: any) {
          console.error('Error sending to recipient:', error);
          results.push({ recipient, success: false, error: error.message });

          await db.collection('message_history').add({
            workspaceId, scheduledMessageId, templateId, content, blocks,
            recipients: [recipient], sender,
            sentAt: admin.firestore.Timestamp.now(),
            sentBy: context.auth?.uid || 'system',
            status: 'failed', errorMessage: error.message,
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

// ==========================================================================
// =                       GET SLACK CHANNELS                               =
// ==========================================================================

export const getSlackChannels = functions.https.onCall(
  async (data: { workspaceId: string }, _context) => {
    try {
      const { token } = await getSlackToken(data.workspaceId);
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

// ==========================================================================
// =                         GET SLACK USERS                                =
// ==========================================================================

export const getSlackUsers = functions.https.onCall(
  async (data: { workspaceId: string }, _context) => {
    try {
      const { token } = await getSlackToken(data.workspaceId);
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

// ==========================================================================
// =                       GET HUBSPOT CONTACT                              =
// ==========================================================================

export const getHubSpotContact = functions.https.onCall(
  async (data: { connectionId: string; contactId?: string; email?: string }, _context) => {
    try {
      const { connectionId, contactId, email } = data;
      const connectionDoc = await db.collection('hubspot_connections').doc(connectionId).get();
      if (!connectionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'HubSpot connection not found');
      }

      const connection = connectionDoc.data();
      const accessToken = connection?.accessToken;
      if (!accessToken) {
        throw new functions.https.HttpsError('failed-precondition', 'No access token available');
      }

      let endpoint = '';
      if (contactId) {
        endpoint = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`;
      } else if (email) {
        endpoint = `https://api.hubapi.com/crm/v3/objects/contacts/${email}?idProperty=email`;
      } else {
        throw new functions.https.HttpsError('invalid-argument', 'Either contactId or email must be provided');
      }

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });

      return { contact: response.data };
    } catch (error: any) {
      console.error('Error getting HubSpot contact:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// ==========================================================================
// =        PROCESS SCHEDULED MESSAGES (WITH RECURRENCE FIX)                =
// ==========================================================================

export const processScheduledMessages = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (_context) => {
    try {
      const now = admin.firestore.Timestamp.now();

      const messagesSnapshot = await db
        .collection('scheduled_messages')
        .where('status', '==', 'scheduled')
        .where('scheduledAt', '<=', now)
        .limit(50)
        .get();

      console.log(`Found ${messagesSnapshot.size} messages to send`);

      const promises = messagesSnapshot.docs.map(async (messageDoc) => {
        const message = messageDoc.data();

        try {
          await messageDoc.ref.update({ status: 'sending' });

          const { token } = await getSlackToken(message.workspaceId, message.sender);
          const slackClient = new WebClient(token);

          for (const recipient of message.recipients) {
            const channel = recipient.id || recipient.name;
            const messagePayload: any = { channel, text: message.content };
            if (message.blocks && message.blocks.length > 0) {
              messagePayload.blocks = message.blocks;
            }

            await slackClient.chat.postMessage(messagePayload);

            await db.collection('message_history').add({
              workspaceId: message.workspaceId,
              scheduledMessageId: messageDoc.id,
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

          // Handle recurrence: calculate next run and reschedule
          if (message.recurrence && message.recurrence.type !== 'once') {
            const lastRunDate = now.toDate();
            const nextRunDate = calculateNextRun(message.recurrence, lastRunDate);

            if (nextRunDate) {
              await messageDoc.ref.update({
                status: 'scheduled',
                lastRun: now,
                scheduledAt: admin.firestore.Timestamp.fromDate(nextRunDate),
                nextRun: admin.firestore.Timestamp.fromDate(nextRunDate),
              });
            } else {
              // No more runs (past end date)
              await messageDoc.ref.update({
                status: 'sent',
                lastRun: now,
              });
            }
          } else {
            await messageDoc.ref.update({ status: 'sent', lastRun: now });
          }
        } catch (error: any) {
          console.error(`Error sending message ${messageDoc.id}:`, error);
          await messageDoc.ref.update({
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
// =                     CALCULATE SALES METRICS                            =
// ==========================================================================

interface HubSpotMetricsData {
  salesUserId: string;
  startDate: string;
  endDate: string;
}

export const calculateSalesMetrics = functions.https.onCall(
  async (data: HubSpotMetricsData, _context) => {
    try {
      const { salesUserId, startDate, endDate } = data;

      const salesUserDoc = await db.collection('sales_users').doc(salesUserId).get();
      if (!salesUserDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Sales user not found');
      }

      const salesUser = salesUserDoc.data()!;

      const hubspotConnections = await db
        .collection('hubspot_connections')
        .where('workspaceId', '==', salesUser.workspaceId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (hubspotConnections.empty) {
        throw new functions.https.HttpsError('not-found', 'No active HubSpot connection found');
      }

      const accessToken = hubspotConnections.docs[0].data().accessToken;
      if (!accessToken) {
        throw new functions.https.HttpsError('failed-precondition', 'No HubSpot access token available');
      }

      const pipeline = salesUser.pipeline || 'default';
      const ownerIds = [salesUser.hubspotOwnerId];

      // Add promoter IDs for kioscos
      if (salesUser.tipo === 'kiosco' && salesUser.promotores) {
        ownerIds.push(...salesUser.promotores);
      }

      const deals = await queryHubSpotDeals(
        accessToken,
        [
          { propertyName: 'createdate', operator: 'GTE', value: startDate },
          { propertyName: 'createdate', operator: 'LTE', value: endDate },
          { propertyName: 'hubspot_owner_id', operator: 'IN', values: ownerIds },
          { propertyName: 'pipeline', operator: 'EQ', value: pipeline },
        ],
        ['amount', 'dealstage', 'hs_v2_date_entered_33823866']
      );

      const solicitudes = deals.length;
      let ventasAvanzadas = 0;
      let ventasReales = 0;

      const advancedStages =
        pipeline === '76732496'
          ? ['146251806', '146251807', '150228300']
          : ['69785436', '33642516', '171655337', '33642518', '61661493', '151337783', '150187097'];

      deals.forEach((deal: any) => {
        const amount = parseFloat(deal.properties.amount || '0');
        const dealstage = deal.properties.dealstage;
        const dateEnteredDesembolso = deal.properties.hs_v2_date_entered_33823866;

        if (advancedStages.includes(dealstage)) {
          ventasAvanzadas += amount;
        }

        if (dateEnteredDesembolso) {
          const desembolsoDate = new Date(dateEnteredDesembolso);
          if (desembolsoDate >= new Date(startDate) && desembolsoDate <= new Date(endDate)) {
            ventasReales += amount;
          }
        }
      });

      const progresoSolicitudes = salesUser.metaSolicitudes > 0
        ? Math.round((solicitudes / salesUser.metaSolicitudes) * 100) : 0;
      const progresoVentas = salesUser.metaVentas > 0
        ? Math.round((ventasReales / salesUser.metaVentas) * 100) : 0;
      const progresoEsperado = calcularProgresoEsperado();

      const categoria = determinarCategoria(progresoVentas, progresoSolicitudes, progresoEsperado);

      await db.collection('metricas_desempeno').add({
        userId: salesUserId,
        workspaceId: salesUser.workspaceId,
        fecha: admin.firestore.Timestamp.now(),
        periodoInicio: admin.firestore.Timestamp.fromDate(new Date(startDate)),
        periodoFin: admin.firestore.Timestamp.fromDate(new Date(endDate)),
        solicitudes, ventasAvanzadas, ventasReales,
        progresoSolicitudes, progresoVentas, progresoEsperado,
        categoria: categoria.final,
        notificacionEnviada: false,
        createdAt: admin.firestore.Timestamp.now(),
      });

      return {
        success: true,
        metrics: {
          solicitudes, ventasAvanzadas, ventasReales,
          progresoSolicitudes, progresoVentas, progresoEsperado,
          categoria: categoria.final,
        },
      };
    } catch (error: any) {
      console.error('Error calculating sales metrics:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// ==========================================================================
// =                     GENERATE AI MESSAGE                                =
// ==========================================================================

export const generateAIMessage = functions.https.onCall(
  async (data: {
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    workspaceId: string;
  }, _context) => {
    try {
      const {
        prompt,
        systemPrompt,
        temperature = 0.7,
        maxTokens = 150,
        workspaceId,
      } = data;

      // Get OpenAI API key from workspace settings or environment
      const settingsSnapshot = await db
        .collection('workspace_settings')
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      let apiKey = '';
      if (!settingsSnapshot.empty) {
        const settings = settingsSnapshot.docs[0].data();
        apiKey = settings.openaiApiKey || '';
      }

      // Fallback to environment config
      if (!apiKey) {
        apiKey = functions.config().openai?.api_key || '';
      }

      if (!apiKey) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No OpenAI API key configured. Add it in Settings > Integraciones.'
        );
      }

      const defaultSystemPrompt = (
        'Eres un asistente de ventas en español que escribe mensajes en un solo párrafo corto, ' +
        'usando "tú" (informal), sin cambiar los datos numéricos. ' +
        'Sé directo, informativo y motivador, usando máximo 2 emojis. ' +
        'Los mensajes deben ser variados y no repetitivos.'
      );

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt || defaultSystemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const generatedText = response.data.choices[0].message.content.trim();

      return { success: true, text: generatedText };
    } catch (error: any) {
      console.error('Error generating AI message:', error);
      if (error.response?.status === 401) {
        throw new functions.https.HttpsError('permission-denied', 'OpenAI API key is invalid');
      }
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// ==========================================================================
// =                CAMPAIGN EXECUTION ENGINE                               =
// ==========================================================================

export const processCampaigns = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (_context) => {
    try {
      const now = new Date();
      const currentDay = now.getDay(); // 0=Sunday
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Get all active campaigns
      const campaignsSnapshot = await db
        .collection('campaigns')
        .where('isActive', '==', true)
        .get();

      console.log(`Checking ${campaignsSnapshot.size} active campaigns at ${currentTime} (day ${currentDay})`);

      for (const campaignDoc of campaignsSnapshot.docs) {
        const campaign = campaignDoc.data();

        // Check each schedule slot
        for (const slot of (campaign.scheduleSlots || [])) {
          const slotDays: number[] = slot.daysOfWeek || [];
          const slotTime: string = slot.time || '';

          // Check if this slot matches current day and time
          if (!slotDays.includes(currentDay) || slotTime !== currentTime) {
            continue;
          }

          console.log(`Executing campaign "${campaign.name}" for slot at ${slotTime}`);

          try {
            await executeCampaign(campaignDoc.id, campaign, slot);
          } catch (error: any) {
            console.error(`Error executing campaign ${campaignDoc.id}:`, error);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error in processCampaigns:', error);
      return null;
    }
  });

async function executeCampaign(
  campaignId: string,
  campaign: any,
  scheduleSlot: any
): Promise<void> {
  const workspaceId = campaign.workspaceId;

  // 1. Resolve recipients
  const recipients = await resolveRecipients(campaign.recipientConfig, workspaceId);
  if (recipients.length === 0) {
    console.log(`No recipients found for campaign ${campaignId}`);
    return;
  }

  // 2. Get workspace token
  const { token } = await getSlackToken(workspaceId);
  const slackClient = new WebClient(token);

  // 3. Get HubSpot connection if data config is enabled
  let accessToken: string | null = null;
  if (campaign.dataConfig) {
    const hubspotConnections = await db
      .collection('hubspot_connections')
      .where('workspaceId', '==', workspaceId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!hubspotConnections.empty) {
      accessToken = hubspotConnections.docs[0].data().accessToken || null;
    }
  }

  // 4. Get AI config
  let openaiApiKey: string | null = null;
  if (campaign.aiConfig?.enabled) {
    const settingsSnapshot = await db
      .collection('workspace_settings')
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    if (!settingsSnapshot.empty) {
      openaiApiKey = settingsSnapshot.docs[0].data().openaiApiKey || null;
    }
    if (!openaiApiKey) {
      openaiApiKey = functions.config().openai?.api_key || null;
    }
  }

  // 5. Process each recipient
  const executionDetails: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const recipient of recipients) {
    try {
      // 5a. Fetch metrics for this recipient
      const metrics = await fetchRecipientMetrics(recipient, campaign.dataConfig, accessToken);

      // 5b. Select message variant
      const selectedVariant = selectMessageVariant(campaign.messageVariants, metrics);
      if (!selectedVariant) {
        console.warn(`No matching variant for ${recipient.nombre}`);
        continue;
      }

      // 5c. Build template variables
      const templateVars = buildTemplateVariables(recipient, metrics);

      // 5d. Replace variables in template
      let finalMessage = replaceTemplateVariables(selectedVariant.messageTemplate, templateVars);

      // 5e. AI rewrite if enabled
      if (campaign.aiConfig?.enabled && openaiApiKey) {
        try {
          const aiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: campaign.aiConfig.systemPrompt || (
                    'Eres un asistente de ventas en español. Reescribe el mensaje manteniendo ' +
                    'los datos numéricos exactos. Sé directo, motivador, máximo 2 emojis. ' +
                    'Un solo párrafo corto.'
                  ),
                },
                {
                  role: 'user',
                  content: campaign.aiConfig.rewriteMode === 'rewrite'
                    ? `Reescribe este mensaje manteniendo los datos: ${finalMessage}`
                    : `Genera un mensaje motivador basado en: ${finalMessage}`,
                },
              ],
              temperature: campaign.aiConfig.temperature || 0.7,
              max_tokens: campaign.aiConfig.maxTokens || 150,
            },
            {
              headers: {
                Authorization: `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          finalMessage = aiResponse.data.choices[0].message.content.trim();
        } catch (aiError) {
          console.error('AI rewrite failed, using original message:', aiError);
        }
      }

      // 5f. Add mention if configured
      if (campaign.mentionUser && recipient.slackUserId) {
        finalMessage = `<@${recipient.slackUserId}> ${finalMessage}`;
      }

      // 5g. Prefix with bold name
      const displayMessage = `*${recipient.nombre}* - ${finalMessage}`;

      // 5h. Send message
      await slackClient.chat.postMessage({
        channel: recipient.slackChannel,
        text: displayMessage,
      });

      executionDetails.push({
        userId: recipient.id,
        userName: recipient.nombre,
        channel: recipient.slackChannel,
        status: 'sent',
        messageSent: displayMessage,
        variantUsed: selectedVariant.id,
        metrics,
      });
      successCount++;
    } catch (error: any) {
      console.error(`Error sending to ${recipient.nombre}:`, error);
      executionDetails.push({
        userId: recipient.id,
        userName: recipient.nombre,
        channel: recipient.slackChannel,
        status: 'failed',
        messageSent: '',
        errorMessage: error.message,
      });
      failureCount++;
    }
  }

  // 6. Log execution
  await db.collection('campaign_executions').add({
    campaignId,
    campaignName: campaign.name,
    workspaceId,
    executedAt: admin.firestore.Timestamp.now(),
    scheduleSlotId: scheduleSlot.id,
    recipientCount: recipients.length,
    successCount,
    failureCount,
    details: executionDetails,
  });

  // 7. Update campaign stats
  await db.collection('campaigns').doc(campaignId).update({
    lastExecuted: admin.firestore.Timestamp.now(),
    executionCount: admin.firestore.FieldValue.increment(1),
  });

  console.log(`Campaign "${campaign.name}" executed: ${successCount} sent, ${failureCount} failed`);
}

async function resolveRecipients(
  recipientConfig: any,
  workspaceId: string
): Promise<any[]> {
  if (!recipientConfig) return [];

  const { sourceType } = recipientConfig;

  if (sourceType === 'sales_user_type') {
    const types: string[] = recipientConfig.salesUserTypes || [];
    if (types.length === 0) return [];

    const allUsers: any[] = [];
    for (const tipo of types) {
      const snapshot = await db
        .collection('sales_users')
        .where('workspaceId', '==', workspaceId)
        .where('tipo', '==', tipo)
        .where('isActive', '==', true)
        .get();

      snapshot.docs.forEach((d) => allUsers.push({ id: d.id, ...d.data() }));
    }
    return allUsers;
  }

  if (sourceType === 'specific_users') {
    const userIds: string[] = recipientConfig.specificUserIds || [];
    const users: any[] = [];
    for (const userId of userIds) {
      const userDoc = await db.collection('sales_users').doc(userId).get();
      if (userDoc.exists) {
        users.push({ id: userDoc.id, ...userDoc.data() });
      }
    }
    return users;
  }

  if (sourceType === 'channel') {
    // For channel recipients, create pseudo-users
    const channelIds: string[] = recipientConfig.channelIds || [];
    const channelNames: string[] = recipientConfig.channelNames || [];
    return channelIds.map((channelId, i) => ({
      id: channelId,
      nombre: channelNames[i] || channelId,
      slackChannel: channelId,
      slackUserId: '',
      tipo: 'channel',
    }));
  }

  return [];
}

async function fetchRecipientMetrics(
  recipient: any,
  dataConfig: any,
  accessToken: string | null
): Promise<Record<string, number>> {
  if (!dataConfig || !accessToken || !recipient.hubspotOwnerId) {
    return {};
  }

  const { startDate, endDate } = getWeekDateRange(dataConfig.dateRange || 'current_week');
  const pipeline = dataConfig.customPipeline || recipient.pipeline || 'default';
  const ownerIds = [recipient.hubspotOwnerId];

  // Add promoter IDs for kioscos
  if (recipient.tipo === 'kiosco' && recipient.promotores) {
    ownerIds.push(...recipient.promotores);
  }

  const metrics: Record<string, number> = {};

  try {
    if (dataConfig.fetchSolicitudes || dataConfig.fetchVentasAvanzadas || dataConfig.fetchVentasReales) {
      const deals = await queryHubSpotDeals(
        accessToken,
        [
          { propertyName: 'createdate', operator: 'GTE', value: startDate },
          { propertyName: 'createdate', operator: 'LTE', value: endDate },
          { propertyName: 'hubspot_owner_id', operator: 'IN', values: ownerIds },
          { propertyName: 'pipeline', operator: 'EQ', value: pipeline },
        ],
        ['amount', 'dealstage', 'hs_v2_date_entered_33823866']
      );

      if (dataConfig.fetchSolicitudes) {
        metrics.solicitudes = deals.length;
      }

      if (dataConfig.fetchVentasAvanzadas) {
        const advancedStages = dataConfig.customStages || (
          pipeline === '76732496'
            ? ['146251806', '146251807', '150228300']
            : ['69785436', '33642516', '171655337', '33642518', '61661493', '151337783', '150187097']
        );

        metrics.ventas_avanzadas = deals.reduce((total: number, deal: any) => {
          const amount = parseFloat(deal.properties.amount || '0');
          return advancedStages.includes(deal.properties.dealstage) ? total + amount : total;
        }, 0);
      }

      if (dataConfig.fetchVentasReales) {
        metrics.ventas = deals.reduce((total: number, deal: any) => {
          const amount = parseFloat(deal.properties.amount || '0');
          const dateEntered = deal.properties.hs_v2_date_entered_33823866;
          if (dateEntered) {
            const d = new Date(dateEntered);
            if (d >= new Date(startDate) && d <= new Date(endDate)) {
              return total + amount;
            }
          }
          return total;
        }, 0);
      }
    }

    // Calculate percentages
    const metaSolicitudes = recipient.metaSolicitudes || 0;
    const metaVentas = recipient.metaVentas || 0;

    metrics.meta_solicitudes = metaSolicitudes;
    metrics.meta_ventas = metaVentas;
    metrics.pct_solicitudes = metaSolicitudes > 0
      ? Math.round(((metrics.solicitudes || 0) / metaSolicitudes) * 100) : 0;
    metrics.pct_ventas = metaVentas > 0
      ? Math.round(((metrics.ventas || 0) / metaVentas) * 100) : 0;
    metrics.pct_ventas_avanzadas = metaVentas > 0
      ? Math.round(((metrics.ventas_avanzadas || 0) / metaVentas) * 100) : 0;

    // Calculate performance category
    if (dataConfig.calculatePerformanceCategory) {
      const progresoEsperado = calcularProgresoEsperado();
      const categoria = determinarCategoria(
        metrics.pct_ventas,
        metrics.pct_solicitudes,
        progresoEsperado
      );
      metrics.progreso_esperado = progresoEsperado;

      // Store category as numeric for comparison
      const categoryMap: Record<string, number> = {
        critico: 0, alerta: 1, preocupante: 2, rezagado: 3,
        en_linea: 4, destacado: 5, excepcional: 6,
      };
      metrics._categoria_num = categoryMap[categoria.final] ?? 4;
      metrics._categoria_nombre = categoryMap[categoria.final] ?? 4; // stored as number for threshold
    }

    // Days remaining in the week
    const dayOfWeek = new Date().getDay();
    metrics.dias_restantes = dayOfWeek === 0 ? 0 : 6 - dayOfWeek;

  } catch (error: any) {
    console.error(`Error fetching metrics for ${recipient.nombre}:`, error);
  }

  return metrics;
}

function selectMessageVariant(
  variants: any[],
  metrics: Record<string, number>
): any | null {
  if (!variants || variants.length === 0) return null;

  // Sort by priority (lower = higher priority)
  const sorted = [...variants].sort((a, b) => (a.priority || 999) - (b.priority || 999));

  const categoryNames: CategoriaNombre[] = [
    'critico', 'alerta', 'preocupante', 'rezagado', 'en_linea', 'destacado', 'excepcional',
  ];

  for (const variant of sorted) {
    if (variant.conditionType === 'always') {
      return variant;
    }

    if (variant.conditionType === 'performance_category') {
      const currentCatNum = metrics._categoria_num;
      if (currentCatNum !== undefined) {
        const currentCatName = categoryNames[currentCatNum];
        if (variant.performanceCategories?.includes(currentCatName)) {
          return variant;
        }
      }
    }

    if (variant.conditionType === 'metric_threshold') {
      const metricValue = metrics[variant.metricField || ''];
      if (metricValue === undefined) continue;

      const threshold = variant.metricValue ?? 0;
      const thresholdEnd = variant.metricValueEnd ?? 0;

      let matches = false;
      switch (variant.metricOperator) {
        case 'gt': matches = metricValue > threshold; break;
        case 'gte': matches = metricValue >= threshold; break;
        case 'lt': matches = metricValue < threshold; break;
        case 'lte': matches = metricValue <= threshold; break;
        case 'eq': matches = metricValue === threshold; break;
        case 'between': matches = metricValue >= threshold && metricValue <= thresholdEnd; break;
      }

      if (matches) return variant;
    }
  }

  // Fallback to first "always" variant
  return sorted.find((v) => v.conditionType === 'always') || sorted[0] || null;
}

function buildTemplateVariables(
  recipient: any,
  metrics: Record<string, number>
): Record<string, any> {
  const categoryNames: CategoriaNombre[] = [
    'critico', 'alerta', 'preocupante', 'rezagado', 'en_linea', 'destacado', 'excepcional',
  ];

  const categoryLabels: Record<string, string> = {
    critico: 'Critico', alerta: 'Alerta', preocupante: 'Preocupante',
    rezagado: 'Rezagado', en_linea: 'En linea', destacado: 'Destacado', excepcional: 'Excepcional',
  };

  const catNum = metrics._categoria_num;
  const catName = catNum !== undefined ? categoryNames[catNum] : 'en_linea';

  return {
    nombre: recipient.nombre || '',
    tipo_usuario: recipient.tipo || '',
    solicitudes: metrics.solicitudes || 0,
    meta_solicitudes: metrics.meta_solicitudes || 0,
    pct_solicitudes: metrics.pct_solicitudes || 0,
    ventas: metrics.ventas || 0,
    meta_ventas: metrics.meta_ventas || 0,
    pct_ventas: metrics.pct_ventas || 0,
    ventas_avanzadas: metrics.ventas_avanzadas || 0,
    pct_ventas_avanzadas: metrics.pct_ventas_avanzadas || 0,
    categoria: categoryLabels[catName] || 'En linea',
    dias_restantes: metrics.dias_restantes || 0,
    progreso_esperado: metrics.progreso_esperado || 0,
    videollamadas_dia: metrics.videollamadas_dia || 0,
    videollamadas_semana: metrics.videollamadas_semana || 0,
  };
}

// ==========================================================================
// =               SLACK INTERACTIVITY HANDLER (BUTTONS)                    =
// ==========================================================================

export const handleSlackInteraction = functions.https.onRequest(
  async (req, res) => {
    try {
      // Slack sends interaction payloads as form-urlencoded with a "payload" field
      const rawPayload = req.body.payload;
      if (!rawPayload) {
        res.status(400).send('No payload');
        return;
      }

      const payload = JSON.parse(rawPayload);
      const { type } = payload;

      if (type === 'block_actions') {
        const userId = payload.user?.id;
        const channel = payload.channel?.id;
        const action = payload.actions?.[0];

        if (!action || !userId || !channel) {
          res.status(200).send('');
          return;
        }

        const actionId: string = action.action_id || '';

        // Find the sales user by Slack ID
        const salesUserSnapshot = await db
          .collection('sales_users')
          .where('slackUserId', '==', userId)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        const salesUser = salesUserSnapshot.empty
          ? null
          : { id: salesUserSnapshot.docs[0].id, ...salesUserSnapshot.docs[0].data() };

        const userName = (salesUser as any)?.nombre || payload.user?.name || 'Usuario';

        // Determine the workspace token for responding
        let responseToken: string | null = null;
        if (salesUser) {
          const workspaceId = (salesUser as any).workspaceId;
          if (workspaceId) {
            try {
              const { token } = await getSlackToken(workspaceId);
              responseToken = token;
            } catch (_e) {
              // Continue without response token
            }
          }
        }

        let responseText = '';

        // Handle feedback actions (feedback_*)
        if (actionId.startsWith('feedback_')) {
          const parts = actionId.split('_');
          const nivel = parts[parts.length - 1]; // excelente, regular, mal
          const tarjetaParts = parts.slice(1, -1);
          const tarjetaNombre = tarjetaParts.join(' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

          if (nivel === 'excelente') {
            responseText = `<@${userId}> ¡Fantástico ${userName}! ${tarjetaNombre} ejecutada a la perfección. Mantén esa energía para las siguientes tarjetas.`;
          } else if (nivel === 'regular') {
            responseText = `<@${userId}> ${userName}, ${tarjetaNombre} con resultado intermedio. Identifica qué ajustar para mejorar en la siguiente ejecución.`;
          } else if (nivel === 'mal') {
            responseText = `<@${userId}> ${userName}, ${tarjetaNombre} necesita ajustes. Revisa tu enfoque y aplica los tips específicos de esta tarjeta.`;
          } else {
            responseText = `<@${userId}> Feedback registrado para ${tarjetaNombre}. ¡Sigue mejorando!`;
          }

          // Save feedback to Firestore
          if (salesUser) {
            await db.collection('seguimientos_tarjeta').add({
              userId: salesUser.id,
              tarjetaNombre,
              fecha: admin.firestore.Timestamp.now(),
              feedback: nivel,
              createdAt: admin.firestore.Timestamp.now(),
            });
          }
        }

        // Handle tips actions (tips_*)
        else if (actionId.startsWith('tips_')) {
          const tarjetaParte = actionId.replace('tips_', '');
          const tipsMap: Record<string, string> = {
            'la_puerta': '🚪 *Tips La Puerta:*\n• Ubícate en zona de alta visibilidad\n• Saludo energético y sonrisa\n• Frase de apertura preparada\n• Postura corporal abierta',
            'el_pescado': '🐟 *Tips El Pescado:*\n• Pregunta directa y específica\n• Escucha activa de necesidades\n• Enfócate en el beneficio principal\n• Recupera con valor agregado',
            'el_folleto': '📄 *Tips El Folleto:*\n• Material visual atractivo\n• Explicación breve y clara\n• Solicita contacto inmediato\n• Seguimiento programado',
            'whatsapp': '📱 *Tips WhatsApp:*\n• Mensajes personalizados\n• Incluye nombre del cliente\n• Imagen/video relevante\n• Call-to-action claro',
            'el_rayo': '⚡ *Tips El Rayo:*\n• Urgencia sin presión\n• Beneficio inmediato\n• Cierre directo\n• 20-25% conversión esperada',
          };
          responseText = `<@${userId}> ${tipsMap[tarjetaParte] || '💡 Mantén enfoque, energía positiva y seguimiento constante.'}`;
        }

        // Handle progress view
        else if (actionId === 'ver_progreso_dia') {
          if (salesUser && (salesUser as any).hubspotOwnerId) {
            responseText = `<@${userId}> 📊 Consulta tu progreso detallado en la plataforma web de Ro-Bot.`;
          } else {
            responseText = `<@${userId}> 📊 Consulta tu progreso en la plataforma web.`;
          }
        }

        // Handle coaching request
        else if (actionId === 'request_coaching') {
          responseText = `<@${userId}> ✅ Solicitud de coaching enviada. Te contactaremos pronto.`;

          // Save coaching session
          if (salesUser) {
            await db.collection('coaching_sessions').add({
              userId: salesUser.id,
              workspaceId: (salesUser as any).workspaceId,
              tipo: 'solicitado',
              categoria: 'en_linea',
              metricas: { solicitudes: 0, ventas: 0, progreso: 0 },
              mensajeGenerado: `Solicitud de coaching de ${userName}`,
              resuelta: false,
              createdAt: admin.firestore.Timestamp.now(),
            });
          }
        }

        // Send response if we have a token
        if (responseText && responseToken) {
          const slackClient = new WebClient(responseToken);
          await slackClient.chat.postMessage({
            channel,
            text: responseText,
          });
        }
      }

      // Always respond with 200 to Slack
      res.status(200).send('');
    } catch (error: any) {
      console.error('Error handling Slack interaction:', error);
      res.status(200).send(''); // Always 200 for Slack
    }
  }
);

// ==========================================================================
// =                    READ GOOGLE SHEET                                    =
// ==========================================================================

export const readGoogleSheet = functions.https.onCall(
  async (data: {
    sheetId: string;
    range?: string;
    workspaceId: string;
  }, _context) => {
    try {
      const { sheetId, range, workspaceId } = data;

      // Get Google Sheets credentials from workspace settings
      const settingsSnapshot = await db
        .collection('workspace_settings')
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      let credentials: any = null;
      if (!settingsSnapshot.empty) {
        const settings = settingsSnapshot.docs[0].data();
        credentials = settings.googleSheetsCredentials;
      }

      if (!credentials) {
        // Try using default service account credentials (Firebase default)
        // Access via Google Sheets API with API key
        const apiKey = functions.config().google?.sheets_api_key || '';

        if (!apiKey) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'No Google Sheets credentials configured. Add API key in Settings > Integraciones.'
          );
        }

        const sheetRange = range || 'A:Z';
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetRange)}?key=${apiKey}`;
        const response = await axios.get(url);

        const rows = response.data.values || [];

        return {
          success: true,
          data: rows,
          rowCount: rows.length,
          headers: rows.length > 0 ? rows[0] : [],
        };
      }

      // Use service account credentials
      const { google } = require('googleapis');
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range || 'A:Z',
      });

      const rows = response.data.values || [];

      return {
        success: true,
        data: rows,
        rowCount: rows.length,
        headers: rows.length > 0 ? rows[0] : [],
      };
    } catch (error: any) {
      console.error('Error reading Google Sheet:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// ==========================================================================
// =            MANUAL CAMPAIGN TRIGGER (FOR TESTING)                       =
// ==========================================================================

export const triggerCampaign = functions.https.onCall(
  async (data: { campaignId: string }, _context) => {
    try {
      const { campaignId } = data;

      const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
      if (!campaignDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Campaign not found');
      }

      const campaign = campaignDoc.data()!;

      // Use first schedule slot or create a dummy one
      const slot = campaign.scheduleSlots?.[0] || { id: 'manual', time: 'manual' };

      await executeCampaign(campaignId, campaign, slot);

      return { success: true, message: `Campaign "${campaign.name}" triggered successfully` };
    } catch (error: any) {
      console.error('Error triggering campaign:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);
