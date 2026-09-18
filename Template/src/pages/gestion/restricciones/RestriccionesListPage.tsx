import { GestionLayout } from '../../../components/gestion/GestionLayout';
import { DiasLibresSeccion } from '../../../components/gestion/DiasLibresSeccion';

/**
 * `/gestion/restricciones`: los dias libres. Toda la logica vive en `DiasLibresSeccion`,
 * que es la misma seccion que aparece dentro de la pagina de Horarios — una sola
 * implementacion, dos lugares donde se administra lo mismo. La pestana encendida es
 * Horarios: es esa familia.
 */
export function RestriccionesListPage() {
  return (
    <GestionLayout pestana="horarios" titulo="Dias libres">
      <DiasLibresSeccion />
    </GestionLayout>
  );
}
