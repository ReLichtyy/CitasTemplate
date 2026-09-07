import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Spinner } from '../../components/ui/Spinner';
import { citasService, type CitaPorConfirmar } from '../../services/citasService';

/**
 * La pagina a la que apunta el enlace del WhatsApp.
 *
 * Existe justamente porque **un GET no puede confirmar nada**: WhatsApp genera vista
 * previa de los enlaces de un mensaje, y los navegadores y antivirus hacen prefetch.
 * Si abrir la URL confirmara, la cita se confirmaria sola antes de que el cliente la
 * vea. Aqui el token solo se canjea para *mostrar* la cita, y confirmar es un POST
 * que sale de pulsar el boton. Ver apiBase/src/notificaciones/09-conexion-whatsapp.md.
 *
 * La pagina es publica: quien confirma no tiene sesion, y exigirsela mata el flujo.
 */
export function ConfirmarCitaPage() {
  const { token = '' } = useParams<{ token: string }>();

  const [cita, setCita] = useState<CitaPorConfirmar | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mensajeDe = (fallo: unknown) =>
    fallo instanceof ApiError ? fallo.message : 'No se pudo completar la operacion.';

  useEffect(() => {
    let vigente = true;

    citasService
      .consultarConfirmacion(token)
      .then((datos) => {
        if (vigente) {
          setCita(datos);
        }
      })
      .catch((fallo) => {
        if (vigente) {
          setError(mensajeDe(fallo));
        }
      })
      .finally(() => {
        if (vigente) {
          setCargando(false);
        }
      });

    return () => {
      vigente = false;
    };
  }, [token]);

  const confirmar = useCallback(async () => {
    setEnviando(true);
    setError(null);
    try {
      setCita(await citasService.confirmar(token));
    } catch (fallo) {
      setError(mensajeDe(fallo));
    } finally {
      setEnviando(false);
    }
  }, [token]);

  if (cargando) {
    return (
      <main>
        <PageHeader title="Confirmar cita" />
        <Spinner label="Buscando su cita..." />
      </main>
    );
  }

  // Inexistente, vencido y ya usado responden igual desde el API a proposito:
  // distinguirlos convertiria la ruta en un oraculo de que citas existen.
  if (!cita) {
    return (
      <main>
        <PageHeader title="Confirmar cita" />
        <Alert>{error ?? 'El enlace no es valido o ya vencio.'}</Alert>
        <p className="mt-4 text-sm text-text">
          Si el enlace ya no sirve, el negocio puede confirmar su cita por telefono.
        </p>
        <div className="mt-4">
          <ButtonLink to="/">Volver al inicio</ButtonLink>
        </div>
      </main>
    );
  }

  const fecha = new Date(cita.inicio);

  return (
    <main>
      <PageHeader title={cita.confirmada ? 'Cita confirmada' : 'Confirmar cita'} />

      <Card className="flex flex-col gap-3">
        {/* Lo minimo: servicio, profesional y fecha. El enlace pudo haberse reenviado,
            asi que aqui nunca sale el telefono ni el resto de la ficha del cliente. */}
        <p className="text-text-h">
          {cita.servicio} con {cita.profesional}
        </p>
        <p className="text-sm text-text">
          {new Intl.DateTimeFormat('es', {
            dateStyle: 'full',
            timeStyle: 'short',
          }).format(fecha)}
        </p>

        {cita.confirmada ? (
          <Alert>
            Su cita quedo confirmada. Le esperamos.
          </Alert>
        ) : (
          <>
            {error && <Alert>{error}</Alert>}
            <Button onClick={confirmar} disabled={enviando}>
              {enviando ? 'Confirmando...' : 'Confirmar mi cita'}
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
