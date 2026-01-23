import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Templates } from './pages/Templates';
import { SendMessage } from './pages/SendMessage';
import { Workspaces } from './pages/Workspaces';
import { useAuth } from './hooks/useAuth';

function App() {
  const { loading } = useAuth();

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

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/templates"
            element={
              <ProtectedRoute>
                <Layout>
                  <Templates />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/send"
            element={
              <ProtectedRoute requiredRole="editor">
                <Layout>
                  <SendMessage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/workspaces"
            element={
              <ProtectedRoute requiredRole="admin">
                <Layout>
                  <Workspaces />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
