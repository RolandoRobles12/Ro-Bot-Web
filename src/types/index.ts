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

// ==========================================================================
// =                     SALES COACHING SYSTEM TYPES                        =
// ==========================================================================

export type SalesUserType = 'kiosco' | 'atn' | 'ba' | 'alianza';

export type CategoriaDesempeno =
  | 'critico'      // 0 - Desempeño crítico, requiere intervención inmediata
  | 'alerta'       // 1 - Alerta, muy por debajo del objetivo
  | 'preocupante'  // 2 - Preocupante, necesita mejorar
  | 'rezagado'     // 3 - Rezagado, ligeramente por debajo
  | 'en_linea'     // 4 - En línea con objetivos
  | 'destacado'    // 5 - Destacado, por encima del objetivo
  | 'excepcional'; // 6 - Excepcional, muy por encima

export interface SalesUser {
  id: string;
  workspaceId: string;
  nombre: string;
  tipo: SalesUserType;
  hubspotOwnerId: string;
  slackUserId: string;
  slackChannel: string;
  metaSolicitudes: number;      // Meta semanal de solicitudes
  metaVentas: number;           // Meta semanal de ventas en pesos
  pipeline?: string;            // HubSpot pipeline ID (default o específico)
  equipo?: string;              // Para kioscos: nombre del equipo
  gerenteId?: string;           // Para kioscos: ID del gerente
  promotores?: string[];        // Para kioscos: IDs de promotores
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MetricaDesempeno {
  id: string;
  userId: string;
  workspaceId: string;
  fecha: Timestamp;             // Fecha del cálculo
  periodoInicio: Timestamp;     // Inicio del período (semana)
  periodoFin: Timestamp;        // Fin del período (semana)
  solicitudes: number;          // Total de solicitudes creadas
  ventasAvanzadas: number;      // Ventas en etapas avanzadas
  ventasReales: number;         // Ventas formalizadas (desembolsadas)
  progresoSolicitudes: number;  // % de avance vs meta
  progresoVentas: number;       // % de avance vs meta
  progresoEsperado: number;     // % esperado según día de la semana
  categoria: CategoriaDesempeno;
  mensajeGenerado?: string;     // Mensaje personalizado por IA
  notificacionEnviada: boolean;
  createdAt: Timestamp;
}

export interface TarjetaTactica {
  id: string;
  numero: number;
  nombre: string;
  emoji: string;
  horarioInicio: string;        // HH:mm
  horarioFin: string;           // HH:mm
  horarioSeguimiento: string;   // HH:mm - cuando se envía el seguimiento
  bloque: 'matutino' | 'vespertino' | 'apoyo';
  objetivo: string;
  metaAbordados?: number;
  metaLeads?: number;
  metaVideollamadas?: number;
  descripcion: string;
  isActive: boolean;
}

export interface SeguimientoTarjeta {
  id: string;
  userId: string;              // SalesUser BA
  tarjetaId: string;           // TarjetaTactica
  fecha: Timestamp;
  videollamadasDia: number;
  videollamadaSemana: number;
  feedback?: 'excelente' | 'regular' | 'mal';
  notas?: string;
  mensajeEnviado: boolean;
  createdAt: Timestamp;
}

export interface CoachingSession {
  id: string;
  userId: string;
  workspaceId: string;
  tipo: 'automatico' | 'solicitado' | 'programado';
  categoria: CategoriaDesempeno;
  metricas: {
    solicitudes: number;
    ventas: number;
    progreso: number;
  };
  mensajeGenerado: string;
  respuestaUsuario?: string;
  coachId?: string;            // Usuario que atendió (si aplica)
  resuelta: boolean;
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}

// ==========================================================================
// =                  NO-CODE MESSAGE SCHEDULER TYPES                       =
// ==========================================================================

/**
 * A time slot within a campaign schedule.
 * Defines specific days and time when messages should be sent.
 */
export interface CampaignScheduleSlot {
  id: string;
  daysOfWeek: number[];       // 0=Domingo, 1=Lunes, ..., 6=Sábado
  time: string;               // HH:mm format
  timezone: string;           // e.g., 'America/Mexico_City'
  label?: string;             // e.g., "Reporte matutino"
}

/**
 * How recipients are selected for a campaign.
 */
export type RecipientSourceType =
  | 'sales_user_type'         // Filter by SalesUser type (kiosco, atn, ba, alianza)
  | 'specific_users'          // Specific SalesUser IDs
  | 'channel';                // Specific Slack channel IDs

export interface CampaignRecipientConfig {
  sourceType: RecipientSourceType;
  salesUserTypes?: SalesUserType[];   // For 'sales_user_type'
  specificUserIds?: string[];         // For 'specific_users'
  channelIds?: string[];              // For 'channel'
  channelNames?: string[];            // Display names for channels
}

/**
 * A message variant with optional conditions.
 * Variants are evaluated in priority order; the first matching variant is used.
 * A variant with conditionType='always' serves as the default/fallback.
 */
export interface MessageVariant {
  id: string;
  label: string;                      // Descriptive name, e.g., "Desempeño crítico"
  conditionType: 'always' | 'performance_category' | 'metric_threshold';
  // For 'performance_category'
  performanceCategories?: CategoriaDesempeno[];
  // For 'metric_threshold'
  metricField?: string;               // e.g., 'pct_ventas', 'solicitudes'
  metricOperator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'between';
  metricValue?: number;
  metricValueEnd?: number;            // For 'between'
  // Message content
  messageTemplate: string;            // Template with {{variables}}
  priority: number;                   // Lower = higher priority
}

/**
 * AI configuration for a campaign.
 * When enabled, AI rewrites or generates messages based on the template.
 */
export interface CampaignAIConfig {
  enabled: boolean;
  systemPrompt?: string;              // System prompt for AI
  temperature?: number;               // 0.0 - 1.0
  maxTokens?: number;
  rewriteMode: 'rewrite' | 'generate';
  // 'rewrite' = AI rewrites the template (keeps structure, adds variation)
  // 'generate' = AI creates message from scratch using template as context
}

/**
 * Data source configuration for a campaign.
 * Defines what HubSpot metrics to fetch for each recipient.
 */
export interface CampaignDataConfig {
  fetchSolicitudes: boolean;
  fetchVentasAvanzadas: boolean;
  fetchVentasReales: boolean;
  fetchVideollamadas: boolean;        // For BAs
  calculatePerformanceCategory: boolean;
  dateRange: 'current_week' | 'last_week' | 'current_month' | 'today';
  customPipeline?: string;            // Override pipeline ID
  customStages?: string[];            // Override advanced stage IDs
}

/**
 * Top-level campaign entity.
 * Represents a complete no-code message schedule that can be
 * created, configured, and activated by any admin/editor.
 *
 * Available template variables:
 *   {{nombre}}              - User name
 *   {{solicitudes}}         - Current solicitudes count
 *   {{meta_solicitudes}}    - Solicitudes goal
 *   {{pct_solicitudes}}     - % of solicitudes goal
 *   {{ventas}}              - Current sales amount (formatted)
 *   {{meta_ventas}}         - Sales goal (formatted)
 *   {{pct_ventas}}          - % of sales goal
 *   {{ventas_avanzadas}}    - Advanced sales amount
 *   {{pct_ventas_avanzadas}}- % of advanced sales goal
 *   {{categoria}}           - Performance category name
 *   {{dias_restantes}}      - Days remaining in period
 *   {{progreso_esperado}}   - Expected progress %
 *   {{tipo_usuario}}        - User type (kiosco, atn, ba, alianza)
 *   {{videollamadas_dia}}   - Video calls today (BAs)
 *   {{videollamadas_semana}}- Video calls this week (BAs)
 */
export interface MessageCampaign {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;

  // Schedule
  scheduleSlots: CampaignScheduleSlot[];

  // Recipients
  recipientConfig: CampaignRecipientConfig;

  // Message
  messageVariants: MessageVariant[];
  mentionUser?: boolean;              // Mention user with @ in Slack

  // AI (optional)
  aiConfig?: CampaignAIConfig;

  // Data source (optional - for metric-driven messages)
  dataConfig?: CampaignDataConfig;

  // Status
  isActive: boolean;
  lastExecuted?: Timestamp;
  nextExecution?: Timestamp;
  executionCount: number;

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Log entry for a campaign execution.
 */
export interface CampaignExecution {
  id: string;
  campaignId: string;
  campaignName: string;
  workspaceId: string;
  executedAt: Timestamp;
  scheduleSlotId?: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  details: CampaignExecutionDetail[];
}

export interface CampaignExecutionDetail {
  userId: string;
  userName: string;
  channel: string;
  status: 'sent' | 'failed';
  messageSent: string;
  variantUsed?: string;               // MessageVariant.id
  errorMessage?: string;
  metrics?: Record<string, number>;
}
