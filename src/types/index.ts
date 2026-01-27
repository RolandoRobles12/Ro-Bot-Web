import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: Timestamp;
  lastLogin: Timestamp;
}

export interface SlackWorkspace {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  botToken?: string; // App bot token
  userTokens: UserToken[]; // Multiple user tokens for different senders
  webhookUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}

export interface UserToken {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  token: string;
  scopes: string[];
  addedAt: Timestamp;
  isDefault: boolean;
}

export interface HubSpotConnection {
  id: string;
  workspaceId?: string; // Optional: link to specific workspace
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  portalId: string;
  expiresAt?: Timestamp;
  scopes: string[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HubSpotVariable {
  name: string;
  label: string;
  type: 'contact' | 'company' | 'deal' | 'ticket' | 'custom';
  path: string; // e.g., "properties.firstname"
  example?: string;
}

export interface MessageTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  content: string; // Template with variables like {{contact.firstname}}
  blocks?: SlackBlock[]; // Slack Block Kit format
  variables: string[]; // Extracted variables from content
  hubspotVariables: HubSpotVariable[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  category?: string;
  tags?: string[];
}

export interface SlackBlock {
  type: string;
  [key: string]: any;
}

export interface MessageRecipient {
  type: 'channel' | 'user' | 'email';
  id?: string; // Slack channel or user ID
  name: string;
  email?: string;
}

export interface SenderConfig {
  type: 'bot' | 'user';
  userId?: string; // If type is 'user', which user token to use
  userName?: string;
}

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';

export interface RecurrenceConfig {
  type: RecurrenceType;
  cronExpression?: string;
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number;
  time?: string; // HH:mm format
  timezone?: string;
  endDate?: Timestamp;
}

export interface MessageRule {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CalculationType = 'sum' | 'average' | 'divide' | 'multiply' | 'subtract' | 'count';

export interface MetricCalculation {
  type: CalculationType;
  properties: string[]; // HubSpot properties to use in calculation
  label: string; // e.g., "Deal Conversion Rate"
  format?: 'number' | 'percentage' | 'currency';
}

export interface RuleCondition {
  type: 'hubspot_property' | 'time_based' | 'metric_calculation' | 'custom';
  property?: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
  secondValue?: any; // For "between" operator
  calculation?: MetricCalculation; // For metric-based conditions
}

export interface RuleAction {
  type: 'send_message' | 'update_hubspot' | 'webhook';
  templateId?: string;
  recipients?: MessageRecipient[];
  sender?: SenderConfig;
  webhookUrl?: string;
  customMessage?: string; // Override template with dynamic message
  includeMetrics?: boolean; // Include calculated metrics in message
}

export type MessageStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledMessage {
  id: string;
  workspaceId: string;
  templateId?: string;
  name: string;
  content: string;
  blocks?: SlackBlock[];
  recipients: MessageRecipient[];
  sender: SenderConfig;
  scheduledAt: Timestamp;
  recurrence?: RecurrenceConfig;
  status: MessageStatus;
  hubspotContext?: {
    contactId?: string;
    companyId?: string;
    dealId?: string;
    variables?: Record<string, any>;
  };
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastRun?: Timestamp;
  nextRun?: Timestamp;
  errorMessage?: string;
}

export interface MessageHistory {
  id: string;
  workspaceId: string;
  scheduledMessageId?: string;
  templateId?: string;
  content: string;
  blocks?: SlackBlock[];
  recipients: MessageRecipient[];
  sender: SenderConfig;
  sentAt: Timestamp;
  sentBy: string;
  status: 'sent' | 'failed';
  slackResponse?: any;
  errorMessage?: string;
  hubspotContext?: Record<string, any>;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email?: string;
  isBot: boolean;
  profileImage?: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  slackNotifications: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

export interface AppSettings {
  id: string;
  defaultWorkspaceId?: string;
  defaultSender?: SenderConfig;
  notifications: NotificationSettings;
  updatedAt: Timestamp;
}
