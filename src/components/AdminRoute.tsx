import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-white">Verificando permissões...</div>;
  }

  if (!user || role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
