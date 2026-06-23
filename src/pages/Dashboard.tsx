import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useAppStore } from '@/store/appStore';
import {
  scheduledMessageService,
  messageHistoryService,
  campaignExecutionService,
  campaignService,
} from '@/services/firestore';
import {
  ScheduledMessage,
  MessageHistory,
  CampaignExecution,
  MessageCampaign,
  CampaignScheduleSlot,
} from '@/types';
import { MessageSquare, Calendar, Clock, TrendingUp, Megaphone } from 'lucide-react';
import { format } from 'date-fns';

type ActivityItem =
  | { kind: 'history'; data: MessageHistory }
  | { kind: 'campaign'; data: CampaignExecution };

type UpcomingItem =
  | { kind: 'message'; data: ScheduledMessage }
  | { kind: 'campaign'; data: MessageCampaign; nextAt: Date; slot: CampaignScheduleSlot };

/**
 * Computes the next UTC Date when a schedule slot will fire.
 * Uses the slot's timezone to determine day-of-week boundaries.
 */
function getNextSlotOccurrence(slot: CampaignScheduleSlot): Date {
  const tz = slot.timezone || 'America/Mexico_City';
  const [slotH, slotM] = slot.time.split(':').map(Number);
  const days = slot.daysOfWeek;
  if (!days.length) return new Date(Date.now() + 365 * 86400000);

  const now = new Date();
  // Express "now" in the target timezone by leveraging toLocaleString
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const tzDow = tzNow.getDay();
  const tzH = tzNow.getHours();
  const tzM = tzNow.getMinutes();

  let minDaysAhead = Infinity;
  for (const dow of days) {
    let ahead = (dow - tzDow + 7) % 7;
    if (ahead === 0 && (slotH < tzH || (slotH === tzH && slotM <= tzM))) {
      ahead = 7;
    }
    if (ahead < minDaysAhead) minDaysAhead = ahead;
  }

  if (!isFinite(minDaysAhead)) return new Date(Date.now() + 365 * 86400000);

  const nextInTz = new Date(tzNow);
  nextInTz.setDate(nextInTz.getDate() + minDaysAhead);
  nextInTz.setHours(slotH, slotM, 0, 0);

  // Compute UTC equivalent: tzNow represents wall-clock of "now" in the target
  // timezone but stored in local offset, so the delta gives us the tz offset.
  const tzOffset = now.getTime() - tzNow.getTime();
  return new Date(nextInTz.getTime() + tzOffset);
}

function getNextCampaignOccurrence(campaign: MessageCampaign): { nextAt: Date; slot: CampaignScheduleSlot } | null {
  if (!campaign.scheduleSlots?.length) return null;

  let best: { nextAt: Date; slot: CampaignScheduleSlot } | null = null;
  for (const slot of campaign.scheduleSlots) {
    const nextAt = getNextSlotOccurrence(slot);
    if (!best || nextAt < best.nextAt) best = { nextAt, slot };
  }
  return best;
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function Dashboard() {
  const { selectedWorkspace } = useAppStore();
  const [upcomingMessages, setUpcomingMessages] = useState<ScheduledMessage[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<MessageCampaign[]>([]);
  const [recentHistory, setRecentHistory] = useState<MessageHistory[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<CampaignExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedWorkspace) return;

    const unsubscribe1 = scheduledMessageService.subscribe(
      selectedWorkspace.id,
      (messages) => {
        setUpcomingMessages(messages.filter((m) => m.status === 'scheduled'));
      }
    );

    const unsubscribe4 = campaignService.subscribe(
      selectedWorkspace.id,
      (campaigns) => {
        setActiveCampaigns(campaigns.filter((c) => c.isActive));
      }
    );

    let historyReady = false;
    let executionsReady = false;
    const checkReady = () => {
      if (historyReady && executionsReady) setLoading(false);
    };

    const unsubscribe2 = messageHistoryService.subscribe(
      selectedWorkspace.id,
      (history) => {
        setRecentHistory(history.slice(0, 20));
        historyReady = true;
        checkReady();
      },
      20
    );

    const unsubscribe3 = campaignExecutionService.subscribeByWorkspace(
      selectedWorkspace.id,
      (executions) => {
        setRecentExecutions(executions);
        executionsReady = true;
        checkReady();
      },
      20
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
      unsubscribe4();
    };
  }, [selectedWorkspace]);

  if (!selectedWorkspace) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sin Workspace Seleccionado
        </h2>
        <p className="text-gray-600">
          Por favor selecciona un workspace desde el encabezado para continuar.
        </p>
      </div>
    );
  }

  const today = new Date().toDateString();

  const sentTodayCount =
    recentHistory.filter(
      (h) => h.sentAt.toDate().toDateString() === today && h.status === 'sent'
    ).length +
    recentExecutions
      .filter((e) => e.executedAt.toDate().toDateString() === today)
      .reduce((sum, e) => sum + e.successCount, 0);

  const failedTodayCount =
    recentHistory.filter(
      (h) => h.sentAt.toDate().toDateString() === today && h.status === 'failed'
    ).length +
    recentExecutions
      .filter((e) => e.executedAt.toDate().toDateString() === today)
      .reduce((sum, e) => sum + e.failureCount, 0);

  // Build upcoming items: manual messages + active campaign next fires
  const upcomingItems: UpcomingItem[] = [
    ...upcomingMessages.slice(0, 5).map((m): UpcomingItem => ({ kind: 'message', data: m })),
    ...activeCampaigns
      .map((c): UpcomingItem | null => {
        const next = getNextCampaignOccurrence(c);
        return next ? { kind: 'campaign', data: c, ...next } : null;
      })
      .filter((x): x is UpcomingItem => x !== null),
  ].sort((a, b) => {
    const tA = a.kind === 'message' ? a.data.scheduledAt.toDate() : a.nextAt;
    const tB = b.kind === 'message' ? b.data.scheduledAt.toDate() : b.nextAt;
    return tA.getTime() - tB.getTime();
  }).slice(0, 8);

  const stats = [
    {
      name: 'Mensajes Próximos',
      value: upcomingItems.length,
      icon: Calendar,
      color: 'text-slack-blue',
      bgColor: 'bg-slack-blue/10',
    },
    {
      name: 'Enviados Hoy',
      value: sentTodayCount,
      icon: MessageSquare,
      color: 'text-slack-green',
      bgColor: 'bg-slack-green/10',
    },
    {
      name: 'Fallidos Hoy',
      value: failedTodayCount,
      icon: TrendingUp,
      color: 'text-slack-red',
      bgColor: 'bg-slack-red/10',
    },
  ];

  // Merge and sort activity items newest-first, keep latest 10
  const activityItems: ActivityItem[] = [
    ...recentHistory.map((h): ActivityItem => ({ kind: 'history', data: h })),
    ...recentExecutions.map((e): ActivityItem => ({ kind: 'campaign', data: e })),
  ]
    .sort((a, b) => {
      const tA = a.kind === 'history' ? a.data.sentAt.toDate() : a.data.executedAt.toDate();
      const tB = b.kind === 'history' ? b.data.sentAt.toDate() : b.data.executedAt.toDate();
      return tB.getTime() - tA.getTime();
    })
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Panel</h1>
        <p className="text-gray-600 mt-1">
          Resumen de tus notificaciones de Slack para {selectedWorkspace.name}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Mensajes Próximos</CardTitle>
            <CardDescription>Mensajes programados y próximas campañas activas</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
            </div>
          ) : upcomingItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No hay mensajes próximos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingItems.map((item) => {
                if (item.kind === 'message') {
                  const m = item.data;
                  return (
                    <div key={`m-${m.id}`} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{m.name}</h4>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{m.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center mt-3 text-sm text-gray-500">
                        <Clock className="w-4 h-4 mr-1" />
                        {format(m.scheduledAt.toDate(), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                  );
                }

                const c = item.data;
                const slotDays = item.slot.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ');
                return (
                  <div key={`c-${c.id}-${item.slot.id}`} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Megaphone className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <h4 className="font-medium text-gray-900 truncate">{c.name}</h4>
                        </div>
                        <p className="text-xs text-gray-500">
                          {item.slot.label ? `${item.slot.label} · ` : ''}{slotDays} · {item.slot.time}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 whitespace-nowrap shrink-0">
                        campaña
                      </span>
                    </div>
                    <div className="flex items-center mt-3 text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      {format(item.nextAt, 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>Últimos mensajes enviados (directos y campañas)</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
            </div>
          ) : activityItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>Aún no se han enviado mensajes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activityItems.map((item) => {
                if (item.kind === 'history') {
                  const h = item.data;
                  return (
                    <div key={`h-${h.id}`} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-gray-900 line-clamp-2">{h.content}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Para: {h.recipients.map((r) => r.name).join(', ')}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            h.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {h.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {format(h.sentAt.toDate(), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                  );
                }

                const e = item.data;
                return (
                  <div key={`e-${e.id}`} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Megaphone className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <p className="text-sm font-medium text-gray-900">{e.campaignName}</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {e.successCount} enviados · {e.failureCount} fallidos · {e.recipientCount} destinatarios
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          e.failureCount === 0
                            ? 'bg-green-100 text-green-800'
                            : e.successCount === 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {e.failureCount === 0 ? 'sent' : e.successCount === 0 ? 'failed' : 'partial'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {format(e.executedAt.toDate(), 'MMM dd, yyyy HH:mm')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
