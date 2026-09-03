import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { serviciosService } from '../../../services/serviciosService';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Spinner } from '../../../components/ui/Spinner';

// Placeholder shape until the backend contract for /servicios is defined.
type ServicioListItem = { id: string; nombre: string };

export function ServiciosListPage() {
  const [servicios, setServicios] = useState<ServicioListItem[] | null>(null);

  useEffect(() => {
    serviciosService
      .list()
      .then((data) => setServicios(data as ServicioListItem[]))
      .catch(() => setServicios([]));
  }, []);

  return (
    <div>
      <PageHeader title="Servicios" />

      {servicios === null && <Spinner label="Cargando servicios..." />}

      {servicios !== null && servicios.length === 0 && (
        <EmptyState title="Sin servicios" description="Todavia no hay servicios registrados." />
      )}

      {servicios !== null && servicios.length > 0 && (
        <div className="flex flex-col gap-3">
          {servicios.map((servicio) => (
            <Link key={servicio.id} to={`/gestion/servicios/${servicio.id}`} className="no-underline">
              <Card className="transition-colors hover:border-accent-border">
                <p className="m-0 font-medium text-text-h">{servicio.nombre}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
