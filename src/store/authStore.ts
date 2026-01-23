import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User, UserRole } from '@/types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  hasRole: (role: UserRole) => boolean;
  isAdmin: () => boolean;
  isEditor: () => boolean;
  isViewer: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  user: null,
  loading: true,
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  hasRole: (role) => {
    const { user } = get();
    if (!user) return false;

    const roleHierarchy: Record<UserRole, number> = {
      viewer: 1,
      editor: 2,
      admin: 3,
    };

    return roleHierarchy[user.role] >= roleHierarchy[role];
  },
  isAdmin: () => get().user?.role === 'admin',
  isEditor: () => {
    const role = get().user?.role;
    return role === 'editor' || role === 'admin';
  },
  isViewer: () => {
    const role = get().user?.role;
    return role === 'viewer' || role === 'editor' || role === 'admin';
  },
}));
