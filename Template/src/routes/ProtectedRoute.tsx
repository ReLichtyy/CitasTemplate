import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  // `from` todavia no tiene consumidor: LoginPage sigue siendo un placeholder. Es
  // deliberado, no un descuido — spec/06 exige que el login devuelva al destino, y ese
  // dato tiene que estar guardado cuando se implemente (spec/03). No borrar.
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/auth/login" state={{ from: location }} replace />
  );
}
