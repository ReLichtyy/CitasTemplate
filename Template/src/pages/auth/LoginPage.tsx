import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

/** A donde va quien entra sin venir de ninguna parte. */
const DESTINO_POR_DEFECTO = '/citas';

function mensajeDe(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'No se pudo iniciar sesion.';
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [credenciales, setCredenciales] = useState({ telefono: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    setError(null);
    setEnviando(true);
    try {
      login(await authService.login(credenciales));
      navigate(destino, { replace: true });
    } catch (fallo) {
      setError(mensajeDe(fallo));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Iniciar sesion</h1>
        <p className="text-sm text-text">
          Entre con el telefono que dio al agendar. Para reservar no hace falta cuenta.
        </p>
      </div>

      <Card>
        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          <Field
            label="Telefono"
            type="tel"
            required
            autoComplete="tel"
            autoFocus
            placeholder="8888 8888"
            value={credenciales.telefono}
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
            onChange={(evento) =>
              setCredenciales((datos) => ({ ...datos, password: evento.target.value }))
            }
          />

          {/* El texto sale del API. Un telefono inexistente y una contrasena incorrecta
              devuelven el mismo error a proposito: no se confirma quien esta registrado. */}
          {error && <Alert>{error}</Alert>}

          <Button type="submit" disabled={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-text">
        No tiene cuenta?{' '}
        <Link to="/auth/registro" className="font-medium text-accent">
          Crear una
        </Link>
      </p>
    </main>
  );
}
