import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Send, Sparkles, ExternalLink, Database, CalendarClock,
  RefreshCw, CheckCircle, XCircle, Clock, Users, FileText,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { agentBuildCampaign } from '@/services/cloudFunctions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentPlan {
  summary: string;
  dataSource?: {
    name: string;
    pipelineName: string;
    stageNames?: string[];
    filterByOwner: boolean;
    dateRange: string;
  };
  campaign?: {
    name: string;
    messageTemplate: string;
    schedules: { daysOfWeek: number[]; time: string; label?: string }[];
    recipientType: string;
    salesUserTypes?: string[];
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  plan?: AgentPlan;
  planConfirmed?: boolean;
  created?: {
    dataSource?: { id: string; name: string; availableVariables: string[] };
    campaign?: { id: string; name: string };
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const DATE_RANGE_LABELS: Record<string, string> = {
  today: 'hoy',
  current_week: 'semana en curso',
  current_month: 'mes en curso',
};

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    '¡Hola! Soy tu asistente de Ro-Bot. Puedo ayudarte a crear fuentes de datos y campañas de mensajes.\n\nAntes de crear cualquier cosa te mostraré un plan para que lo revises y apruebes.',
};

const SUGGESTIONS = [
  'Reporte diario de solicitudes a la 1pm y 5pm para todos los vendedores',
  'Resumen semanal los lunes a las 9am con ventas del mes',
  '¿Qué pipelines tengo configurados?',
];

const STORAGE_PREFIX = 'ro-bot-agent-';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlanCard({
  plan,
  confirmed,
  onConfirm,
  onCancel,
}: {
  plan: AgentPlan;
  confirmed?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={`border rounded-2xl overflow-hidden text-sm ${confirmed ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
      {/* Header */}
      <div className={`px-4 py-2.5 flex items-center gap-2 text-xs font-semibold ${confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {confirmed ? <CheckCircle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        {confirmed ? 'Plan confirmado y ejecutado' : 'Plan — revisa antes de confirmar'}
      </div>

      <div className="p-4 space-y-3">
        {/* DataSource plan */}
        {plan.dataSource && (
          <div className="space-y-1">
            <p className="font-semibold text-gray-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slack-purple" />
              Fuente de datos
            </p>
            <div className="ml-5 space-y-0.5 text-gray-600">
              <p><span className="text-gray-400">Nombre:</span> {plan.dataSource.name}</p>
              <p><span className="text-gray-400">Pipeline:</span> {plan.dataSource.pipelineName}</p>
              {plan.dataSource.stageNames && plan.dataSource.stageNames.length > 0 && (
                <p><span className="text-gray-400">Etapas:</span> {plan.dataSource.stageNames.join(', ')}</p>
              )}
              <p><span className="text-gray-400">Período:</span> {DATE_RANGE_LABELS[plan.dataSource.dateRange] || plan.dataSource.dateRange}</p>
              <p><span className="text-gray-400">Filtrar por dueño:</span> {plan.dataSource.filterByOwner ? 'Sí (solo deals del vendedor)' : 'No (todos los deals)'}</p>
            </div>
          </div>
        )}

        {/* Campaign plan */}
        {plan.campaign && (
          <div className="space-y-1">
            <p className="font-semibold text-gray-700 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-slack-purple" />
              Campaña
            </p>
            <div className="ml-5 space-y-0.5 text-gray-600">
              <p><span className="text-gray-400">Nombre:</span> {plan.campaign.name}</p>
              <p className="flex items-start gap-1">
                <span className="text-gray-400 flex-shrink-0">Horarios:</span>
                <span>{plan.campaign.schedules.map(s =>
                  `${s.daysOfWeek.map(d => DAY_NAMES[d]).join('/')} ${s.time}`
                ).join(' · ')}</span>
              </p>
              <p className="flex items-center gap-1">
                <span className="text-gray-400">Destinatarios:</span>
                <Users className="w-3 h-3" />
                {plan.campaign.recipientType === 'sales_user_type'
                  ? (plan.campaign.salesUserTypes?.length ? plan.campaign.salesUserTypes.join(', ') : 'todos los tipos')
                  : 'canal de Slack'}
              </p>
              <div>
                <p className="text-gray-400 mb-1">Mensaje:</p>
                <pre className="whitespace-pre-wrap font-mono text-xs bg-white/80 border border-gray-200 rounded-lg p-2 text-gray-700">
                  {plan.campaign.messageTemplate}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Confirm / Cancel */}
        {!confirmed && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onConfirm}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slack-purple text-white text-xs font-semibold rounded-xl hover:bg-slack-purple/90 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Confirmar y crear
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Ajustar
            </button>
          </div>
        )}

        {/* Execution time hint */}
        {!confirmed && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            La campaña se creará como borrador — podrás revisar y activar en el Programador.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentBuilder() {
  const { selectedWorkspace } = useAppStore();
  const navigate = useNavigate();

  const storageKey = selectedWorkspace ? `${STORAGE_PREFIX}${selectedWorkspace.id}` : null;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!storageKey) return [WELCOME];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ChatMessage[] = JSON.parse(saved);
        return parsed.length > 0 ? parsed : [WELCOME];
      }
    } catch {}
    return [WELCOME];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist conversation to localStorage on every change
  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Re-load when workspace changes
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ChatMessage[] = JSON.parse(saved);
        setMessages(parsed.length > 0 ? parsed : [WELCOME]);
        return;
      }
    } catch {}
    setMessages([WELCOME]);
  }, [storageKey]);

  const send = useCallback(
    async (text: string, isConfirmation = false) => {
      if (!text.trim() || loading || !selectedWorkspace) return;

      const userMsg: ChatMessage = { role: 'user', content: text.trim() };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput('');
      setLoading(true);

      try {
        // History for the API: skip welcome message, include all real messages
        const history = nextMessages
          .slice(1)
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await agentBuildCampaign({
          messages: history,
          workspaceId: selectedWorkspace.id,
          confirming: isConfirmation,
        });

        const { message, plan, created } = result.data;

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: message, plan, created },
        ]);
      } catch (err: any) {
        const msg = err?.message?.includes('OpenAI API key')
          ? 'No hay una API key de OpenAI configurada. Ve a Configuración > Integraciones para agregarla.'
          : `Ocurrió un error: ${err?.message || 'intenta de nuevo'}`;
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [messages, loading, selectedWorkspace]
  );

  function confirmPlan(msgIndex: number) {
    // Mark the message as confirmed
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, planConfirmed: true } : m))
    );
    send('Confirmado, procede a crear exactamente como lo planeaste.', true);
  }

  function cancelPlan() {
    send('Cancela ese plan. Dime qué debo ajustar.');
  }

  function resetChat() {
    setMessages([WELCOME]);
    setInput('');
    if (storageKey) localStorage.removeItem(storageKey);
    inputRef.current?.focus();
  }

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Selecciona un workspace para usar el asistente.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slack-purple rounded-xl flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Constructor con IA</h1>
            <p className="text-xs text-gray-500">Crea campañas con lenguaje natural</p>
          </div>
        </div>
        <button
          onClick={resetChat}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Nueva conversación</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-slack-purple rounded-full flex items-center justify-center flex-shrink-0 mb-0.5">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            <div className="max-w-[84%] space-y-2">
              {/* Bubble */}
              {msg.content && (
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-slack-purple text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              )}

              {/* Plan card */}
              {msg.plan && (
                <PlanCard
                  plan={msg.plan}
                  confirmed={msg.planConfirmed}
                  onConfirm={() => confirmPlan(i)}
                  onCancel={cancelPlan}
                />
              )}

              {/* Created resource links */}
              {msg.created?.dataSource && (
                <button
                  onClick={() => navigate('/data-sources')}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Database className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 text-left">
                    Fuente creada: <strong>{msg.created.dataSource.name}</strong>
                  </span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </button>
              )}
              {msg.created?.campaign && (
                <button
                  onClick={() => navigate('/scheduler')}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 text-left">
                    Campaña creada: <strong>{msg.created.campaign.name}</strong>
                  </span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </button>
              )}

              {/* Suggestion chips on welcome message only */}
              {i === 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={loading}
                      className="px-3 py-2 text-xs text-left text-slack-purple bg-slack-purple/5 border border-slack-purple/20 rounded-xl hover:bg-slack-purple/10 transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 bg-slack-purple rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="px-4 py-3 bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-slack-purple/50 focus-within:ring-2 focus-within:ring-slack-purple/10 transition-all">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Describe qué campaña quieres crear..."
          className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
          disabled={loading}
          autoFocus
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="w-8 h-8 bg-slack-purple text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-slack-purple/90 transition-colors flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
