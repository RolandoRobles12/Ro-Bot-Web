import { ReactNode } from 'react';
import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  // TEMPORARY: Bypass authentication for development
  // TODO: Remove this and uncomment the auth check below once Firebase Auth is configured
  return <>{children}</>;

  /* ORIGINAL AUTH CODE - UNCOMMENT WHEN FIREBASE AUTH IS READY
  import { Navigate } from 'react-router-dom';
  import { useAuth } from '@/hooks/useAuth';
  import { useAuthStore } from '@/store/authStore';

  const { loading, user } = useAuth();
  const { hasRole } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">
            You don't have permission to access this page. Required role:{' '}
            {requiredRole}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
  */
}
