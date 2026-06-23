import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useAppStore } from '@/store/appStore';
import { scheduledMessageService, messageHistoryService, campaignExecutionService } from '@/services/firestore';
import { ScheduledMessage, MessageHistory, CampaignExecution } from '@/types';
import { MessageSquare, Calendar, Clock, TrendingUp, Megaphone } from 'lucide-react';
import { format } from 'date-fns';

type ActivityItem =
  | { kind: 'history'; data: MessageHistory }
  | { kind: 'campaign'; data: CampaignExecution };

export function Dashboard() {
  const { selectedWorkspace } = useAppStore();
  const [upcomingMessages, setUpcomingMessages] = useState<ScheduledMessage[]>([]);
  const [recentHistory, setRecentHistory] = useState<MessageHistory[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<CampaignExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedWorkspace) return;

    const unsubscribe1 = scheduledMessageService.subscribe(
      selectedWorkspace.id,
      (messages) => {
        setUpcomingMessages(messages.filter((m) => m.status === 'scheduled').slice(0, 5));
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

  const stats = [
    {
      name: 'Mensajes Próximos',
      value: upcomingMessages.length,
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
            <CardDescription>Próximos mensajes programados</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
            </div>
          ) : upcomingMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No hay mensajes próximos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMessages.map((message) => (
                <div
                  key={message.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{message.name}</h4>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {message.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center mt-3 text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    {format(message.scheduledAt.toDate(), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              ))}
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
                    <div
                      key={`h-${h.id}`}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-gray-900 line-clamp-2">
                            {h.content}
                          </p>
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
                  <div
                    key={`e-${e.id}`}
                    className="p-4 bg-purple-50 rounded-lg border border-purple-200"
                  >
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
