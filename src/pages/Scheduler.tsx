import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import {
  campaignService,
  campaignExecutionService,
  salesUserService,
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
  SalesUser,
} from '@/types';

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

const SALES_USER_TYPES: { value: SalesUserType; label: string; emoji: string }[] = [
  { value: 'kiosco', label: 'Kioscos', emoji: '🏪' },
  { value: 'atn', label: 'Aviva Tu Negocio', emoji: '💼' },
  { value: 'ba', label: 'Embajadores BA', emoji: '🎯' },
  { value: 'alianza', label: 'Alianzas', emoji: '🤝' },
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

const TEMPLATE_VARIABLES = [
  { name: 'nombre', description: 'Nombre del vendedor' },
  { name: 'solicitudes', description: 'Solicitudes actuales' },
  { name: 'meta_solicitudes', description: 'Meta de solicitudes' },
  { name: 'pct_solicitudes', description: '% avance solicitudes' },
  { name: 'ventas', description: 'Monto de ventas ($)' },
  { name: 'meta_ventas', description: 'Meta de ventas ($)' },
  { name: 'pct_ventas', description: '% avance ventas' },
  { name: 'ventas_avanzadas', description: 'Ventas en proceso ($)' },
  { name: 'pct_ventas_avanzadas', description: '% ventas en proceso' },
  { name: 'categoria', description: 'Categoría de desempeño' },
  { name: 'dias_restantes', description: 'Días restantes del período' },
  { name: 'progreso_esperado', description: '% progreso esperado' },
  { name: 'tipo_usuario', description: 'Tipo de vendedor' },
  { name: 'videollamadas_dia', description: 'Videollamadas hoy (BAs)' },
  { name: 'videollamadas_semana', description: 'Videollamadas semana (BAs)' },
];

const WIZARD_STEPS = [
  { id: 'basics', label: 'Información', icon: Info },
  { id: 'recipients', label: 'Destinatarios', icon: Users },
  { id: 'schedule', label: 'Horario', icon: Clock },
  { id: 'message', label: 'Mensaje', icon: MessageSquare },
  { id: 'ai', label: 'IA y Datos', icon: Sparkles },
  { id: 'review', label: 'Revisar', icon: Eye },
];

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
    const types = config.salesUserTypes
      .map((t) => SALES_USER_TYPES.find((st) => st.value === t)?.label || t)
      .join(', ');
    return types;
  }
  if (config.sourceType === 'specific_users' && config.specificUserIds?.length) {
    return `${config.specificUserIds.length} usuario(s)`;
  }
  if (config.sourceType === 'channel' && config.channelIds?.length) {
    return `${config.channelIds.length} canal(es)`;
  }
  return 'Sin destinatarios';
}

// ==========================================================================
// Default values for new campaigns
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

/**
 * Step indicator showing progress through the wizard
 */
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

/**
 * Step 1: Campaign basic information
 */
function StepBasics({
  campaign,
  onChange,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Información de la Campaña</h3>
        <p className="text-sm text-gray-500">Define el nombre y descripción de tu campaña de mensajes.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la campaña *
          </label>
          <input
            type="text"
            value={campaign.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
            placeholder="Ej: Reporte diario de solicitudes"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            value={campaign.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
            placeholder="Describe el propósito de esta campaña..."
          />
        </div>

        <div className="flex items-center space-x-3">
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

/**
 * Step 2: Recipient configuration
 */
function StepRecipients({
  campaign,
  onChange,
  salesUsers,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
  salesUsers: SalesUser[];
}) {
  const config = campaign.recipientConfig;

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

  // Count users per type
  const userCounts: Record<string, number> = {};
  for (const type of SALES_USER_TYPES) {
    userCounts[type.value] = salesUsers.filter((u) => u.tipo === type.value).length;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Destinatarios</h3>
        <p className="text-sm text-gray-500">
          Selecciona quién recibirá los mensajes de esta campaña.
        </p>
      </div>

      {/* Source type selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Tipo de destinatario</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { value: 'sales_user_type' as RecipientSourceType, label: 'Por tipo de vendedor', icon: '👥', desc: 'Enviar a todos los vendedores de un tipo' },
            { value: 'specific_users' as RecipientSourceType, label: 'Usuarios específicos', icon: '👤', desc: 'Seleccionar vendedores individuales' },
            { value: 'channel' as RecipientSourceType, label: 'Canal de Slack', icon: '📢', desc: 'Enviar a un canal específico' },
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
          <label className="block text-sm font-medium text-gray-700">
            Tipos de vendedor
          </label>
          <div className="grid grid-cols-2 gap-3">
            {SALES_USER_TYPES.map((type) => {
              const isSelected = config.salesUserTypes?.includes(type.value) || false;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => toggleSalesUserType(type.value)}
                  className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-slack-purple bg-slack-purple/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{type.emoji}</span>
                  <div className="text-left">
                    <div className="font-medium text-sm text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-500">
                      {userCounts[type.value] || 0} vendedor(es)
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {config.salesUserTypes && config.salesUserTypes.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Se enviará a{' '}
                <strong>
                  {config.salesUserTypes
                    .reduce((sum, t) => sum + (userCounts[t] || 0), 0)}{' '}
                  vendedor(es)
                </strong>{' '}
                de tipo:{' '}
                {config.salesUserTypes
                  .map((t) => SALES_USER_TYPES.find((st) => st.value === t)?.label)
                  .join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Specific users selection */}
      {config.sourceType === 'specific_users' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Seleccionar vendedores
          </label>
          {salesUsers.length === 0 ? (
            <div className="bg-yellow-50 rounded-lg p-4 text-sm text-yellow-800">
              No hay vendedores registrados. Agrega vendedores desde la sección de Equipos.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y">
              {salesUsers.map((user) => {
                const isSelected = config.specificUserIds?.includes(user.id) || false;
                const typeInfo = SALES_USER_TYPES.find((t) => t.value === user.tipo);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleSpecificUser(user.id)}
                    className={`w-full flex items-center space-x-3 p-3 text-left transition-colors ${
                      isSelected ? 'bg-slack-purple/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
                    />
                    <span className="text-sm">{typeInfo?.emoji}</span>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{user.nombre}</div>
                      <div className="text-xs text-gray-500">{typeInfo?.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {config.specificUserIds && config.specificUserIds.length > 0 && (
            <p className="text-sm text-gray-600">
              {config.specificUserIds.length} vendedor(es) seleccionado(s)
            </p>
          )}
        </div>
      )}

      {/* Channel IDs */}
      {config.sourceType === 'channel' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            IDs de canales de Slack
          </label>
          <input
            type="text"
            value={config.channelIds?.join(', ') || ''}
            onChange={(e) =>
              updateConfig({
                channelIds: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
            placeholder="C09PH8BMVUJ, C0XXXXXXX"
          />
          <p className="text-xs text-gray-500">
            Separa múltiples IDs con comas. Puedes obtener el ID del canal desde Slack.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombres de canales (referencia)
            </label>
            <input
              type="text"
              value={config.channelNames?.join(', ') || ''}
              onChange={(e) =>
                updateConfig({
                  channelNames: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
              placeholder="#talleres, #general"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Step 3: Schedule configuration
 */
function StepSchedule({
  campaign,
  onChange,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
}) {
  const slots = campaign.scheduleSlots;

  const addSlot = () => {
    const newSlot: CampaignScheduleSlot = {
      id: generateId(),
      daysOfWeek: [1, 2, 3, 4, 5], // Lunes a Viernes por defecto
      time: '09:00',
      timezone: 'America/Mexico_City',
      label: '',
    };
    onChange({ scheduleSlots: [...slots, newSlot] });
  };

  const updateSlot = (slotId: string, updates: Partial<CampaignScheduleSlot>) => {
    onChange({
      scheduleSlots: slots.map((s) => (s.id === slotId ? { ...s, ...updates } : s)),
    });
  };

  const removeSlot = (slotId: string) => {
    onChange({ scheduleSlots: slots.filter((s) => s.id !== slotId) });
  };

  const duplicateSlot = (slot: CampaignScheduleSlot) => {
    const newSlot = { ...slot, id: generateId(), label: slot.label ? `${slot.label} (copia)` : '' };
    onChange({ scheduleSlots: [...slots, newSlot] });
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
          <p className="text-sm text-gray-500">
            Configura cuándo se enviarán los mensajes. Puedes agregar múltiples horarios.
          </p>
        </div>
        <Button size="sm" onClick={addSlot}>
          <Plus className="w-4 h-4 mr-1" />
          Agregar Horario
        </Button>
      </div>

      {slots.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-3">No hay horarios configurados</p>
          <Button size="sm" onClick={addSlot}>
            <Plus className="w-4 h-4 mr-1" />
            Agregar primer horario
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((slot, index) => (
            <div
              key={slot.id}
              className="border border-gray-200 rounded-lg p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Horario {index + 1}
                  {slot.label && ` - ${slot.label}`}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => duplicateSlot(slot)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    title="Duplicar"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 rounded"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Label */}
              <input
                type="text"
                value={slot.label || ''}
                onChange={(e) => updateSlot(slot.id, { label: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                placeholder="Etiqueta opcional (ej: Reporte matutino)"
              />

              {/* Days of week */}
              <div>
                <label className="block text-sm text-gray-600 mb-2">Días de la semana</label>
                <div className="flex space-x-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = slot.daysOfWeek.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(slot.id, day.value)}
                        className={`w-10 h-10 rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-slack-purple text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={day.fullLabel}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Hora de envío</label>
                  <input
                    type="time"
                    value={slot.time}
                    onChange={(e) => updateSlot(slot.id, { time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Zona horaria</label>
                  <select
                    value={slot.timezone}
                    onChange={(e) => updateSlot(slot.id, { timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                  >
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

/**
 * Step 4: Message content with variants
 */
function StepMessage({
  campaign,
  onChange,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
}) {
  const variants = campaign.messageVariants;
  const [showVariables, setShowVariables] = useState(false);

  const addVariant = () => {
    const newVariant: MessageVariant = {
      id: generateId(),
      label: `Variante ${variants.length + 1}`,
      conditionType: 'performance_category',
      performanceCategories: [],
      messageTemplate: '',
      priority: variants.length,
    };
    onChange({ messageVariants: [...variants, newVariant] });
  };

  const updateVariant = (variantId: string, updates: Partial<MessageVariant>) => {
    onChange({
      messageVariants: variants.map((v) =>
        v.id === variantId ? { ...v, ...updates } : v
      ),
    });
  };

  const removeVariant = (variantId: string) => {
    if (variants.length <= 1) {
      toast.error('Debe haber al menos una variante de mensaje');
      return;
    }
    onChange({ messageVariants: variants.filter((v) => v.id !== variantId) });
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
    updateVariant(variantId, {
      messageTemplate: variant.messageTemplate + `{{${variableName}}}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Contenido del Mensaje</h3>
          <p className="text-sm text-gray-500">
            Escribe tu mensaje usando variables y, opcionalmente, crea variantes condicionales.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowVariables(!showVariables)}
          >
            <Database className="w-4 h-4 mr-1" />
            Variables
          </Button>
          <Button size="sm" onClick={addVariant}>
            <Plus className="w-4 h-4 mr-1" />
            Agregar Variante
          </Button>
        </div>
      </div>

      {/* Variables panel */}
      {showVariables && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-blue-900">
              Variables disponibles
            </h4>
            <button
              type="button"
              onClick={() => setShowVariables(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <div
                key={v.name}
                className="bg-white rounded px-2 py-1.5 text-xs border border-blue-200"
              >
                <code className="text-blue-700 font-mono">{`{{${v.name}}}`}</code>
                <span className="text-gray-500 ml-1">- {v.description}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-700 mt-2">
            Haz clic en una variable dentro de cada variante para insertarla en el mensaje.
          </p>
        </div>
      )}

      {/* Variants */}
      <div className="space-y-4">
        {variants
          .sort((a, b) => a.priority - b.priority)
          .map((variant, index) => (
            <div
              key={variant.id}
              className={`border rounded-lg overflow-hidden ${
                variant.conditionType === 'always'
                  ? 'border-gray-300 bg-gray-50'
                  : 'border-slack-purple/30'
              }`}
            >
              {/* Variant header */}
              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-medium text-gray-400">
                    #{index + 1}
                  </span>
                  <input
                    type="text"
                    value={variant.label}
                    onChange={(e) => updateVariant(variant.id, { label: e.target.value })}
                    className="font-medium text-sm text-gray-900 border-none focus:ring-0 p-0 bg-transparent"
                    placeholder="Nombre de la variante"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  {variant.conditionType !== 'always' && (
                    <button
                      type="button"
                      onClick={() => removeVariant(variant.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Condition type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Condición
                    </label>
                    <select
                      value={variant.conditionType}
                      onChange={(e) =>
                        updateVariant(variant.id, {
                          conditionType: e.target.value as MessageVariant['conditionType'],
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                    >
                      <option value="always">Siempre (por defecto)</option>
                      <option value="performance_category">Por categoría de desempeño</option>
                      <option value="metric_threshold">Por umbral de métrica</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Prioridad
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={variant.priority}
                      onChange={(e) =>
                        updateVariant(variant.id, { priority: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">Menor = más prioridad</p>
                  </div>
                </div>

                {/* Performance category selector */}
                {variant.conditionType === 'performance_category' && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      Categorías de desempeño
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PERFORMANCE_CATEGORIES.map((cat) => {
                        const isSelected =
                          variant.performanceCategories?.includes(cat.value) || false;
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() =>
                              togglePerformanceCategory(variant.id, cat.value)
                            }
                            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isSelected ? cat.color + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <span>{cat.emoji}</span>
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Metric threshold */}
                {variant.conditionType === 'metric_threshold' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Métrica</label>
                      <select
                        value={variant.metricField || ''}
                        onChange={(e) =>
                          updateVariant(variant.id, { metricField: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      >
                        <option value="">Seleccionar...</option>
                        {METRIC_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Operador</label>
                      <select
                        value={variant.metricOperator || 'gt'}
                        onChange={(e) =>
                          updateVariant(variant.id, {
                            metricOperator: e.target.value as MessageVariant['metricOperator'],
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                      >
                        {METRIC_OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Valor</label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={variant.metricValue ?? ''}
                          onChange={(e) =>
                            updateVariant(variant.id, {
                              metricValue: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                          placeholder="Valor"
                        />
                        {variant.metricOperator === 'between' && (
                          <input
                            type="number"
                            value={variant.metricValueEnd ?? ''}
                            onChange={(e) =>
                              updateVariant(variant.id, {
                                metricValueEnd: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                            placeholder="Valor fin"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Message template */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Plantilla del mensaje
                  </label>
                  <textarea
                    value={variant.messageTemplate}
                    onChange={(e) =>
                      updateVariant(variant.id, { messageTemplate: e.target.value })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm font-mono"
                    placeholder={
                      variant.conditionType === 'always'
                        ? 'Ej: Hola {{nombre}}, llevas {{solicitudes}} solicitudes ({{pct_solicitudes}}%) y ${{ventas}} en ventas ({{pct_ventas}}%). ¡Sigue así!'
                        : 'Ej: 🚨 URGENTE {{nombre}}: solo llevas {{pct_ventas}}% de tu meta de ventas. ¡Acelera!'
                    }
                  />
                  {/* Quick variable insert buttons */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {TEMPLATE_VARIABLES.slice(0, 8).map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => insertVariable(variant.id, v.name)}
                        className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-slack-purple/10 hover:text-slack-purple transition-colors"
                      >
                        {`{{${v.name}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        Las variantes se evalúan en orden de prioridad. La primera variante cuya condición se
        cumpla será usada. Si ninguna condición se cumple, se usa la variante &quot;Siempre&quot;.
      </div>
    </div>
  );
}

/**
 * Step 5: AI and Data configuration
 */
function StepAIData({
  campaign,
  onChange,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  onChange: (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => void;
}) {
  const aiConfig = campaign.aiConfig || {
    enabled: false,
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 120,
    rewriteMode: 'rewrite' as const,
  };
  const dataConfig = campaign.dataConfig || {
    fetchSolicitudes: false,
    fetchVentasAvanzadas: false,
    fetchVentasReales: false,
    fetchVideollamadas: false,
    calculatePerformanceCategory: false,
    dateRange: 'current_week' as const,
  };

  const updateAI = (updates: Partial<CampaignAIConfig>) => {
    onChange({ aiConfig: { ...aiConfig, ...updates } });
  };

  const updateData = (updates: Partial<CampaignDataConfig>) => {
    onChange({ dataConfig: { ...dataConfig, ...updates } });
  };

  return (
    <div className="space-y-8">
      {/* Data Source */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            <Database className="w-5 h-5 inline mr-2" />
            Fuente de Datos
          </h3>
          <p className="text-sm text-gray-500">
            Configura qué métricas de HubSpot se obtienen para cada destinatario.
            Estas métricas se usan como variables en los mensajes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'fetchSolicitudes' as const, label: 'Solicitudes creadas', desc: 'Deals creados en el período' },
            { key: 'fetchVentasAvanzadas' as const, label: 'Ventas avanzadas', desc: 'Deals en etapas avanzadas' },
            { key: 'fetchVentasReales' as const, label: 'Ventas reales (desembolsos)', desc: 'Deals formalizados' },
            { key: 'fetchVideollamadas' as const, label: 'Videollamadas (BAs)', desc: 'Videollamadas del día/semana' },
            { key: 'calculatePerformanceCategory' as const, label: 'Categoría de desempeño', desc: 'Calcular categoría automática' },
          ].map((option) => (
            <label
              key={option.key}
              className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                dataConfig[option.key]
                  ? 'border-slack-purple bg-slack-purple/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={dataConfig[option.key]}
                onChange={(e) => updateData({ [option.key]: e.target.checked })}
                className="mt-0.5 rounded border-gray-300 text-slack-purple focus:ring-slack-purple"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{option.label}</div>
                <div className="text-xs text-gray-500">{option.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Período de datos
            </label>
            <select
              value={dataConfig.dateRange}
              onChange={(e) => updateData({ dateRange: e.target.value as CampaignDataConfig['dateRange'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
            >
              <option value="current_week">Semana actual</option>
              <option value="last_week">Semana pasada</option>
              <option value="current_month">Mes actual</option>
              <option value="today">Solo hoy</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pipeline personalizado (opcional)
            </label>
            <input
              type="text"
              value={dataConfig.customPipeline || ''}
              onChange={(e) => updateData({ customPipeline: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
              placeholder="ID del pipeline (dejar vacío para default)"
            />
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              <Sparkles className="w-5 h-5 inline mr-2" />
              Inteligencia Artificial
            </h3>
            <p className="text-sm text-gray-500">
              Usa IA para reescribir o generar mensajes personalizados dinámicamente.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aiConfig.enabled}
              onChange={(e) => updateAI({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slack-purple/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slack-purple"></div>
          </label>
        </div>

        {aiConfig.enabled && (
          <div className="space-y-4 pl-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modo de IA
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'rewrite' as const, label: 'Reescribir', desc: 'La IA reescribe tu plantilla para variar el tono' },
                  { value: 'generate' as const, label: 'Generar', desc: 'La IA genera un mensaje nuevo basado en el contexto' },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => updateAI({ rewriteMode: mode.value })}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      aiConfig.rewriteMode === mode.value
                        ? 'border-slack-purple bg-slack-purple/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{mode.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt del sistema (instrucciones para la IA)
              </label>
              <textarea
                value={aiConfig.systemPrompt || ''}
                onChange={(e) => updateAI({ systemPrompt: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                placeholder="Ej: Eres un coach de ventas motivador que escribe mensajes cortos en español..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperatura ({aiConfig.temperature?.toFixed(1) || '0.7'})
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={aiConfig.temperature || 0.7}
                  onChange={(e) => updateAI({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-slack-purple"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Preciso</span>
                  <span>Creativo</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tokens máximos
                </label>
                <input
                  type="number"
                  min={50}
                  max={500}
                  value={aiConfig.maxTokens || 120}
                  onChange={(e) => updateAI({ maxTokens: parseInt(e.target.value) || 120 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slack-purple focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Step 6: Review before saving
 */
function StepReview({
  campaign,
  salesUsers,
}: {
  campaign: ReturnType<typeof createDefaultCampaign>;
  salesUsers: SalesUser[];
}) {
  const recipientCount = (() => {
    const config = campaign.recipientConfig;
    if (config.sourceType === 'sales_user_type' && config.salesUserTypes?.length) {
      return salesUsers.filter((u) => config.salesUserTypes!.includes(u.tipo)).length;
    }
    if (config.sourceType === 'specific_users') {
      return config.specificUserIds?.length || 0;
    }
    if (config.sourceType === 'channel') {
      return config.channelIds?.length || 0;
    }
    return 0;
  })();

  const dataFeatures = [];
  if (campaign.dataConfig?.fetchSolicitudes) dataFeatures.push('Solicitudes');
  if (campaign.dataConfig?.fetchVentasAvanzadas) dataFeatures.push('Ventas avanzadas');
  if (campaign.dataConfig?.fetchVentasReales) dataFeatures.push('Ventas reales');
  if (campaign.dataConfig?.fetchVideollamadas) dataFeatures.push('Videollamadas');
  if (campaign.dataConfig?.calculatePerformanceCategory) dataFeatures.push('Categoría de desempeño');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Revisar Campaña</h3>
        <p className="text-sm text-gray-500">
          Verifica toda la configuración antes de guardar.
        </p>
      </div>

      <div className="space-y-4">
        {/* Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Información</h4>
          <p className="text-lg font-semibold text-gray-900">{campaign.name || '(sin nombre)'}</p>
          {campaign.description && (
            <p className="text-sm text-gray-600 mt-1">{campaign.description}</p>
          )}
          {campaign.mentionUser && (
            <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
              Menciona al usuario
            </span>
          )}
        </div>

        {/* Recipients */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Destinatarios</h4>
          <p className="text-gray-900">
            {formatRecipientSummary(campaign.recipientConfig)}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {recipientCount} destinatario(s)
          </p>
        </div>

        {/* Schedule */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Horarios</h4>
          {campaign.scheduleSlots.length === 0 ? (
            <p className="text-red-600 text-sm">Sin horarios configurados</p>
          ) : (
            <div className="space-y-2">
              {campaign.scheduleSlots.map((slot) => (
                <div key={slot.id} className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{slot.time}</span>
                  <span className="text-gray-500">-</span>
                  <span>
                    {slot.daysOfWeek
                      .map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.label)
                      .join(', ')}
                  </span>
                  {slot.label && (
                    <span className="text-gray-400">({slot.label})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">
            Mensaje ({campaign.messageVariants.length} variante(s))
          </h4>
          <div className="space-y-2">
            {campaign.messageVariants.map((v) => (
              <div key={v.id} className="text-sm">
                <span className="font-medium text-gray-900">{v.label}</span>
                <span className="text-gray-500 ml-2">
                  ({v.conditionType === 'always'
                    ? 'Siempre'
                    : v.conditionType === 'performance_category'
                    ? `Categorías: ${v.performanceCategories?.join(', ') || 'ninguna'}`
                    : `${v.metricField} ${v.metricOperator} ${v.metricValue}`})
                </span>
                {v.messageTemplate && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{v.messageTemplate}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Data & AI */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Datos e IA</h4>
          {dataFeatures.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-2">
              {dataFeatures.map((f) => (
                <span key={f} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 mb-2">Sin datos de HubSpot</p>
          )}
          <p className="text-sm text-gray-600">
            IA: {campaign.aiConfig?.enabled ? `Activada (${campaign.aiConfig.rewriteMode})` : 'Desactivada'}
          </p>
        </div>

        {/* Warnings */}
        {(!campaign.name || campaign.scheduleSlots.length === 0 || recipientCount === 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-yellow-800 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Advertencias</span>
            </div>
            <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
              {!campaign.name && <li>La campaña no tiene nombre</li>}
              {campaign.scheduleSlots.length === 0 && <li>No hay horarios configurados</li>}
              {recipientCount === 0 && <li>No hay destinatarios seleccionados</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================================
// Campaign Card Component
// ==========================================================================

function CampaignCard({
  campaign,
  onEdit,
  onToggle,
  onDuplicate,
  onDelete,
  onViewHistory,
}: {
  campaign: MessageCampaign;
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onViewHistory: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {campaign.name}
            </h3>
            <span
              className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                campaign.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {campaign.isActive ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          {campaign.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {campaign.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
            <span className="inline-flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{formatRecipientSummary(campaign.recipientConfig)}</span>
            </span>
            <span className="inline-flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{formatScheduleSummary(campaign.scheduleSlots)}</span>
            </span>
            <span className="inline-flex items-center space-x-1">
              <MessageSquare className="w-4 h-4" />
              <span>{campaign.messageVariants.length} variante(s)</span>
            </span>
            {campaign.aiConfig?.enabled && (
              <span className="inline-flex items-center space-x-1 text-purple-600">
                <Sparkles className="w-4 h-4" />
                <span>IA</span>
              </span>
            )}
          </div>

          {campaign.executionCount > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Ejecutada {campaign.executionCount} vez(es)
              {campaign.lastExecuted &&
                ` - Última: ${campaign.lastExecuted.toDate().toLocaleDateString('es-MX')}`}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-1 ml-4 shrink-0">
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg transition-colors ${
              campaign.isActive
                ? 'text-green-600 hover:bg-green-50'
                : 'text-gray-400 hover:bg-gray-50'
            }`}
            title={campaign.isActive ? 'Desactivar' : 'Activar'}
          >
            <Power className="w-5 h-5" />
          </button>
          <button
            onClick={onViewHistory}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Ver historial"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Duplicar"
          >
            <Copy className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

// ==========================================================================
// Main Scheduler Page
// ==========================================================================

export function Scheduler() {
  const { selectedWorkspace } = useAppStore();
  const { user } = useAuthStore();

  // Data state
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingCampaign, setEditingCampaign] = useState<MessageCampaign | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(createDefaultCampaign());
  const [saving, setSaving] = useState(false);

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

  // Load sales users
  useEffect(() => {
    if (!selectedWorkspace) return;
    salesUserService
      .getByWorkspace(selectedWorkspace.id)
      .then(setSalesUsers)
      .catch((err) => console.error('Error loading sales users:', err));
  }, [selectedWorkspace]);

  // Form handlers
  const updateFormData = useCallback(
    (updates: Partial<ReturnType<typeof createDefaultCampaign>>) => {
      setFormData((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const openCreateForm = () => {
    setEditingCampaign(null);
    setFormData({
      ...createDefaultCampaign(),
      workspaceId: selectedWorkspace?.id || '',
    });
    setCurrentStep(0);
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
        await campaignService.update(editingCampaign.id, {
          ...formData,
          updatedAt: Timestamp.now(),
        });
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
    } catch (error) {
      toast.error('Error al cambiar estado de la campaña');
    }
  };

  const duplicateCampaign = async (campaign: MessageCampaign) => {
    if (!selectedWorkspace || !user) return;
    try {
      await campaignService.create({
        ...campaign,
        name: `${campaign.name} (Copia)`,
        isActive: false,
        executionCount: 0,
        createdBy: user.id || 'mock-user-id',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as any);
      toast.success('Campaña duplicada');
    } catch (error) {
      toast.error('Error al duplicar la campaña');
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('¿Eliminar esta campaña? Esta acción no se puede deshacer.')) return;
    try {
      await campaignService.delete(campaignId);
      toast.success('Campaña eliminada');
    } catch (error) {
      toast.error('Error al eliminar la campaña');
    }
  };

  const viewHistory = async (campaign: MessageCampaign) => {
    setHistoryModalCampaign(campaign);
    setLoadingHistory(true);
    try {
      const data = await campaignExecutionService.getByCampaign(campaign.id, 20);
      setExecutions(data);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Error al cargar historial');
    } finally {
      setLoadingHistory(false);
    }
  };

  // No workspace selected
  if (!selectedWorkspace) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sin Workspace Seleccionado
        </h2>
        <p className="text-gray-600">
          Selecciona un workspace desde el encabezado para gestionar campañas.
        </p>
      </div>
    );
  }

  // ===== FORM VIEW =====
  if (view === 'form') {
    return (
      <div className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={cancelForm}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {editingCampaign ? 'Editar Campaña' : 'Nueva Campaña'}
              </h1>
              <p className="text-sm text-gray-500">
                {WIZARD_STEPS[currentStep].label} - Paso {currentStep + 1} de{' '}
                {WIZARD_STEPS.length}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={cancelForm}>
              Cancelar
            </Button>
            <Button onClick={saveCampaign} isLoading={saving}>
              {editingCampaign ? 'Actualizar' : 'Crear Campaña'}
            </Button>
          </div>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} onStepClick={setCurrentStep} />

        {/* Step Content */}
        <Card>
          {currentStep === 0 && (
            <StepBasics campaign={formData} onChange={updateFormData} />
          )}
          {currentStep === 1 && (
            <StepRecipients
              campaign={formData}
              onChange={updateFormData}
              salesUsers={salesUsers}
            />
          )}
          {currentStep === 2 && (
            <StepSchedule campaign={formData} onChange={updateFormData} />
          )}
          {currentStep === 3 && (
            <StepMessage campaign={formData} onChange={updateFormData} />
          )}
          {currentStep === 4 && (
            <StepAIData campaign={formData} onChange={updateFormData} />
          )}
          {currentStep === 5 && (
            <StepReview campaign={formData} salesUsers={salesUsers} />
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>

          <div className="flex items-center space-x-3">
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button onClick={() => setCurrentStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}>
                Siguiente
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={saveCampaign} isLoading={saving}>
                {editingCampaign ? 'Actualizar Campaña' : 'Crear Campaña'}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Programador de Mensajes</h1>
          <p className="text-gray-600 mt-1">
            Crea y gestiona campañas de mensajes automatizados sin código
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Campaña
        </Button>
      </div>

      {/* Stats */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <div className="text-sm text-gray-500">Total campañas</div>
            <div className="text-2xl font-bold text-gray-900">{campaigns.length}</div>
          </Card>
          <Card>
            <div className="text-sm text-gray-500">Activas</div>
            <div className="text-2xl font-bold text-green-600">
              {campaigns.filter((c) => c.isActive).length}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-gray-500">Ejecuciones totales</div>
            <div className="text-2xl font-bold text-slack-purple">
              {campaigns.reduce((sum, c) => sum + c.executionCount, 0)}
            </div>
          </Card>
        </div>
      )}

      {/* Campaign List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando campañas...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Sin Campañas
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Crea tu primera campaña para automatizar el envío de mensajes personalizados
            a tus equipos de ventas, sin necesidad de escribir código.
          </p>
          <Button onClick={openCreateForm}>
            <Plus className="w-4 h-4 mr-2" />
            Crear Primera Campaña
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={() => openEditForm(campaign)}
              onToggle={() => toggleCampaign(campaign)}
              onDuplicate={() => duplicateCampaign(campaign)}
              onDelete={() => deleteCampaign(campaign.id)}
              onViewHistory={() => viewHistory(campaign)}
            />
          ))}
        </div>
      )}

      {/* History Modal */}
      {historyModalCampaign && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setHistoryModalCampaign(null)}
            />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Historial - {historyModalCampaign.name}
                </h2>
                <button
                  onClick={() => setHistoryModalCampaign(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
                  </div>
                ) : executions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No hay ejecuciones registradas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {executions.map((exec) => (
                      <div
                        key={exec.id}
                        className="border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            {exec.executedAt.toDate().toLocaleString('es-MX')}
                          </span>
                          <div className="flex items-center space-x-3 text-sm">
                            <span className="text-green-600">
                              {exec.successCount} enviado(s)
                            </span>
                            {exec.failureCount > 0 && (
                              <span className="text-red-600">
                                {exec.failureCount} fallido(s)
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {exec.recipientCount} destinatario(s)
                        </p>
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
