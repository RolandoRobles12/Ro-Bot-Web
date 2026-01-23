import { create } from 'zustand';
import { SlackWorkspace } from '@/types';

interface AppState {
  selectedWorkspace: SlackWorkspace | null;
  workspaces: SlackWorkspace[];
  setSelectedWorkspace: (workspace: SlackWorkspace | null) => void;
  setWorkspaces: (workspaces: SlackWorkspace[]) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedWorkspace: null,
  workspaces: [],
  setSelectedWorkspace: (workspace) => set({ selectedWorkspace: workspace }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
