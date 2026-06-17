import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, Sparkles, ExternalLink, Database, CalendarClock, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { agentBuildCampaign } from '@/services/cloudFunctions';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created?: {
    dataSource?: { id: string; name: string; availableVariables: string[] };
    campaign?: { id: string; name: string };
  };
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    '¡Hola! Soy tu asistente de Ro-Bot. Puedo crear fuentes de datos y campañas de mensajes automáticamente.\n\nCuéntame qué necesitas, por ejemplo:\n• "Envía a mis vendedores cada día a la 1pm y 5pm las solicitudes del día"\n• "Crea un reporte semanal los lunes a las 9am con las ventas del mes"',
};

const SUGGESTIONS = [
  'Reporte diario de solicitudes a la 1pm y 5pm para todos los vendedores',
  'Resumen semanal los lunes a las 9am con ventas del mes',
  '¿Qué pipelines tengo disponibles?',
];

export function AgentBuilder() {
  const { selectedWorkspace } = useAppStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading || !selectedWorkspace) return;

      const userMsg: ChatMessage = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        // Build history: skip welcome message, include everything after
        const history = [...messages.slice(1), userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const result = await agentBuildCampaign({
          messages: history,
          workspaceId: selectedWorkspace.id,
        });

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: result.data.message,
            created: result.data.created,
          },
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

  function resetChat() {
    setMessages([WELCOME]);
    setInput('');
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
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-slack-purple rounded-full flex items-center justify-center flex-shrink-0 mb-0.5">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            <div className="max-w-[82%] space-y-2">
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-slack-purple text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                }`}
              >
                {msg.content}
              </div>

              {/* Created resources */}
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

              {/* Suggestions on welcome message */}
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
