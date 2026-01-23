import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useAppStore } from '@/store/appStore';
import { scheduledMessageService, messageHistoryService } from '@/services/firestore';
import { ScheduledMessage, MessageHistory } from '@/types';
import { MessageSquare, Calendar, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export function Dashboard() {
  const { selectedWorkspace } = useAppStore();
  const [upcomingMessages, setUpcomingMessages] = useState<ScheduledMessage[]>([]);
  const [recentHistory, setRecentHistory] = useState<MessageHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedWorkspace) return;

    const unsubscribe1 = scheduledMessageService.subscribe(
      selectedWorkspace.id,
      (messages) => {
        setUpcomingMessages(messages.filter((m) => m.status === 'scheduled').slice(0, 5));
      }
    );

    const unsubscribe2 = messageHistoryService.subscribe(
      selectedWorkspace.id,
      (history) => {
        setRecentHistory(history.slice(0, 10));
        setLoading(false);
      },
      10
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [selectedWorkspace]);

  if (!selectedWorkspace) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          No Workspace Selected
        </h2>
        <p className="text-gray-600">
          Please select a workspace from the header to continue.
        </p>
      </div>
    );
  }

  const stats = [
    {
      name: 'Upcoming Messages',
      value: upcomingMessages.length,
      icon: Calendar,
      color: 'text-slack-blue',
      bgColor: 'bg-slack-blue/10',
    },
    {
      name: 'Sent Today',
      value: recentHistory.filter(
        (h) =>
          h.sentAt.toDate().toDateString() === new Date().toDateString() &&
          h.status === 'sent'
      ).length,
      icon: MessageSquare,
      color: 'text-slack-green',
      bgColor: 'bg-slack-green/10',
    },
    {
      name: 'Failed Today',
      value: recentHistory.filter(
        (h) =>
          h.sentAt.toDate().toDateString() === new Date().toDateString() &&
          h.status === 'failed'
      ).length,
      icon: TrendingUp,
      color: 'text-slack-red',
      bgColor: 'bg-slack-red/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Overview of your Slack notifications for {selectedWorkspace.name}
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
            <CardTitle>Upcoming Messages</CardTitle>
            <CardDescription>Next scheduled messages</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
            </div>
          ) : upcomingMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No upcoming messages</p>
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
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest sent messages</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
            </div>
          ) : recentHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No messages sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 line-clamp-2">
                        {item.content}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        To: {item.recipients.map((r) => r.name).join(', ')}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        item.status === 'sent'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {format(item.sentAt.toDate(), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
