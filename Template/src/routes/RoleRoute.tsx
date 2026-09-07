import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Rol } from '../services/authService';

export function RoleRoute({ allow }: { allow: Rol[] }) {
  const { rol } = useAuth();
  if (!rol || !allow.includes(rol)) {
    return <Navigate to="/sistema/no-autorizado" replace />;
  }
  return <Outlet />;
}
