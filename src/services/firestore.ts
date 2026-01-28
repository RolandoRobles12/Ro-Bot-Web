import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryConstraint,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, usersDb } from '@/config/firebase';
import {
  User,
  SlackWorkspace,
  MessageTemplate,
  ScheduledMessage,
  MessageHistory,
  HubSpotConnection,
  MessageRule,
  SalesUser,
  MetricaDesempeno,
  TarjetaTactica,
  SeguimientoTarjeta,
  CoachingSession,
  MessageCampaign,
  CampaignExecution,
  CustomHubSpotProperty,
  WorkspaceSettings,
  Pipeline,
  DataSource,
} from '@/types';

// Generic Firestore helpers
export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as T) : null;
}

export async function getDocuments<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
}

export async function createDocument<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, 'id'>
): Promise<string> {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
}

export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
): Unsubscribe {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (snapshot) => {
    const data = snapshot.exists()
      ? ({ id: snapshot.id, ...snapshot.data() } as T)
      : null;
    callback(data);
  });
}

export function subscribeToCollection<T>(
  collectionName: string,
  callback: (data: T[]) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
    callback(data);
  });
}

// Helpers para Firestore externo (usuarios)
// Usan usersDb en lugar de db para permitir que los usuarios
// estén en un proyecto Firebase diferente
async function getUserDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const docRef = doc(usersDb, collectionName, docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as T) : null;
}

async function getUserDocuments<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(usersDb, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

async function createUserDocument<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, 'id'>
): Promise<string> {
  const docRef = await addDoc(collection(usersDb, collectionName), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

async function updateUserDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const docRef = doc(usersDb, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

async function deleteUserDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  const docRef = doc(usersDb, collectionName, docId);
  await deleteDoc(docRef);
}

function subscribeToUserDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
): Unsubscribe {
  const docRef = doc(usersDb, collectionName, docId);
  return onSnapshot(docRef, (snapshot) => {
    const data = snapshot.exists()
      ? ({ id: snapshot.id, ...snapshot.data() } as T)
      : null;
    callback(data);
  });
}

// Servicios de usuarios (usan usersDb - puede ser un proyecto Firebase externo)
export const userService = {
  get: (userId: string) => getUserDocument<User>('users', userId),
  getAll: () => getUserDocuments<User>('users'),
  create: (data: Omit<User, 'id'>) => createUserDocument<User>('users', data),
  update: (userId: string, data: Partial<User>) =>
    updateUserDocument('users', userId, data),
  delete: (userId: string) => deleteUserDocument('users', userId),
  subscribe: (userId: string, callback: (user: User | null) => void) =>
    subscribeToUserDocument<User>('users', userId, callback),
};

// Workspace services
export const workspaceService = {
  get: (workspaceId: string) =>
    getDocument<SlackWorkspace>('workspaces', workspaceId),
  getAll: () =>
    getDocuments<SlackWorkspace>('workspaces', where('isActive', '==', true)),
  create: (data: Omit<SlackWorkspace, 'id'>) =>
    createDocument<SlackWorkspace>('workspaces', data),
  update: (workspaceId: string, data: Partial<SlackWorkspace>) =>
    updateDocument('workspaces', workspaceId, data),
  delete: (workspaceId: string) => deleteDocument('workspaces', workspaceId),
  subscribe: (callback: (workspaces: SlackWorkspace[]) => void) =>
    subscribeToCollection<SlackWorkspace>(
      'workspaces',
      callback,
      where('isActive', '==', true)
    ),
};

// Template services
export const templateService = {
  get: (templateId: string) =>
    getDocument<MessageTemplate>('templates', templateId),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<MessageTemplate>(
      'templates',
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    ),
  getAll: () =>
    getDocuments<MessageTemplate>(
      'templates',
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    ),
  create: (data: Omit<MessageTemplate, 'id'>) =>
    createDocument<MessageTemplate>('templates', data),
  update: (templateId: string, data: Partial<MessageTemplate>) =>
    updateDocument('templates', templateId, data),
  delete: (templateId: string) => deleteDocument('templates', templateId),
  subscribe: (workspaceId: string, callback: (templates: MessageTemplate[]) => void) =>
    subscribeToCollection<MessageTemplate>(
      'templates',
      callback,
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    ),
};

// Scheduled message services
export const scheduledMessageService = {
  get: (messageId: string) =>
    getDocument<ScheduledMessage>('scheduled_messages', messageId),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<ScheduledMessage>(
      'scheduled_messages',
      where('workspaceId', '==', workspaceId),
      orderBy('scheduledAt', 'asc'),
      limit(100)
    ),
  getUpcoming: (workspaceId: string) =>
    getDocuments<ScheduledMessage>(
      'scheduled_messages',
      where('workspaceId', '==', workspaceId),
      where('status', '==', 'scheduled'),
      where('scheduledAt', '>', Timestamp.now()),
      orderBy('scheduledAt', 'asc'),
      limit(50)
    ),
  create: (data: Omit<ScheduledMessage, 'id'>) =>
    createDocument<ScheduledMessage>('scheduled_messages', data),
  update: (messageId: string, data: Partial<ScheduledMessage>) =>
    updateDocument('scheduled_messages', messageId, data),
  delete: (messageId: string) =>
    deleteDocument('scheduled_messages', messageId),
  subscribe: (
    workspaceId: string,
    callback: (messages: ScheduledMessage[]) => void
  ) =>
    subscribeToCollection<ScheduledMessage>(
      'scheduled_messages',
      callback,
      where('workspaceId', '==', workspaceId),
      orderBy('scheduledAt', 'asc'),
      limit(100)
    ),
};

// Message history services
export const messageHistoryService = {
  get: (historyId: string) =>
    getDocument<MessageHistory>('message_history', historyId),
  getByWorkspace: (workspaceId: string, limitCount = 100) =>
    getDocuments<MessageHistory>(
      'message_history',
      where('workspaceId', '==', workspaceId),
      orderBy('sentAt', 'desc'),
      limit(limitCount)
    ),
  create: (data: Omit<MessageHistory, 'id'>) =>
    createDocument<MessageHistory>('message_history', data),
  subscribe: (
    workspaceId: string,
    callback: (history: MessageHistory[]) => void,
    limitCount = 50
  ) =>
    subscribeToCollection<MessageHistory>(
      'message_history',
      callback,
      where('workspaceId', '==', workspaceId),
      orderBy('sentAt', 'desc'),
      limit(limitCount)
    ),
};

// HubSpot connection services
export const hubspotService = {
  get: (connectionId: string) =>
    getDocument<HubSpotConnection>('hubspot_connections', connectionId),
  getAll: () =>
    getDocuments<HubSpotConnection>(
      'hubspot_connections',
      where('isActive', '==', true)
    ),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<HubSpotConnection>(
      'hubspot_connections',
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true)
    ),
  create: (data: Omit<HubSpotConnection, 'id'>) =>
    createDocument<HubSpotConnection>('hubspot_connections', data),
  update: (connectionId: string, data: Partial<HubSpotConnection>) =>
    updateDocument('hubspot_connections', connectionId, data),
  delete: (connectionId: string) =>
    deleteDocument('hubspot_connections', connectionId),
};

// Rules services
export const ruleService = {
  get: (ruleId: string) => getDocument<MessageRule>('rules', ruleId),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<MessageRule>(
      'rules',
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    ),
  create: (data: Omit<MessageRule, 'id'>) =>
    createDocument<MessageRule>('rules', data),
  update: (ruleId: string, data: Partial<MessageRule>) =>
    updateDocument('rules', ruleId, data),
  delete: (ruleId: string) => deleteDocument('rules', ruleId),
  subscribe: (workspaceId: string, callback: (rules: MessageRule[]) => void) =>
    subscribeToCollection<MessageRule>(
      'rules',
      callback,
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    ),
};

// ==========================================================================
// =                     SALES COACHING SYSTEM SERVICES                     =
// ==========================================================================

// Sales User services
export const salesUserService = {
  get: (userId: string) => getDocument<SalesUser>('sales_users', userId),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<SalesUser>(
      'sales_users',
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('nombre', 'asc')
    ),
  getByType: (workspaceId: string, tipo: string) =>
    getDocuments<SalesUser>(
      'sales_users',
      where('workspaceId', '==', workspaceId),
      where('tipo', '==', tipo),
      where('isActive', '==', true),
      orderBy('nombre', 'asc')
    ),
  create: (data: Omit<SalesUser, 'id'>) =>
    createDocument<SalesUser>('sales_users', data),
  update: (userId: string, data: Partial<SalesUser>) =>
    updateDocument('sales_users', userId, data),
  delete: (userId: string) => deleteDocument('sales_users', userId),
  subscribe: (workspaceId: string, callback: (users: SalesUser[]) => void) =>
    subscribeToCollection<SalesUser>(
      'sales_users',
      callback,
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('nombre', 'asc')
    ),
};

// Metricas Desempeño services
export const metricasService = {
  get: (metricaId: string) =>
    getDocument<MetricaDesempeno>('metricas_desempeno', metricaId),
  getByUser: (userId: string, limitCount = 30) =>
    getDocuments<MetricaDesempeno>(
      'metricas_desempeno',
      where('userId', '==', userId),
      orderBy('fecha', 'desc'),
      limit(limitCount)
    ),
  getByUserDateRange: (userId: string, startDate: Timestamp, endDate: Timestamp) =>
    getDocuments<MetricaDesempeno>(
      'metricas_desempeno',
      where('userId', '==', userId),
      where('fecha', '>=', startDate),
      where('fecha', '<=', endDate),
      orderBy('fecha', 'desc')
    ),
  getByWorkspace: (workspaceId: string, limitCount = 100) =>
    getDocuments<MetricaDesempeno>(
      'metricas_desempeno',
      where('workspaceId', '==', workspaceId),
      orderBy('fecha', 'desc'),
      limit(limitCount)
    ),
  create: (data: Omit<MetricaDesempeno, 'id'>) =>
    createDocument<MetricaDesempeno>('metricas_desempeno', data),
  update: (metricaId: string, data: Partial<MetricaDesempeno>) =>
    updateDocument('metricas_desempeno', metricaId, data),
  subscribe: (userId: string, callback: (metricas: MetricaDesempeno[]) => void) =>
    subscribeToCollection<MetricaDesempeno>(
      'metricas_desempeno',
      callback,
      where('userId', '==', userId),
      orderBy('fecha', 'desc'),
      limit(30)
    ),
};

// Tarjetas Tacticas services
export const tarjetaTacticaService = {
  get: (tarjetaId: string) =>
    getDocument<TarjetaTactica>('tarjetas_tacticas', tarjetaId),
  getAll: () =>
    getDocuments<TarjetaTactica>(
      'tarjetas_tacticas',
      where('isActive', '==', true),
      orderBy('numero', 'asc')
    ),
  create: (data: Omit<TarjetaTactica, 'id'>) =>
    createDocument<TarjetaTactica>('tarjetas_tacticas', data),
  update: (tarjetaId: string, data: Partial<TarjetaTactica>) =>
    updateDocument('tarjetas_tacticas', tarjetaId, data),
};

// Seguimiento Tarjeta services
export const seguimientoTarjetaService = {
  get: (seguimientoId: string) =>
    getDocument<SeguimientoTarjeta>('seguimientos_tarjeta', seguimientoId),
  getByUser: (userId: string, limitCount = 50) =>
    getDocuments<SeguimientoTarjeta>(
      'seguimientos_tarjeta',
      where('userId', '==', userId),
      orderBy('fecha', 'desc'),
      limit(limitCount)
    ),
  getByUserToday: (userId: string, startOfDay: Timestamp) =>
    getDocuments<SeguimientoTarjeta>(
      'seguimientos_tarjeta',
      where('userId', '==', userId),
      where('fecha', '>=', startOfDay),
      orderBy('fecha', 'desc')
    ),
  create: (data: Omit<SeguimientoTarjeta, 'id'>) =>
    createDocument<SeguimientoTarjeta>('seguimientos_tarjeta', data),
  update: (seguimientoId: string, data: Partial<SeguimientoTarjeta>) =>
    updateDocument('seguimientos_tarjeta', seguimientoId, data),
};

// Coaching Session services
export const coachingSessionService = {
  get: (sessionId: string) =>
    getDocument<CoachingSession>('coaching_sessions', sessionId),
  getByUser: (userId: string) =>
    getDocuments<CoachingSession>(
      'coaching_sessions',
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    ),
  getByWorkspace: (workspaceId: string, includeResolved = false) => {
    const constraints: QueryConstraint[] = [
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc'),
      limit(100),
    ];
    if (!includeResolved) {
      constraints.splice(1, 0, where('resuelta', '==', false));
    }
    return getDocuments<CoachingSession>('coaching_sessions', ...constraints);
  },
  create: (data: Omit<CoachingSession, 'id'>) =>
    createDocument<CoachingSession>('coaching_sessions', data),
  update: (sessionId: string, data: Partial<CoachingSession>) =>
    updateDocument('coaching_sessions', sessionId, data),
  subscribe: (
    workspaceId: string,
    callback: (sessions: CoachingSession[]) => void
  ) =>
    subscribeToCollection<CoachingSession>(
      'coaching_sessions',
      callback,
      where('workspaceId', '==', workspaceId),
      where('resuelta', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50)
    ),
};

// ==========================================================================
// =                  NO-CODE MESSAGE SCHEDULER SERVICES                    =
// ==========================================================================

// Campaign services
export const campaignService = {
  get: (campaignId: string) =>
    getDocument<MessageCampaign>('campaigns', campaignId),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<MessageCampaign>(
      'campaigns',
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    ),
  getActive: (workspaceId: string) =>
    getDocuments<MessageCampaign>(
      'campaigns',
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    ),
  create: (data: Omit<MessageCampaign, 'id'>) =>
    createDocument<MessageCampaign>('campaigns', data),
  update: (campaignId: string, data: Partial<MessageCampaign>) =>
    updateDocument('campaigns', campaignId, data),
  delete: (campaignId: string) => deleteDocument('campaigns', campaignId),
  subscribe: (
    workspaceId: string,
    callback: (campaigns: MessageCampaign[]) => void
  ) =>
    subscribeToCollection<MessageCampaign>(
      'campaigns',
      callback,
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    ),
};

// Campaign Execution services
export const campaignExecutionService = {
  get: (executionId: string) =>
    getDocument<CampaignExecution>('campaign_executions', executionId),
  getByCampaign: (campaignId: string, limitCount = 50) =>
    getDocuments<CampaignExecution>(
      'campaign_executions',
      where('campaignId', '==', campaignId),
      orderBy('executedAt', 'desc'),
      limit(limitCount)
    ),
  getByWorkspace: (workspaceId: string, limitCount = 100) =>
    getDocuments<CampaignExecution>(
      'campaign_executions',
      where('workspaceId', '==', workspaceId),
      orderBy('executedAt', 'desc'),
      limit(limitCount)
    ),
  create: (data: Omit<CampaignExecution, 'id'>) =>
    createDocument<CampaignExecution>('campaign_executions', data),
  subscribe: (
    campaignId: string,
    callback: (executions: CampaignExecution[]) => void,
    limitCount = 20
  ) =>
    subscribeToCollection<CampaignExecution>(
      'campaign_executions',
      callback,
      where('campaignId', '==', campaignId),
      orderBy('executedAt', 'desc'),
      limit(limitCount)
    ),
};

// ==========================================================================
// =                       SETTINGS SERVICES                                 =
// ==========================================================================

// Custom HubSpot Property services
export const hubspotPropertyService = {
  get: (propertyId: string) =>
    getDocument<CustomHubSpotProperty>('hubspot_properties', propertyId),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<CustomHubSpotProperty>(
      'hubspot_properties',
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('category', 'asc'),
      orderBy('label', 'asc')
    ),
  getAll: () =>
    getDocuments<CustomHubSpotProperty>(
      'hubspot_properties',
      where('isActive', '==', true),
      orderBy('category', 'asc'),
      orderBy('label', 'asc')
    ),
  create: (data: Omit<CustomHubSpotProperty, 'id'>) =>
    createDocument<CustomHubSpotProperty>('hubspot_properties', data),
  update: (propertyId: string, data: Partial<CustomHubSpotProperty>) =>
    updateDocument('hubspot_properties', propertyId, data),
  delete: (propertyId: string) =>
    deleteDocument('hubspot_properties', propertyId),
  subscribe: (
    workspaceId: string,
    callback: (properties: CustomHubSpotProperty[]) => void
  ) =>
    subscribeToCollection<CustomHubSpotProperty>(
      'hubspot_properties',
      callback,
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('category', 'asc')
    ),
};

// Workspace Settings services
export const workspaceSettingsService = {
  get: (workspaceId: string) =>
    getDocument<WorkspaceSettings>('workspace_settings', workspaceId),
  getByWorkspace: async (workspaceId: string): Promise<WorkspaceSettings | null> => {
    const results = await getDocuments<WorkspaceSettings>(
      'workspace_settings',
      where('workspaceId', '==', workspaceId),
      limit(1)
    );
    return results.length > 0 ? results[0] : null;
  },
  create: (data: Omit<WorkspaceSettings, 'id'>) =>
    createDocument<WorkspaceSettings>('workspace_settings', data),
  update: (settingsId: string, data: Partial<WorkspaceSettings>) =>
    updateDocument('workspace_settings', settingsId, data),
  upsert: async (workspaceId: string, data: Partial<WorkspaceSettings>) => {
    const existing = await getDocuments<WorkspaceSettings>(
      'workspace_settings',
      where('workspaceId', '==', workspaceId),
      limit(1)
    );
    if (existing.length > 0) {
      await updateDocument('workspace_settings', existing[0].id, data);
      return existing[0].id;
    } else {
      return createDocument<WorkspaceSettings>('workspace_settings', {
        workspaceId,
        notifyOnCampaignSuccess: false,
        notifyOnCampaignFailure: true,
        timezone: 'America/Mexico_City',
        weekStartsOn: 1,
        ...data,
      } as Omit<WorkspaceSettings, 'id'>);
    }
  },
  subscribe: (workspaceId: string, callback: (settings: WorkspaceSettings | null) => void) => {
    const q = query(
      collection(db, 'workspace_settings'),
      where('workspaceId', '==', workspaceId),
      limit(1)
    );
    return onSnapshot(q, (snapshot) => {
      if (snapshot.docs.length > 0) {
        const doc = snapshot.docs[0];
        callback({ id: doc.id, ...doc.data() } as WorkspaceSettings);
      } else {
        callback(null);
      }
    });
  },
};

// Pipeline services
export const pipelineService = {
  get: (pipelineId: string) =>
    getDocument<Pipeline>('pipelines', pipelineId),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<Pipeline>(
      'pipelines',
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    ),
  getAll: () =>
    getDocuments<Pipeline>(
      'pipelines',
      where('isActive', '==', true),
      orderBy('name', 'asc')
    ),
  create: (data: Omit<Pipeline, 'id'>) =>
    createDocument<Pipeline>('pipelines', data),
  update: (pipelineId: string, data: Partial<Pipeline>) =>
    updateDocument('pipelines', pipelineId, data),
  delete: (pipelineId: string) =>
    deleteDocument('pipelines', pipelineId),
  subscribe: (
    workspaceId: string,
    callback: (pipelines: Pipeline[]) => void
  ) =>
    subscribeToCollection<Pipeline>(
      'pipelines',
      callback,
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    ),
};

// DataSource services
export const dataSourceService = {
  get: (dataSourceId: string) =>
    getDocument<DataSource>('data_sources', dataSourceId),
  getByWorkspace: (workspaceId: string) =>
    getDocuments<DataSource>(
      'data_sources',
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    ),
  getByType: (workspaceId: string, type: string) =>
    getDocuments<DataSource>(
      'data_sources',
      where('workspaceId', '==', workspaceId),
      where('type', '==', type),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    ),
  getAll: () =>
    getDocuments<DataSource>(
      'data_sources',
      where('isActive', '==', true),
      orderBy('name', 'asc')
    ),
  create: (data: Omit<DataSource, 'id'>) =>
    createDocument<DataSource>('data_sources', data),
  update: (dataSourceId: string, data: Partial<DataSource>) =>
    updateDocument('data_sources', dataSourceId, data),
  delete: (dataSourceId: string) =>
    deleteDocument('data_sources', dataSourceId),
  subscribe: (
    workspaceId: string,
    callback: (dataSources: DataSource[]) => void
  ) =>
    subscribeToCollection<DataSource>(
      'data_sources',
      callback,
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    ),
};
