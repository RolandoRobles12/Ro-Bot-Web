import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit2,
  Power,
  Clock,
  Users,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Copy,
  Calendar,
  Sparkles,
  Database,
  Eye,
  History,
  AlertTriangle,
  Info,
  X,
  Search,
  Hash,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileBarChart2,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import {
  campaignService,
  campaignExecutionService,
  externalUserService,
  dataSourceService,
  positionService,
} from '@/services/firestore';
import type {
  MessageCampaign,
  CampaignExecution,
  CampaignScheduleSlot,
  CampaignRecipientConfig,
  MessageVariant,
  CampaignAIConfig,
  CampaignDataConfig,
  RecipientSourceType,
  SalesUserType,
  CategoriaDesempeno,
  ExternalUser,
  DataSource,
  Position,
  MessageAttachment,
} from '@/types';
import { FileUpload } from '@/components/ui/FileUpload';

// ==========================================================================
// Constants
// ==========================================================================

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Lun', fullLabel: 'Lunes' },
  { value: 2, label: 'Mar', fullLabel: 'Martes' },
  { value: 3, label: 'Mié', fullLabel: 'Miércoles' },
  { value: 4, label: 'Jue', fullLabel: 'Jueves' },
  { value: 5, label: 'Vie', fullLabel: 'Viernes' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];


const PERFORMANCE_CATEGORIES: { value: CategoriaDesempeno; label: string; emoji: string; color: string }[] = [
  { value: 'critico', label: 'Crítico', emoji: '🚨', color: 'bg-red-100 text-red-800' },
  { value: 'alerta', label: 'Alerta', emoji: '⚠️', color: 'bg-orange-100 text-orange-800' },
  { value: 'preocupante', label: 'Preocupante', emoji: '🎯', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'rezagado', label: 'Rezagado', emoji: '⚡', color: 'bg-amber-100 text-amber-800' },
  { value: 'en_linea', label: 'En línea', emoji: '💪', color: 'bg-blue-100 text-blue-800' },
  { value: 'destacado', label: 'Destacado', emoji: '🔥', color: 'bg-green-100 text-green-800' },
  { value: 'excepcional', label: 'Excepcional', emoji: '🚀', color: 'bg-purple-100 text-purple-800' },
];

const METRIC_FIELDS = [
  { value: 'pct_ventas', label: '% Ventas vs Meta' },
  { value: 'pct_solicitudes', label: '% Solicitudes vs Meta' },
  { value: 'solicitudes', label: 'Solicitudes (cantidad)' },
  { value: 'ventas', label: 'Ventas (monto)' },
  { value: 'pct_ventas_avanzadas', label: '% Ventas Avanzadas vs Meta' },
  { value: 'videollamadas_dia', label: 'Videollamadas del día' },
  { value: 'videollamadas_semana', label: 'Videollamadas de la semana' },
  { value: 'progreso_esperado', label: 'Progreso esperado (%)' },
];

const METRIC_OPERATORS = [
  { value: 'gt', label: 'Mayor que' },
  { value: 'gte', label: 'Mayor o igual que' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor o igual que' },
  { value: 'eq', label: 'Igual a' },
  { value: 'between', label: 'Entre' },
];

// Variables are categorized by what data config enables them
const TEMPLATE_VARIABLES = [
  // Always available
  { name: 'nombre', description: 'Nombre del vendedor', requires: null },
  { name: 'tipo_usuario', description: 'Tipo de vendedor', requires: null },
  { name: 'dias_restantes', description: 'Días restantes del período', requires: null },
  { name: 'progreso_esperado', description: '% progreso esperado', requires: null },
  // Require fetchSolicitudes
  { name: 'solicitudes', description: 'Solicitudes actuales', requires: 'fetchSolicitudes' },
  { name: 'meta_solicitudes', description: 'Meta de solicitudes', requires: 'fetchSolicitudes' },
  { name: 'pct_solicitudes', description: '% avance solicitudes', requires: 'fetchSolicitudes' },
  // Require fetchVentasReales or fetchVentasAvanzadas
  { name: 'ventas', description: 'Monto de ventas ($)', requires: 'fetchVentasReales' },
  { name: 'meta_ventas', description: 'Meta de ventas ($)', requires: 'fetchVentasReales' },
  { name: 'pct_ventas', description: '% avance ventas', requires: 'fetchVentasReales' },
  { name: 'ventas_avanzadas', description: 'Ventas en proceso ($)', requires: 'fetchVentasAvanzadas' },
  { name: 'pct_ventas_avanzadas', description: '% ventas en proceso', requires: 'fetchVentasAvanzadas' },
  // Require calculatePerformanceCategory
  { name: 'categoria', description: 'Categoría de desempeño', requires: 'calculatePerformanceCategory' },
  // Require fetchVideollamadas
  { name: 'videollamadas_dia', description: 'Videollamadas hoy (BAs)', requires: 'fetchVideollamadas' },
  { name: 'videollamadas_semana', description: 'Videollamadas semana (BAs)', requires: 'fetchVideollamadas' },
];

// Steps: reordered so Datos comes before Mensaje
const WIZARD_STEPS = [
  { id: 'basics', label: 'Información', icon: Info },
  { id: 'recipients', label: 'Destinatarios', icon: Users },
  { id: 'schedule', label: 'Horario', icon: Clock },
  { id: 'data', label: 'Datos', icon: Database },
  { id: 'message', label: 'Mensaje', icon: MessageSquare },
  { id: 'review', label: 'Revisar', icon: Eye },
];

// Presets que pre-configuran la campaña para casos de uso comunes
const CAMPAIGN_PRESETS = [
  {
    id: 'reporte_semanal',
    label: 'Reporte Semanal',
    emoji: '📊',
    description: 'Métricas de solicitudes y ventas vs meta, con categoría de desempeño',
    color: 'border-blue-200 bg-blue-50 hover:border-blue-400',
    activeColor: 'border-blue-500 bg-blue-100',
    defaults: {
      name: 'Reporte Semanal de Métricas',
      recipientConfig: { sourceType: 'sales_user_type' as RecipientSourceType, salesUserTypes: [] as SalesUserType[] },
      scheduleSlots: [{ id: 'preset-slot-1', daysOfWeek: [1], time: '09:00', timezone: 'America/Mexico_City', label: 'Lunes matutino' }],
      dataConfig: { fetchSolicitudes: true, fetchVentasAvanzadas: false, fetchVentasReales: true, fetchVideollamadas: false, calculatePerformanceCategory: true, dateRange: 'current_week' as const },
      messageVariants: [
        { id: 'v1', label: 'Crítico/Alerta', conditionType: 'performance_category' as const, performanceCategories: ['critico', 'alerta'] as CategoriaDesempeno[], messageTemplate: '🚨 *{{nombre}}* — semana complicada. Solicitudes: {{solicitudes}}/{{meta_solicitudes}} ({{pct_solicitudes}}%). Ventas: ${{ventas}} de ${{meta_ventas}} meta ({{pct_ventas}}%). Quedan {{dias_restantes}} días, ¡podemos revertirlo!', priority: 1 },
        { id: 'v2', label: 'En línea/Destacado', conditionType: 'performance_category' as const, performanceCategories: ['en_linea', 'destacado', 'excepcional'] as CategoriaDesempeno[], messageTemplate: '💪 *{{nombre}}* — ¡buen ritmo! Solicitudes: {{solicitudes}}/{{meta_solicitudes}} ({{pct_solicitudes}}%). Ventas: ${{ventas}} de ${{meta_ventas}} ({{pct_ventas}}%). Progreso esperado: {{progreso_esperado}}%. ¡Sigue así!', priority: 2 },
        { id: 'v3', label: 'Default', conditionType: 'always' as const, messageTemplate: '📈 *{{nombre}}* — actualización de métricas. Solicitudes: {{solicitudes}}/{{meta_solicitudes}} ({{pct_solicitudes}}%). Ventas: ${{ventas}} de ${{meta_ventas}} ({{pct_ventas}}%). Categoría: {{categoria}}.', priority: 999 },
      ],
    },
  },
  {
    id: 'tarjeta_tactica',
    label: 'Tarjeta Táctica BA',
    emoji: '🎯',
    description: 'Seguimiento de actividad diaria para Embajadores con botones de feedback',
    color: 'border-purple-200 bg-purple-50 hover:border-purple-400',
    activeColor: 'border-purple-500 bg-purple-100',
    defaults: {
      name: 'Seguimiento Tarjeta Táctica',
      campaignType: 'tarjeta_tactica' as const,
      tarjetaNombre: 'La Puerta',
      recipientConfig: { sourceType: 'sales_user_type' as RecipientSourceType, salesUserTypes: [] as SalesUserType[] },
      scheduleSlots: [{ id: 'preset-slot-2', daysOfWeek: [1, 2, 3, 4, 5], time: '11:15', timezone: 'America/Mexico_City', label: 'Seguimiento La Puerta' }],
      dataConfig: { fetchSolicitudes: false, fetchVentasAvanzadas: false, fetchVentasReales: false, fetchVideollamadas: true, calculatePerformanceCategory: false, dateRange: 'today' as const },
    },
  },
  {
    id: 'coaching',
    label: 'Alerta de Coaching',
    emoji: '🚨',
    description: 'Mensaje enfocado a vendedores con bajo desempeño para activar coaching',
    color: 'border-red-200 bg-red-50 hover:border-red-400',
    activeColor: 'border-red-500 bg-red-100',
    defaults: {
      name: 'Alerta de Coaching — Bajo Desempeño',
      recipientConfig: { sourceType: 'sales_user_type' as RecipientSourceType, salesUserTypes: [] as SalesUserType[] },
      scheduleSlots: [{ id: 'preset-slot-3', daysOfWeek: [3], time: '14:00', timezone: 'America/Mexico_City', label: 'Miércoles revisión' }],
      dataConfig: { fetchSolicitudes: true, fetchVentasReales: true, fetchVentasAvanzadas: false, fetchVideollamadas: false, calculatePerformanceCategory: true, dateRange: 'current_week' as const },
      messageVariants: [
        { id: 'v1', label: 'Coaching requerido', conditionType: 'performance_category' as const, performanceCategories: ['critico', 'alerta', 'preocupante'] as CategoriaDesempeno[], messageTemplate: '🚨 *{{nombre}}*, estamos a {{dias_restantes}} días del cierre de semana y las métricas muestran que necesitas apoyo. Solicitudes: {{solicitudes}}/{{meta_solicitudes}}, Ventas: ${{ventas}} de ${{meta_ventas}}. Tu gerente te contactará hoy. ¿Puedes confirmar disponibilidad en los próximos 30 min?', priority: 1 },
        { id: 'v2', label: 'Sin acción necesaria', conditionType: 'always' as const, messageTemplate: '✅ *{{nombre}}* — siguiendo el plan, sin alertas esta semana.', priority: 999 },
      ],
    },
  },
  {
    id: 'personalizado',
    label: 'Personalizado',
    emoji: '✏️',
    description: 'Construye tu campaña desde cero con control total',
    color: 'border-gray-200 bg-gray-50 hover:border-gray-400',
    activeColor: 'border-gray-400 bg-gray-100',
    defaults: {},
  },
];

// ==========================================================================
// Types for Slack data
// ==========================================================================

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email?: string;
  profileImage?: string;
}

// ==========================================================================
// Helper functions
// ==========================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function formatScheduleSummary(slots: CampaignScheduleSlot[]): string {
  if (slots.length === 0) return 'Sin horario';
  const times = [...new Set(slots.map((s) => s.time))].sort();
  const allDays = new Set(slots.flatMap((s) => s.daysOfWeek));
  const dayNames = DAYS_OF_WEEK.filter((d) => allDays.has(d.value))
    .map((d) => d.label)
    .join(', ');
  return `${dayNames} a las ${times.join(', ')}`;
}

function formatRecipientSummary(config: CampaignRecipientConfig): string {
  if (config.sourceType === 'sales_user_type' && config.salesUserTypes?.length) {
    return config.salesUserTypes.join(', ');
  }
  if (config.sourceType === 'specific_users' && config.specificUserIds?.length) {
    return `${config.specificUserIds.length} usuario(s)`;
  }
  if (config.sourceType === 'channel' && config.channelIds?.length) {
    const names = config.channelNames?.length
      ? config.channelNames.join(', ')
      : `${config.channelIds.length} canal(es)`;
    return names;
  }
  return 'Sin destinatarios';
}

function getAvailableVariables(dataConfig?: CampaignDataConfig) {
  return TEMPLATE_VARIABLES.filter((v) => {
    if (!v.requires) return true;
    if (!dataConfig) return false;
    return dataConfig[v.requires as keyof CampaignDataConfig] === true;
  });
}

// ==========================================================================
// Default values
// ==========================================================================

function createDefaultCampaign(): Omit<MessageCampaign, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> {
  return {
    workspaceId: '',
    name: '',
    description: '',
    scheduleSlots: [],
    recipientConfig: {
      sourceType: 'sales_user_type',
      salesUserTypes: [],
    },
    messageVariants: [
      {
        id: generateId(),
        label: 'Mensaje por defecto',
        conditionType: 'always',
        messageTemplate: '',
        priority: 999,
      },
    ],
    mentionUser: false,
    aiConfig: {
      enabled: false,
      systemPrompt:
        'Eres un asistente de ventas en español que escribe mensajes en un solo párrafo corto, usando "tú" (informal), sin cambiar los datos numéricos. Sé directo, informativo y motivador, usando máximo 2 emojis.',
      temperature: 0.7,
      maxTokens: 120,
      rewriteMode: 'rewrite',
    },
    dataConfig: {
      fetchSolicitudes: false,
      fetchVentasAvanzadas: false,
      fetchVentasReales: false,
      fetchVideollamadas: false,
      calculatePerformanceCategory: false,
      dateRange: 'current_week',
    },
    isActive: false,
    executionCount: 0,
  };
}

// ==========================================================================
// Sub-components
// ==========================================================================

function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      {WIZARD_STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(index)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
              isActive
                ? 'bg-slack-purple text-white shadow-md'
                : isCompleted
                ? 'bg-slack-purple/10 text-slack-purple hover:bg-slack-purple/20'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden md:inline">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Step 1: Basics ----

function StepBasics({
  campaign,
  onChange,
  selectedPresetId,
  onSelectPreset,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Campaign type presets */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">¿Qué tipo de campaña quieres crear?</h3>
        <p className="text-sm text-gray-500 mb-4">Elige una plantilla para comenzar rápido, o empieza desde cero.</p>
        <div className="grid grid-cols-2 gap-3">
          {CAMPAIGN_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected ? preset.activeColor : preset.color
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-2xl">{preset.emoji}</span>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-slack-purple" />}
                </div>
                <p className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                  {preset.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Campaign name & description */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Información de la campaña</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={campaign.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
              placeholder="Ej: Reporte diario de solicitudes"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={campaign.description || ''}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
              placeholder="Describe el propósito de esta campaña..."
            />
          </div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={campaign.mentionUser || false}
              onChange={(e) => onChange({ mentionUser: e.target.checked })}
              className="rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
            />
            <span className="text-sm text-gray-700">
              Mencionar al usuario (@usuario) en el mensaje de Slack
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ---- Step 2: Recipients (with Slack pickers) ----

function StepRecipients({
  campaign,
  onChange,
  externalUsers,
  positions,
  slackChannels,
  slackUsers: _slackUsers,
  loadingSlack,
  onRefreshSlack,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
  externalUsers: ExternalUser[];
  positions: Position[];
  slackChannels: SlackChannel[];
  slackUsers: SlackUser[];
  loadingSlack: boolean;
  onRefreshSlack: () => void;
}) {
  const config = campaign.recipientConfig;
  const [channelSearch, setChannelSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const updateConfig = (updates: Partial<CampaignRecipientConfig>) => {
    onChange({ recipientConfig: { ...config, ...updates } });
  };

  const toggleSalesUserType = (type: SalesUserType) => {
    const current = config.salesUserTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    updateConfig({ salesUserTypes: updated });
  };

  const toggleSpecificUser = (userId: string) => {
    const current = config.specificUserIds || [];
    const updated = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    updateConfig({ specificUserIds: updated });
  };

  const toggleChannel = (channel: SlackChannel) => {
    const currentIds = config.channelIds || [];
    const currentNames = config.channelNames || [];
    if (currentIds.includes(channel.id)) {
      updateConfig({
        channelIds: currentIds.filter((id) => id !== channel.id),
        channelNames: currentNames.filter((n) => n !== `#${channel.name}`),
      });
    } else {
      updateConfig({
        channelIds: [...currentIds, channel.id],
        channelNames: [...currentNames, `#${channel.name}`],
      });
    }
  };

  const userCounts: Record<string, number> = {};
  for (const pos of positions) {
    userCounts[pos.name] = externalUsers.filter((u) => u.role === pos.name).length;
  }

  const filteredChannels = slackChannels.filter(
    (ch) => ch.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Destinatarios</h3>
        <p className="text-sm text-gray-500">Selecciona quién recibirá los mensajes de esta campaña.</p>
      </div>

      {/* Source type selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Tipo de destinatario</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { value: 'sales_user_type' as RecipientSourceType, label: 'Por tipo de vendedor', icon: '👥', desc: 'Todos los vendedores de un tipo' },
            { value: 'specific_users' as RecipientSourceType, label: 'Vendedores específicos', icon: '👤', desc: 'Seleccionar vendedores individuales' },
            { value: 'channel' as RecipientSourceType, label: 'Canal de Slack', icon: '📢', desc: 'Enviar a canales específicos' },
          ]).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateConfig({ sourceType: option.value })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                config.sourceType === option.value
                  ? 'border-slack-purple bg-slack-purple/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">{option.icon}</div>
              <div className="font-medium text-gray-900 text-sm">{option.label}</div>
              <div className="text-xs text-gray-500 mt-1">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sales user type selection */}
      {config.sourceType === 'sales_user_type' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Tipos de vendedor</label>
          {positions.length === 0 ? (
            <div className="bg-yellow-50 rounded-lg p-4 text-sm text-yellow-800">
              No hay posiciones configuradas en el catálogo.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {positions.map((pos) => {
                const isSelected = config.salesUserTypes?.includes(pos.name) || false;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => toggleSalesUserType(pos.name)}
                    className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                      isSelected ? 'border-slack-purple bg-slack-purple/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">👤</span>
                    <div className="text-left">
                      <div className="font-medium text-sm text-gray-900">{pos.name}</div>
                      <div className="text-xs text-gray-500">{userCounts[pos.name] || 0} vendedor(es)</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {config.salesUserTypes && config.salesUserTypes.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              Se enviará a <strong>{config.salesUserTypes.reduce((sum, t) => sum + (userCounts[t] || 0), 0)} vendedor(es)</strong> de tipo: {config.salesUserTypes.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Specific users selection */}
      {config.sourceType === 'specific_users' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Seleccionar vendedores</label>
          {externalUsers.length === 0 ? (
            <div className="bg-yellow-50 rounded-lg p-4 text-sm text-yellow-800">
              No hay usuarios activos en el directorio externo.
            </div>
          ) : (
            <>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nombre o posición..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
              />
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {externalUsers
                  .filter((u) => {
                    const q = userSearch.toLowerCase();
                    return !q || u.fullName.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
                  })
                  .map((u) => {
                    const isSelected = config.specificUserIds?.includes(u.id) || false;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleSpecificUser(u.id)}
                        className={`w-full flex items-center space-x-3 p-3 text-left transition-colors ${isSelected ? 'bg-slack-purple/5' : 'hover:bg-gray-50'}`}
                      >
                        <input type="checkbox" checked={isSelected} readOnly className="rounded border-gray-300 text-slack-purple focus:ring-slack-purple" />
                        <span className="text-sm">👤</span>
                        <div>
                          <div className="font-medium text-sm text-gray-900">{u.fullName}</div>
                          <div className="text-xs text-gray-500">{u.role}</div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </>
          )}
          {config.specificUserIds && config.specificUserIds.length > 0 && (
            <p className="text-sm text-gray-600">{config.specificUserIds.length} vendedor(es) seleccionado(s)</p>
          )}
        </div>
      )}

      {/* Slack channel picker */}
      {config.sourceType === 'channel' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Canales de Slack</label>
            <Button size="sm" variant="ghost" onClick={onRefreshSlack} disabled={loadingSlack}>
              {loadingSlack ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1">Actualizar</span>
            </Button>
          </div>

          {loadingSlack ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Cargando canales de Slack...
            </div>
          ) : slackChannels.length === 0 ? (
            <div className="bg-yellow-50 rounded-lg p-4 text-sm text-yellow-800">
              No se pudieron cargar los canales. Verifica que el workspace tenga un bot token configurado y haz clic en &quot;Actualizar&quot;.
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                  placeholder="Buscar canal..."
                />
              </div>

              {/* Selected channels */}
              {config.channelIds && config.channelIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.channelIds.map((id, idx) => {
                    const ch = slackChannels.find((c) => c.id === id);
                    return (
                      <span key={id} className="inline-flex items-center space-x-1 px-2 py-1 bg-slack-purple/10 text-slack-purple rounded-full text-xs font-medium">
                        <Hash className="w-3 h-3" />
                        <span>{ch?.name || config.channelNames?.[idx] || id}</span>
                        <button
                          type="button"
                          onClick={() => toggleChannel(ch || { id, name: '', isPrivate: false, isMember: false })}
                          className="ml-1 hover:text-slack-red"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Channel list */}
              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {filteredChannels.map((ch) => {
                  const isSelected = config.channelIds?.includes(ch.id) || false;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 text-left transition-colors ${isSelected ? 'bg-slack-purple/5' : 'hover:bg-gray-50'}`}
                    >
                      <input type="checkbox" checked={isSelected} readOnly className="rounded border-gray-300 text-slack-purple focus:ring-slack-purple" />
                      <Hash className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">{ch.name}</span>
                        {ch.isPrivate && <span className="ml-2 text-xs text-gray-400">privado</span>}
                      </div>
                      <span className="text-xs text-gray-400 font-mono shrink-0">{ch.id}</span>
                    </button>
                  );
                })}
                {filteredChannels.length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    No se encontraron canales con &quot;{channelSearch}&quot;
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">{slackChannels.length} canales disponibles</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Step 3: Schedule ----

function StepSchedule({
  campaign,
  onChange,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
}) {
  const slots = campaign.scheduleSlots;

  const addSlot = () => {
    onChange({
      scheduleSlots: [...slots, {
        id: generateId(),
        daysOfWeek: [1, 2, 3, 4, 5],
        time: '09:00',
        timezone: 'America/Mexico_City',
        label: '',
      }],
    });
  };

  const updateSlot = (slotId: string, updates: Partial<CampaignScheduleSlot>) => {
    onChange({ scheduleSlots: slots.map((s) => (s.id === slotId ? { ...s, ...updates } : s)) });
  };

  const removeSlot = (slotId: string) => {
    onChange({ scheduleSlots: slots.filter((s) => s.id !== slotId) });
  };

  const duplicateSlot = (slot: CampaignScheduleSlot) => {
    onChange({
      scheduleSlots: [...slots, { ...slot, id: generateId(), label: slot.label ? `${slot.label} (copia)` : '' }],
    });
  };

  const toggleDay = (slotId: string, day: number) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    const updated = slot.daysOfWeek.includes(day)
      ? slot.daysOfWeek.filter((d) => d !== day)
      : [...slot.daysOfWeek, day].sort();
    updateSlot(slotId, { daysOfWeek: updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Horario de Envío</h3>
          <p className="text-sm text-gray-500">Configura cuándo se enviarán los mensajes. Puedes agregar múltiples horarios.</p>
        </div>
        <Button size="sm" onClick={addSlot}><Plus className="w-4 h-4 mr-1" />Agregar Horario</Button>
      </div>

      {slots.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-3">No hay horarios configurados</p>
          <Button size="sm" onClick={addSlot}><Plus className="w-4 h-4 mr-1" />Agregar primer horario</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((slot, index) => (
            <div key={slot.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Horario {index + 1}{slot.label && ` - ${slot.label}`}
                </span>
                <div className="flex items-center space-x-2">
                  <button type="button" onClick={() => duplicateSlot(slot)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded" title="Duplicar"><Copy className="w-4 h-4" /></button>
                  <button type="button" onClick={() => removeSlot(slot.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <input
                type="text"
                value={slot.label || ''}
                onChange={(e) => updateSlot(slot.id, { label: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                placeholder="Etiqueta opcional (ej: Reporte matutino)"
              />

              <div>
                <label className="block text-sm text-gray-600 mb-2">Días de la semana</label>
                <div className="flex space-x-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(slot.id, day.value)}
                      className={`w-10 h-10 rounded-full text-xs font-medium transition-all ${
                        slot.daysOfWeek.includes(day.value)
                          ? 'bg-slack-purple text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={day.fullLabel}
                    >{day.label}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Hora de envío</label>
                  <input type="time" value={slot.time} onChange={(e) => updateSlot(slot.id, { time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Zona horaria</label>
                  <select value={slot.timezone} onChange={(e) => updateSlot(slot.id, { timezone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm">
                    <option value="America/Mexico_City">CDMX (UTC-6)</option>
                    <option value="America/Monterrey">Monterrey (UTC-6)</option>
                    <option value="America/Cancun">Cancún (UTC-5)</option>
                    <option value="America/Tijuana">Tijuana (UTC-8)</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Step 4: Data Source ----

function StepData({
  campaign,
  onChange,
  dataSources,
  onGoToDataSources,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
  dataSources: DataSource[];
  onGoToDataSources: () => void;
}) {
  const dataConfig = campaign.dataConfig || {
    fetchSolicitudes: false, fetchVentasAvanzadas: false, fetchVentasReales: false,
    fetchVideollamadas: false, calculatePerformanceCategory: false, dateRange: 'current_week' as const,
  };

  const updateData = (updates: Partial<CampaignDataConfig>) => {
    onChange({ dataConfig: { ...dataConfig, ...updates } });
  };

  const [showAdvanced, setShowAdvanced] = useState(!dataConfig.dataSourceId);

  // When a DataSource is selected, derive the manual flags from it
  const selectedDs = dataSources.find((ds) => ds.id === dataConfig.dataSourceId);

  const handleSelectDs = (dsId: string) => {
    if (!dsId) {
      updateData({ dataSourceId: undefined });
      return;
    }
    const ds = dataSources.find((d) => d.id === dsId);
    if (!ds) return;
    // Auto-configure manual flags based on the DataSource's variables
    const keys = ds.variables.map((v) => v.key);
    updateData({
      dataSourceId: dsId,
      fetchSolicitudes: keys.some((k) => k.includes('solicitud')),
      fetchVentasAvanzadas: keys.some((k) => k.includes('avanzada')),
      fetchVentasReales: keys.some((k) => k === 'ventas' || k.includes('ventas') && !k.includes('avanzada')),
      fetchVideollamadas: keys.some((k) => k.includes('videollamada')),
      calculatePerformanceCategory: keys.some((k) => k === 'categoria'),
    });
  };

  // Variables available: from DataSource entity + always-available
  const dsVariables: { name: string; description: string }[] = selectedDs
    ? selectedDs.variables.map((v) => ({ name: v.key, description: v.label }))
    : [];
  const alwaysVars = TEMPLATE_VARIABLES.filter((v) => !v.requires);
  const manualVars = getAvailableVariables(dataConfig).filter((v) => v.requires);
  const allAvailableVars = selectedDs
    ? [...alwaysVars, ...dsVariables]
    : [...alwaysVars, ...manualVars];

  const hasAnyData = dataConfig.fetchSolicitudes || dataConfig.fetchVentasAvanzadas
    || dataConfig.fetchVentasReales || dataConfig.fetchVideollamadas;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Datos para los mensajes</h3>
        <p className="text-sm text-gray-500">
          Conecta una fuente de datos para que el mensaje incluya métricas reales de cada destinatario.
        </p>
      </div>

      {/* ── Option A: DataSource entity picker ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Fuente de datos configurada
          </label>
          {dataSources.length === 0 && (
            <button
              type="button"
              onClick={onGoToDataSources}
              className="text-xs text-slack-purple hover:underline flex items-center space-x-1"
            >
              <Plus className="w-3 h-3" />
              <span>Crear fuente</span>
            </button>
          )}
        </div>

        {dataSources.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {/* "Sin datos" option */}
            <label className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              !dataConfig.dataSourceId ? 'border-gray-300 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                checked={!dataConfig.dataSourceId}
                onChange={() => handleSelectDs('')}
                className="text-slack-purple"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Sin datos (mensaje simple)</p>
                <p className="text-xs text-gray-500">Solo se usarán variables básicas: nombre, tipo y fecha</p>
              </div>
            </label>

            {dataSources.map((ds) => {
              const isSelected = dataConfig.dataSourceId === ds.id;
              return (
                <label
                  key={ds.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected ? 'border-slack-purple bg-slack-purple/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    checked={isSelected}
                    onChange={() => handleSelectDs(ds.id)}
                    className="mt-0.5 text-slack-purple"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{ds.icon || '📊'}</span>
                      <p className="text-sm font-medium text-gray-800">{ds.name}</p>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-slack-purple ml-auto" />}
                    </div>
                    {ds.description && <p className="text-xs text-gray-500 mt-0.5">{ds.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {ds.variables.slice(0, 5).map((v) => (
                        <code key={v.key} className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-mono">{`{{${v.key}}}`}</code>
                      ))}
                      {ds.variables.length > 5 && (
                        <span className="text-xs text-gray-400">+{ds.variables.length - 5}</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center">
            <FileBarChart2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No tienes fuentes de datos configuradas.</p>
            <button
              type="button"
              onClick={onGoToDataSources}
              className="mt-2 text-sm text-slack-purple hover:underline"
            >
              Ir a Fuentes de Datos →
            </button>
          </div>
        )}
      </div>

      {/* ── Option B: Manual config (advanced/collapsible) ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
        >
          <span className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-gray-500" />
            <span>Configuración avanzada{dataConfig.dataSourceId ? ' (sobreescribe la fuente)' : ''}</span>
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'fetchSolicitudes' as const, label: 'Solicitudes creadas', desc: 'Deals nuevos en el período', vars: ['solicitudes', 'meta_solicitudes', 'pct_solicitudes'], emoji: '📋' },
                { key: 'fetchVentasAvanzadas' as const, label: 'Ventas avanzadas', desc: 'Deals en etapas avanzadas', vars: ['ventas_avanzadas', 'pct_ventas_avanzadas'], emoji: '⚡' },
                { key: 'fetchVentasReales' as const, label: 'Ventas reales', desc: 'Deals formalizados/desembolsados', vars: ['ventas', 'meta_ventas', 'pct_ventas'], emoji: '💰' },
                { key: 'fetchVideollamadas' as const, label: 'Videollamadas (BAs)', desc: 'Actividad del día y semana', vars: ['videollamadas_dia', 'videollamadas_semana'], emoji: '📞' },
                { key: 'calculatePerformanceCategory' as const, label: 'Categoría desempeño', desc: 'Activa variantes condicionales', vars: ['categoria'], emoji: '🏆' },
              ]).map((option) => (
                <label
                  key={option.key}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    dataConfig[option.key] ? 'border-slack-purple bg-slack-purple/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={dataConfig[option.key]}
                    onChange={(e) => updateData({ [option.key]: e.target.checked })}
                    className="mt-0.5 rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{option.emoji} {option.label}</div>
                    <div className="text-xs text-gray-500">{option.desc}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {option.vars.map((v) => (
                        <code key={v} className="px-1 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-mono">{`{{${v}}}`}</code>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {hasAnyData && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Período</label>
                  <select
                    value={dataConfig.dateRange}
                    onChange={(e) => updateData({ dateRange: e.target.value as CampaignDataConfig['dateRange'] })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slack-purple"
                  >
                    <option value="current_week">Semana actual</option>
                    <option value="last_week">Semana pasada</option>
                    <option value="current_month">Mes actual</option>
                    <option value="today">Solo hoy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pipeline (ID HubSpot)</label>
                  <input
                    type="text"
                    value={dataConfig.customPipeline || ''}
                    onChange={(e) => updateData({ customPipeline: e.target.value || undefined })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple"
                    placeholder="Default del usuario"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Variables preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center space-x-2">
          <span>Variables disponibles en el mensaje</span>
          <span className="bg-blue-200 text-blue-800 text-xs px-1.5 py-0.5 rounded-full font-semibold">
            {allAvailableVars.length}
          </span>
        </h4>
        <div className="flex flex-wrap gap-2">
          {allAvailableVars.map((v) => (
            <span key={v.name} className="inline-flex items-center px-2 py-1 bg-white rounded text-xs border border-blue-200 gap-1.5">
              <code className="text-blue-700 font-mono">{`{{${v.name}}}`}</code>
              <span className="text-gray-500">{v.description}</span>
            </span>
          ))}
        </div>
        {allAvailableVars.length <= 4 && (
          <p className="text-xs text-blue-600 mt-2">
            Selecciona una fuente de datos o activa métricas para más variables.
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Step 5: Message + AI (merged) ----

function StepMessage({
  campaign,
  onChange,
  workspaceId,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
  workspaceId: string;
}) {
  const variants = campaign.messageVariants;
  const slots = campaign.scheduleSlots || [];
  // null = pestaña global; string = slotId
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(campaign.aiConfig?.enabled || false);

  const availableVars = getAvailableVariables(campaign.dataConfig);

  const aiConfig = campaign.aiConfig || {
    enabled: false, systemPrompt: '', temperature: 0.7, maxTokens: 120, rewriteMode: 'rewrite' as const,
  };

  const updateAI = (updates: Partial<CampaignAIConfig>) => {
    onChange({ aiConfig: { ...aiConfig, ...updates } });
  };

  // Variantes globales (sin slotId) y variantes del slot activo
  const globalVariants = variants.filter((v) => !v.scheduleSlotId);
  const slotVariants = (slotId: string) => variants.filter((v) => v.scheduleSlotId === slotId);

  // El slot activo tiene variantes propias?
  const slotHasOwn = (slotId: string) => slotVariants(slotId).length > 0;

  const addVariant = (slotId?: string) => {
    const scopedVariants = slotId ? slotVariants(slotId) : globalVariants;
    onChange({
      messageVariants: [...variants, {
        id: generateId(),
        label: `Variante ${scopedVariants.length + 1}`,
        conditionType: 'performance_category',
        performanceCategories: [],
        messageTemplate: '',
        priority: scopedVariants.length,
        ...(slotId ? { scheduleSlotId: slotId } : {}),
      }],
    });
  };

  const updateVariant = (variantId: string, updates: Partial<MessageVariant>) => {
    onChange({ messageVariants: variants.map((v) => (v.id === variantId ? { ...v, ...updates } : v)) });
  };

  const removeVariant = (variantId: string) => {
    const scopeVariants = activeTab === null ? globalVariants : slotVariants(activeTab);
    if (scopeVariants.length <= 1) {
      toast.error('Debe haber al menos una variante en este horario');
      return;
    }
    onChange({ messageVariants: variants.filter((v) => v.id !== variantId) });
  };

  // Copia las variantes globales al slot indicado
  const personalizeSlot = (slotId: string) => {
    const copies = globalVariants.map((v) => ({
      ...v,
      id: generateId(),
      scheduleSlotId: slotId,
    }));
    onChange({ messageVariants: [...variants, ...copies] });
  };

  // Elimina las variantes propias del slot (vuelve a usar las globales)
  const revertSlot = (slotId: string) => {
    onChange({ messageVariants: variants.filter((v) => v.scheduleSlotId !== slotId) });
  };

  const togglePerformanceCategory = (variantId: string, category: CategoriaDesempeno) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;
    const current = variant.performanceCategories || [];
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    updateVariant(variantId, { performanceCategories: updated });
  };

  const insertVariable = (variantId: string, variableName: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;
    updateVariant(variantId, { messageTemplate: variant.messageTemplate + `{{${variableName}}}` });
  };

  // Helper: renderiza la lista de variantes de un scope dado
  const renderVariants = (scopeVariants: MessageVariant[], slotId?: string) => (
    <div className="space-y-4">
      {scopeVariants.sort((a, b) => a.priority - b.priority).map((variant, index) => (
        <div key={variant.id} className={`border rounded-lg overflow-hidden ${variant.conditionType === 'always' ? 'border-gray-300 bg-gray-50' : 'border-slack-purple/30'}`}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-medium text-gray-400">#{index + 1}</span>
              <input type="text" value={variant.label} onChange={(e) => updateVariant(variant.id, { label: e.target.value })}
                className="font-medium text-sm text-gray-900 border-none focus:ring-0 p-0 bg-transparent" placeholder="Nombre de la variante" />
            </div>
            {variant.conditionType !== 'always' && (
              <button type="button" onClick={() => removeVariant(variant.id)} className="p-1 text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Condición de envío</label>
              <select value={variant.conditionType} onChange={(e) => updateVariant(variant.id, { conditionType: e.target.value as MessageVariant['conditionType'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm">
                <option value="always">Siempre (mensaje por defecto)</option>
                <option value="performance_category">Cuando la categoría de desempeño sea...</option>
                <option value="metric_threshold">Cuando una métrica cumpla un umbral...</option>
              </select>
            </div>
            {variant.conditionType === 'performance_category' && (
              <div>
                <label className="block text-sm text-gray-600 mb-2">Usar este mensaje cuando el desempeño sea:</label>
                <div className="flex flex-wrap gap-2">
                  {PERFORMANCE_CATEGORIES.map((cat) => {
                    const isSelected = variant.performanceCategories?.includes(cat.value) || false;
                    return (
                      <button key={cat.value} type="button" onClick={() => togglePerformanceCategory(variant.id, cat.value)}
                        className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSelected ? cat.color + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-600'}`}>
                        <span>{cat.emoji}</span><span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
                {!campaign.dataConfig?.calculatePerformanceCategory && (
                  <p className="text-xs text-amber-600 mt-2"><AlertTriangle className="w-3 h-3 inline mr-1" />Activa &quot;Categoría de desempeño&quot; en el paso de Datos para usar esta condición.</p>
                )}
              </div>
            )}
            {variant.conditionType === 'metric_threshold' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Métrica</label>
                  <select value={variant.metricField || ''} onChange={(e) => updateVariant(variant.id, { metricField: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent">
                    <option value="">Seleccionar...</option>
                    {METRIC_FIELDS.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Operador</label>
                  <select value={variant.metricOperator || 'gt'} onChange={(e) => updateVariant(variant.id, { metricOperator: e.target.value as MessageVariant['metricOperator'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent">
                    {METRIC_OPERATORS.map((op) => (<option key={op.value} value={op.value}>{op.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Valor</label>
                  <div className="flex space-x-2">
                    <input type="number" value={variant.metricValue ?? ''} onChange={(e) => updateVariant(variant.id, { metricValue: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent" placeholder="Valor" />
                    {variant.metricOperator === 'between' && (
                      <input type="number" value={variant.metricValueEnd ?? ''} onChange={(e) => updateVariant(variant.id, { metricValueEnd: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent" placeholder="Valor fin" />
                    )}
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Plantilla del mensaje</label>
              <textarea value={variant.messageTemplate} onChange={(e) => updateVariant(variant.id, { messageTemplate: e.target.value })} rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm font-mono"
                placeholder={variant.conditionType === 'always' ? 'Ej: Hola {{nombre}}, llevas {{solicitudes}} solicitudes.' : 'Ej: 🚨 URGENTE {{nombre}}: solo llevas {{pct_ventas}}% de tu meta.'} />
              <div className="flex flex-wrap gap-1 mt-2">
                {availableVars.slice(0, 10).map((v) => (
                  <button key={v.name} type="button" onClick={() => insertVariable(variant.id, v.name)} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-slack-purple/10 hover:text-slack-purple transition-colors" title={v.description}>
                    {`{{${v.name}}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
      {scopeVariants.length > 1 && (
        <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Las variantes se evalúan de arriba a abajo. La primera que se cumpla será usada.
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={() => addVariant(slotId)}>
        <Plus className="w-4 h-4 mr-1" />Agregar Variante
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Contenido del Mensaje</h3>
        <p className="text-sm text-gray-500">Escribe tu mensaje usando variables. Puedes definir mensajes diferentes por horario.</p>
      </div>

      {/* Variables quick reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs font-medium text-blue-900 mb-2">Variables disponibles (clic para insertar en la variante activa):</p>
        <div className="flex flex-wrap gap-1">
          {availableVars.map((v) => (
            <span key={v.name} className="px-2 py-0.5 text-xs bg-white text-blue-700 rounded border border-blue-200 font-mono cursor-default" title={v.description}>
              {`{{${v.name}}}`}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs por horario (solo si hay más de un slot) */}
      {slots.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-px">
          <button type="button" onClick={() => setActiveTab(null)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === null ? 'border-slack-purple text-slack-purple' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Todos los horarios
          </button>
          {slots.map((slot, i) => (
            <button key={slot.id} type="button" onClick={() => setActiveTab(slot.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === slot.id ? 'border-slack-purple text-slack-purple' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {slot.label || `Horario ${i + 1}`}
              {slotHasOwn(slot.id) && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-slack-purple inline-block" />}
            </button>
          ))}
        </div>
      )}

      {/* Contenido de la pestaña activa */}
      {activeTab === null ? (
        // Pestaña global
        renderVariants(globalVariants)
      ) : (
        // Pestaña de un slot específico
        slotHasOwn(activeTab) ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Mensaje personalizado para este horario.</p>
              <button type="button" onClick={() => revertSlot(activeTab)}
                className="text-xs text-red-500 hover:text-red-700 underline">
                Quitar personalización (usar mensaje global)
              </button>
            </div>
            {renderVariants(slotVariants(activeTab), activeTab)}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-3">Este horario usa el mensaje global. Puedes personalizarlo de forma independiente.</p>
              <Button size="sm" onClick={() => personalizeSlot(activeTab)}>
                <Plus className="w-4 h-4 mr-1" />Personalizar este horario
              </Button>
            </div>
          </div>
        )
      )}

      {/* Attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Archivos adjuntos (se envían en todos los mensajes de esta campaña)
        </label>
        <FileUpload
          workspaceId={workspaceId}
          value={campaign.attachments || []}
          onChange={(attachments) => onChange({ attachments })}
        />
      </div>

      {/* AI Configuration (collapsible) */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => {
            const newEnabled = !showAI;
            setShowAI(newEnabled);
            updateAI({ enabled: newEnabled });
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Sparkles className={`w-5 h-5 ${aiConfig.enabled ? 'text-purple-600' : 'text-gray-400'}`} />
            <span className="font-medium text-sm text-gray-900">Inteligencia Artificial</span>
            {aiConfig.enabled && <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">Activada</span>}
          </div>
          {showAI ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showAI && (
          <div className="p-4 space-y-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">La IA puede reescribir o generar mensajes para que cada envío suene diferente y natural.</p>

            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'rewrite' as const, label: 'Reescribir', desc: 'Varía el tono manteniendo tu plantilla' },
                { value: 'generate' as const, label: 'Generar', desc: 'Crea un mensaje nuevo desde el contexto' },
              ]).map((mode) => (
                <button key={mode.value} type="button" onClick={() => updateAI({ rewriteMode: mode.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${aiConfig.rewriteMode === mode.value ? 'border-slack-purple bg-slack-purple/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="font-medium text-sm">{mode.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{mode.desc}</div>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones para la IA</label>
              <textarea value={aiConfig.systemPrompt || ''} onChange={(e) => updateAI({ systemPrompt: e.target.value })} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                placeholder="Ej: Eres un coach de ventas motivador que escribe mensajes cortos en español..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperatura ({aiConfig.temperature?.toFixed(1) || '0.7'})</label>
                <input type="range" min={0} max={1} step={0.1} value={aiConfig.temperature || 0.7} onChange={(e) => updateAI({ temperature: parseFloat(e.target.value) })} className="w-full accent-slack-purple" />
                <div className="flex justify-between text-xs text-gray-400"><span>Preciso</span><span>Creativo</span></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tokens máximos</label>
                <input type="number" min={50} max={500} value={aiConfig.maxTokens || 120} onChange={(e) => updateAI({ maxTokens: parseInt(e.target.value) || 120 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Step 6: Review ----

function StepReview({
  campaign,
  externalUsers,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  externalUsers: ExternalUser[];
}) {
  const recipientCount = (() => {
    const config = campaign.recipientConfig;
    if (config.sourceType === 'sales_user_type' && config.salesUserTypes?.length) {
      return externalUsers.filter((u) => config.salesUserTypes!.includes(u.role)).length;
    }
    if (config.sourceType === 'specific_users') return config.specificUserIds?.length || 0;
    if (config.sourceType === 'channel') return config.channelIds?.length || 0;
    return 0;
  })();

  const dataFeatures: string[] = [];
  if (campaign.dataConfig?.fetchSolicitudes) dataFeatures.push('Solicitudes');
  if (campaign.dataConfig?.fetchVentasAvanzadas) dataFeatures.push('Ventas avanzadas');
  if (campaign.dataConfig?.fetchVentasReales) dataFeatures.push('Ventas reales');
  if (campaign.dataConfig?.fetchVideollamadas) dataFeatures.push('Videollamadas');
  if (campaign.dataConfig?.calculatePerformanceCategory) dataFeatures.push('Categoría');

  const hasEmptyTemplates = campaign.messageVariants.some((v) => !v.messageTemplate.trim());

  const warnings: string[] = [];
  if (!campaign.name) warnings.push('La campaña no tiene nombre');
  if (campaign.scheduleSlots.length === 0) warnings.push('No hay horarios configurados');
  if (recipientCount === 0) warnings.push('No hay destinatarios seleccionados');
  if (hasEmptyTemplates) warnings.push('Hay variantes de mensaje sin contenido');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Revisar Campaña</h3>
        <p className="text-sm text-gray-500">Verifica toda la configuración antes de guardar.</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Información</h4>
          <p className="text-lg font-semibold text-gray-900">{campaign.name || '(sin nombre)'}</p>
          {campaign.description && <p className="text-sm text-gray-600 mt-1">{campaign.description}</p>}
          {campaign.mentionUser && <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">Menciona al usuario</span>}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Destinatarios</h4>
          <p className="text-gray-900">{formatRecipientSummary(campaign.recipientConfig)}</p>
          <p className="text-sm text-gray-600 mt-1">{recipientCount} destinatario(s)</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Horarios ({campaign.scheduleSlots.length})</h4>
          {campaign.scheduleSlots.length === 0 ? (
            <p className="text-red-600 text-sm">Sin horarios configurados</p>
          ) : (
            <div className="space-y-1.5">
              {campaign.scheduleSlots.map((slot) => (
                <div key={slot.id} className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{slot.time}</span>
                  <span className="text-gray-500">-</span>
                  <span>{slot.daysOfWeek.map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.label).join(', ')}</span>
                  {slot.label && <span className="text-gray-400">({slot.label})</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Datos de HubSpot</h4>
          {dataFeatures.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dataFeatures.map((f) => (<span key={f} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">{f}</span>))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Sin datos de HubSpot (solo variables básicas)</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Mensaje ({campaign.messageVariants.length} variante(s))</h4>
          <div className="space-y-2">
            {campaign.messageVariants.map((v) => (
              <div key={v.id} className="text-sm">
                <span className="font-medium text-gray-900">{v.label}</span>
                <span className="text-gray-500 ml-2">
                  ({v.conditionType === 'always' ? 'Siempre' : v.conditionType === 'performance_category' ? `Categorías: ${v.performanceCategories?.join(', ') || 'ninguna'}` : `${v.metricField} ${v.metricOperator} ${v.metricValue}`})
                </span>
                {v.messageTemplate ? (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{v.messageTemplate}</p>
                ) : (
                  <p className="text-xs text-red-400 mt-0.5">Sin contenido</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            IA: {campaign.aiConfig?.enabled ? `Activada (${campaign.aiConfig.rewriteMode === 'rewrite' ? 'reescribir' : 'generar'})` : 'Desactivada'}
          </p>
          {campaign.attachments && campaign.attachments.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Adjuntos: {campaign.attachments.length} archivo(s)
            </p>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-yellow-800 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Advertencias</span>
            </div>
            <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================================
// Campaign Card
// ==========================================================================

function CampaignCard({
  campaign, onEdit, onToggle, onDuplicate, onDelete, onViewHistory,
}: {
  campaign: MessageCampaign;
  onEdit: () => void; onToggle: () => void; onDuplicate: () => void; onDelete: () => void; onViewHistory: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{campaign.name}</h3>
            <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${campaign.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {campaign.isActive ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          {campaign.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{campaign.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
            <span className="inline-flex items-center space-x-1"><Users className="w-4 h-4" /><span>{formatRecipientSummary(campaign.recipientConfig)}</span></span>
            <span className="inline-flex items-center space-x-1"><Clock className="w-4 h-4" /><span>{formatScheduleSummary(campaign.scheduleSlots)}</span></span>
            <span className="inline-flex items-center space-x-1"><MessageSquare className="w-4 h-4" /><span>{campaign.messageVariants.length} variante(s)</span></span>
            {campaign.aiConfig?.enabled && <span className="inline-flex items-center space-x-1 text-purple-600"><Sparkles className="w-4 h-4" /><span>IA</span></span>}
          </div>
          {campaign.executionCount > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Ejecutada {campaign.executionCount} vez(es)
              {campaign.lastExecuted && ` - Última: ${campaign.lastExecuted.toDate().toLocaleDateString('es-MX')}`}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-1 ml-4 shrink-0">
          <button onClick={onToggle} className={`p-2 rounded-lg transition-colors ${campaign.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`} title={campaign.isActive ? 'Desactivar' : 'Activar'}><Power className="w-5 h-5" /></button>
          <button onClick={onViewHistory} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="Ver historial"><History className="w-5 h-5" /></button>
          <button onClick={onEdit} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar"><Edit2 className="w-5 h-5" /></button>
          <button onClick={onDuplicate} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" title="Duplicar"><Copy className="w-5 h-5" /></button>
          <button onClick={onDelete} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-5 h-5" /></button>
        </div>
      </div>
    </Card>
  );
}

// ==========================================================================
// Main Scheduler Page
// ==========================================================================

export function Scheduler() {
  const navigate = useNavigate();
  const { selectedWorkspace } = useAppStore();
  const { user } = useAuthStore();

  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([]);
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);

  // Slack data
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [loadingSlack, setLoadingSlack] = useState(false);

  // UI state
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingCampaign, setEditingCampaign] = useState<MessageCampaign | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(createDefaultCampaign());
  const [saving, setSaving] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState('personalizado');

  // History modal
  const [historyModalCampaign, setHistoryModalCampaign] = useState<MessageCampaign | null>(null);
  const [executions, setExecutions] = useState<CampaignExecution[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load campaigns
  useEffect(() => {
    if (!selectedWorkspace) return;
    const unsubscribe = campaignService.subscribe(selectedWorkspace.id, (data) => {
      setCampaigns(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedWorkspace]);

  // Load positions + external users once on mount
  useEffect(() => {
    positionService.getAll()
      .then(setPositions)
      .catch((err) => console.error('Error loading positions:', err));
    externalUserService.getAll()
      .then(setExternalUsers)
      .catch((err) => console.error('Error loading external users:', err));
  }, []);

  // Load data sources per workspace
  useEffect(() => {
    if (!selectedWorkspace) return;
    dataSourceService
      .getByWorkspace(selectedWorkspace.id)
      .then(setDataSources)
      .catch((err) => console.error('Error loading data sources:', err));
  }, [selectedWorkspace]);

  const handleSelectPreset = (presetId: string) => {
    const preset = CAMPAIGN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    if (Object.keys(preset.defaults).length > 0) {
      setFormData((prev) => ({
        ...prev,
        ...preset.defaults,
        workspaceId: selectedWorkspace?.id || '',
      }));
    }
  };

  // Fetch Slack channels and users
  const fetchSlackData = useCallback(async () => {
    if (!selectedWorkspace) return;
    setLoadingSlack(true);
    try {
      const getChannels = httpsCallable(functions, 'getSlackChannels');
      const getUsers = httpsCallable(functions, 'getSlackUsers');

      const [channelsRes, usersRes] = await Promise.all([
        getChannels({ workspaceId: selectedWorkspace.id }),
        getUsers({ workspaceId: selectedWorkspace.id }),
      ]);

      const channelsData = channelsRes.data as { channels: SlackChannel[] };
      const usersData = usersRes.data as { users: SlackUser[] };

      setSlackChannels(channelsData.channels || []);
      setSlackUsers(usersData.users || []);
    } catch (error) {
      console.error('Error fetching Slack data:', error);
      // Don't show error toast - data might not be available if workspace has no token yet
    } finally {
      setLoadingSlack(false);
    }
  }, [selectedWorkspace]);

  // Auto-fetch Slack data when entering form view
  useEffect(() => {
    if (view === 'form' && slackChannels.length === 0 && slackUsers.length === 0) {
      fetchSlackData();
    }
  }, [view, fetchSlackData, slackChannels.length, slackUsers.length]);

  // Form handlers
  const updateFormData = useCallback(
    (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => {
      setFormData((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const openCreateForm = () => {
    setEditingCampaign(null);
    setFormData({ ...createDefaultCampaign(), workspaceId: selectedWorkspace?.id || '' });
    setCurrentStep(0);
    setSelectedPresetId('personalizado');
    setView('form');
  };

  const openEditForm = (campaign: MessageCampaign) => {
    setEditingCampaign(campaign);
    setFormData({
      workspaceId: campaign.workspaceId,
      name: campaign.name,
      description: campaign.description,
      scheduleSlots: campaign.scheduleSlots,
      recipientConfig: campaign.recipientConfig,
      messageVariants: campaign.messageVariants,
      mentionUser: campaign.mentionUser,
      aiConfig: campaign.aiConfig,
      dataConfig: campaign.dataConfig,
      isActive: campaign.isActive,
      executionCount: campaign.executionCount,
    });
    setCurrentStep(0);
    setView('form');
  };

  const cancelForm = () => {
    setView('list');
    setEditingCampaign(null);
    setCurrentStep(0);
  };

  const saveCampaign = async () => {
    if (!selectedWorkspace || !user) return;
    if (!formData.name.trim()) {
      toast.error('El nombre de la campaña es requerido');
      setCurrentStep(0);
      return;
    }
    setSaving(true);
    try {
      if (editingCampaign) {
        await campaignService.update(editingCampaign.id, { ...formData, updatedAt: Timestamp.now() });
        toast.success('Campaña actualizada exitosamente');
      } else {
        await campaignService.create({
          ...formData,
          workspaceId: selectedWorkspace.id,
          createdBy: user.id || 'mock-user-id',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        } as any);
        toast.success('Campaña creada exitosamente');
      }
      setView('list');
      setEditingCampaign(null);
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Error al guardar la campaña');
    } finally {
      setSaving(false);
    }
  };

  const toggleCampaign = async (campaign: MessageCampaign) => {
    try {
      await campaignService.update(campaign.id, { isActive: !campaign.isActive });
      toast.success(`Campaña ${campaign.isActive ? 'desactivada' : 'activada'}`);
    } catch { toast.error('Error al cambiar estado'); }
  };

  const duplicateCampaign = async (campaign: MessageCampaign) => {
    if (!selectedWorkspace || !user) return;
    try {
      const { id: _id, ...campaignData } = campaign;
      await campaignService.create({
        ...campaignData, name: `${campaign.name} (Copia)`, isActive: false, executionCount: 0,
        createdBy: user.id || 'mock-user-id', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });
      toast.success('Campaña duplicada');
    } catch { toast.error('Error al duplicar'); }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('¿Eliminar esta campaña? Esta acción no se puede deshacer.')) return;
    try {
      await campaignService.delete(campaignId);
      toast.success('Campaña eliminada');
    } catch { toast.error('Error al eliminar'); }
  };

  const viewHistory = async (campaign: MessageCampaign) => {
    setHistoryModalCampaign(campaign);
    setLoadingHistory(true);
    try {
      const data = await campaignExecutionService.getByCampaign(campaign.id, 20);
      setExecutions(data);
    } catch { toast.error('Error al cargar historial'); }
    finally { setLoadingHistory(false); }
  };

  // No workspace
  if (!selectedWorkspace) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin Workspace Seleccionado</h2>
        <p className="text-gray-600">Selecciona un workspace desde el encabezado para gestionar campañas.</p>
      </div>
    );
  }

  // ===== FORM VIEW =====
  if (view === 'form') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={cancelForm} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{editingCampaign ? 'Editar Campaña' : 'Nueva Campaña'}</h1>
              <p className="text-sm text-gray-500">{WIZARD_STEPS[currentStep].label} - Paso {currentStep + 1} de {WIZARD_STEPS.length}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={cancelForm}>Cancelar</Button>
            <Button onClick={saveCampaign} isLoading={saving}>{editingCampaign ? 'Actualizar' : 'Crear Campaña'}</Button>
          </div>
        </div>

        <StepIndicator currentStep={currentStep} onStepClick={setCurrentStep} />

        <Card>
          {currentStep === 0 && (
            <StepBasics
              campaign={formData}
              onChange={updateFormData}
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
            />
          )}
          {currentStep === 1 && <StepRecipients campaign={formData} onChange={updateFormData} externalUsers={externalUsers} positions={positions} slackChannels={slackChannels} slackUsers={slackUsers} loadingSlack={loadingSlack} onRefreshSlack={fetchSlackData} />}
          {currentStep === 2 && <StepSchedule campaign={formData} onChange={updateFormData} />}
          {currentStep === 3 && (
            <StepData
              campaign={formData}
              onChange={updateFormData}
              dataSources={dataSources}
              onGoToDataSources={() => navigate('/data-sources')}
            />
          )}
          {currentStep === 4 && <StepMessage campaign={formData} onChange={updateFormData} workspaceId={selectedWorkspace?.id || ''} />}
          {currentStep === 5 && <StepReview campaign={formData} externalUsers={externalUsers} />}
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => setCurrentStep((s) => Math.max(0, s - 1))} disabled={currentStep === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" />Anterior
          </Button>
          <div className="flex items-center space-x-3">
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button onClick={() => setCurrentStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}>
                Siguiente<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={saveCampaign} isLoading={saving}>{editingCampaign ? 'Actualizar Campaña' : 'Crear Campaña'}</Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Programador de Mensajes</h1>
          <p className="text-gray-600 mt-1">Crea y gestiona campañas de mensajes automatizados sin código</p>
        </div>
        <Button onClick={openCreateForm}><Plus className="w-4 h-4 mr-2" />Nueva Campaña</Button>
      </div>

      {campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card><div className="text-sm text-gray-500">Total campañas</div><div className="text-2xl font-bold text-gray-900">{campaigns.length}</div></Card>
          <Card><div className="text-sm text-gray-500">Activas</div><div className="text-2xl font-bold text-green-600">{campaigns.filter((c) => c.isActive).length}</div></Card>
          <Card><div className="text-sm text-gray-500">Ejecuciones totales</div><div className="text-2xl font-bold text-slack-purple">{campaigns.reduce((sum, c) => sum + c.executionCount, 0)}</div></Card>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando campañas...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sin Campañas</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Crea tu primera campaña para automatizar el envío de mensajes personalizados a tus equipos de ventas, sin necesidad de escribir código.
          </p>
          <Button onClick={openCreateForm}><Plus className="w-4 h-4 mr-2" />Crear Primera Campaña</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} onEdit={() => openEditForm(campaign)} onToggle={() => toggleCampaign(campaign)} onDuplicate={() => duplicateCampaign(campaign)} onDelete={() => deleteCampaign(campaign.id)} onViewHistory={() => viewHistory(campaign)} />
          ))}
        </div>
      )}

      {/* History Modal */}
      {historyModalCampaign && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={() => setHistoryModalCampaign(null)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Historial - {historyModalCampaign.name}</h2>
                <button onClick={() => setHistoryModalCampaign(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                {loadingHistory ? (
                  <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div></div>
                ) : executions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500"><History className="w-12 h-12 mx-auto mb-3 text-gray-400" /><p>No hay ejecuciones registradas</p></div>
                ) : (
                  <div className="space-y-3">
                    {executions.map((exec) => (
                      <div key={exec.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{exec.executedAt.toDate().toLocaleString('es-MX')}</span>
                          <div className="flex items-center space-x-3 text-sm">
                            <span className="text-green-600">{exec.successCount} enviado(s)</span>
                            {exec.failureCount > 0 && <span className="text-red-600">{exec.failureCount} fallido(s)</span>}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{exec.recipientCount} destinatario(s)</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
