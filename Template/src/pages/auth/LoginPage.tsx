import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { useAccionApi } from '../../hooks/useAccionApi';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

/** A donde va quien entra sin venir de ninguna parte. */
const DESTINO_POR_DEFECTO = '/citas';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [credenciales, setCredenciales] = useState({ telefono: '', password: '' });
  // `useAccionApi` trae el `enviando`, el texto del API y —lo que importa aqui— el freno
  // al segundo envio: dos `submit` seguidos gastaban dos de los diez intentos por IP.
  const entrar = useAccionApi(authService.login);

  // `ProtectedRoute` guarda aqui la ruta que el visitante queria abrir. Volver a ella es
  // el punto de exigir sesion; mandarlo siempre al inicio le hace repetir el camino.
  const destino =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    DESTINO_POR_DEFECTO;

  if (isAuthenticated) {
    return <Navigate to={destino} replace />;
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const sesion = await entrar.ejecutar(credenciales);
    if (sesion) {
      login(sesion);
      navigate(destino, { replace: true });
    }
  }

  return (
    <AuthShell
      eyebrow="Su cuenta"
      titulo="Iniciar sesion"
      descripcion="Entre con el telefono que dio al agendar. Para reservar no hace falta cuenta."
      pie={
        <>
          No tiene cuenta?{' '}
          <Link to="/auth/registro" className="font-medium text-accent-ink">
            Crear una
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
        <Field
          label="Telefono"
          type="tel"
          required
          autoComplete="tel"
          autoFocus
          placeholder="8888 8888"
          value={credenciales.telefono}
          disabled={entrar.enviando}
          onChange={(evento) =>
            setCredenciales((datos) => ({ ...datos, telefono: evento.target.value }))
          }
        />
        <Field
          label="Contrasena"
          type="password"
          required
          autoComplete="current-password"
          value={credenciales.password}
          disabled={entrar.enviando}
          onChange={(evento) =>
            setCredenciales((datos) => ({ ...datos, password: evento.target.value }))
          }
        />

        {/* El texto sale del API. Un telefono inexistente y una contrasena incorrecta
            devuelven el mismo error a proposito: no se confirma quien esta registrado. */}
        {entrar.error && <Alert>{entrar.error}</Alert>}

        <Button type="submit" disabled={entrar.enviando}>
          {entrar.enviando ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </AuthShell>
  );
}
