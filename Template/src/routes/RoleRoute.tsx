import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../services/authService';

export function RoleRoute({ allow }: { allow: Role[] }) {
  const { role } = useAuth();
  if (!role || !allow.includes(role)) {
    return <Navigate to="/sistema/no-autorizado" replace />;
  }
  return <Outlet />;
}
