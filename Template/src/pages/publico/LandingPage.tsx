import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
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
        <h1 className="text-4xl">Encuentra tu match</h1>
        <p className="text-text">Conecta con personas afines a ti.</p>
        <Button className="mt-4">Empezar</Button>
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
