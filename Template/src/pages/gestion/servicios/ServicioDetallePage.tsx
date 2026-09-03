import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { serviciosService } from '../../../services/serviciosService';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Spinner } from '../../../components/ui/Spinner';

// Placeholder shape until the backend contract for /servicios is defined.
type ServicioDetail = { id: string; nombre: string; descripcion?: string };

export function ServicioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [servicio, setServicio] = useState<ServicioDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    serviciosService.get(id).then((data) => setServicio(data as ServicioDetail));
  }, [id]);

  return (
    <div>
      <PageHeader
        title="Detalle de servicio"
        actions={
          <Link to="/gestion/servicios" className="text-sm text-text hover:text-text-h">
            Volver
          </Link>
        }
      />

      {!servicio && <Spinner label="Cargando servicio..." />}

      {servicio && (
        <Card>
          <p className="m-0 text-lg font-medium text-text-h">{servicio.nombre}</p>
          {servicio.descripcion && <p className="mt-2 text-text">{servicio.descripcion}</p>}
        </Card>
      )}
    </div>
  );
}
