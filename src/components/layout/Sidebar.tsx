import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Send,
  Calendar,
  History,
  Settings,
  Zap,
  Users,
  MessageSquare,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['viewer', 'editor', 'admin'] },
  { name: 'Templates', href: '/templates', icon: FileText, roles: ['viewer', 'editor', 'admin'] },
  { name: 'Send Message', href: '/send', icon: Send, roles: ['editor', 'admin'] },
  { name: 'Scheduled', href: '/scheduled', icon: Calendar, roles: ['viewer', 'editor', 'admin'] },
  { name: 'History', href: '/history', icon: History, roles: ['viewer', 'editor', 'admin'] },
  { name: 'Rules', href: '/rules', icon: Zap, roles: ['editor', 'admin'] },
  { name: 'Teams', href: '/teams', icon: Users, roles: ['admin'] },
  { name: 'Workspaces', href: '/workspaces', icon: MessageSquare, roles: ['admin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['viewer', 'editor', 'admin'] },
];

export function Sidebar() {
  const { user, hasRole } = useAuthStore();

  return (
    <div className="flex flex-col h-full bg-slack-purple text-white">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-slack-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ro-Bot</h1>
            <p className="text-xs text-white/70">Slack Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const canAccess = item.roles.some((role) => hasRole(role as any));

          if (!canAccess) return null;

          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center space-x-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">
                  {user.displayName?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-white/70 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
