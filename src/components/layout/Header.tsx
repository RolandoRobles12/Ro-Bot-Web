import { Menu, LogOut, Bell } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import Select from 'react-select';
import { SlackWorkspace } from '@/types';
import { useEffect, useState } from 'react';
import { workspaceService } from '@/services/firestore';

export function Header() {
  const { toggleSidebar, selectedWorkspace, setSelectedWorkspace } = useAppStore();
  const { signOut } = useAuth();
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = workspaceService.subscribe((ws) => {
      setWorkspaces(ws);
      if (ws.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(ws[0]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedWorkspace, setSelectedWorkspace]);

  const workspaceOptions = workspaces.map((ws) => ({
    value: ws.id,
    label: ws.name,
    workspace: ws,
  }));

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleSidebar}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Workspace Selector */}
        <div className="w-64">
          <Select
            value={workspaceOptions.find((opt) => opt.value === selectedWorkspace?.id)}
            onChange={(option) => option && setSelectedWorkspace(option.workspace)}
            options={workspaceOptions}
            isLoading={loading}
            placeholder="Select workspace..."
            className="text-sm"
            classNamePrefix="select"
            styles={{
              control: (base) => ({
                ...base,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#4A154B',
                },
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected
                  ? '#4A154B'
                  : state.isFocused
                  ? '#f3f4f6'
                  : 'white',
              }),
            }}
          />
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-slack-red rounded-full"></span>
        </button>

        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>
  );
}
