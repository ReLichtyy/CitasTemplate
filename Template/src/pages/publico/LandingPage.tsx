import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

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
    <main className="home">
      <section className="hero">
        <h1>Encuentra tu match</h1>
        <p>Conecta con personas afines a ti.</p>
        <button type="button">Empezar</button>
      </section>
      <p className="api-status">
        API: <strong>{apiStatus}</strong>
      </p>
    </main>
  );
}
