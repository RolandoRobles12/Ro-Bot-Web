import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User, UserRole } from '@/types';
import { Timestamp } from 'firebase/firestore';

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

// TEMPORARY: Mock user for development (remove when Firebase Auth is configured)
const MOCK_USER: User = {
  id: 'mock-user-id',
  email: 'dev@example.com',
  displayName: 'Usuario de Desarrollo',
  role: 'admin',
  createdAt: Timestamp.now(),
  lastLogin: Timestamp.now(),
};

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  user: MOCK_USER, // TEMPORARY: Using mock user
  loading: false, // TEMPORARY: Set to false to skip loading screen
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
