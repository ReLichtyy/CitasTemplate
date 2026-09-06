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
  // `from` todavia no tiene consumidor: LoginPage sigue siendo un placeholder. Es
  // deliberado, no un descuido — 06-hero-landing.md exige que el login devuelva al destino, y ese
  // dato tiene que estar guardado cuando se implemente (03-autorizacion.md). No borrar.
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to={redirigirA} state={{ from: location }} replace />
  );
}
