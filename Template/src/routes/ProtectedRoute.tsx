import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type ProtectedRouteProps = {
  /**
   * A donde va quien no tiene sesion. El login es el destino por defecto porque suele
   * haber algo que terminar despues de entrar; las citas propias usan la pagina de sin
   * acceso, porque ahi no hay nada que un invitado pueda completar entrando.
   */
  redirigirA?: string;
};

export function ProtectedRoute({ redirigirA = '/auth/login' }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  // `from` lo lee `LoginPage` para volver al destino que el visitante queria abrir, que es
  // el punto de exigir sesion en vez de mandarlo siempre al inicio (06-hero-landing.md).
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to={redirigirA} state={{ from: location }} replace />
  );
}
