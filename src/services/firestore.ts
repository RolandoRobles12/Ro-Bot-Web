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
import { db } from '@/config/firebase';
import {
  User,
  SlackWorkspace,
  MessageTemplate,
  ScheduledMessage,
  MessageHistory,
  HubSpotConnection,
  MessageRule,
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

// User services
export const userService = {
  get: (userId: string) => getDocument<User>('users', userId),
  getAll: () => getDocuments<User>('users'),
  create: (data: Omit<User, 'id'>) => createDocument<User>('users', data),
  update: (userId: string, data: Partial<User>) =>
    updateDocument('users', userId, data),
  delete: (userId: string) => deleteDocument('users', userId),
  subscribe: (userId: string, callback: (user: User | null) => void) =>
    subscribeToDocument<User>('users', userId, callback),
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
