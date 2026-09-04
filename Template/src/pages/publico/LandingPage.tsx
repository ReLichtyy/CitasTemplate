import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Spinner } from '../../components/ui/Spinner';

type HealthResponse = { status: string; timestamp: string };

export function LandingPage() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    apiClient
      .get<HealthResponse>('/health')
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <section className="flex flex-col items-center gap-2">
        <h1 className="text-4xl">Reserva tu cita en minutos</h1>
        <p className="text-text">Elegi un servicio, un horario, y listo.</p>
        <Link
          to="/citas/reservar"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-medium text-white no-underline transition-colors hover:opacity-90"
        >
          Reservar ahora
        </Link>
      </section>

      <p className="text-sm text-text">
        {apiStatus === 'checking' ? (
          <Spinner label="Verificando API..." />
        ) : (
          <>
            API: <strong className={apiStatus === 'online' ? 'text-accent' : 'text-red-500'}>{apiStatus}</strong>
          </>
        )}
      </p>
    </div>
  );
}
