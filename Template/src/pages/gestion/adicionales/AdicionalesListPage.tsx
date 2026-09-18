import { useCallback, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AdicionalFormModal } from '../../../components/ui/AdicionalFormModal';
import { GestionItemRow } from '../../../components/gestion/GestionItemRow';
import { GestionLayout } from '../../../components/gestion/GestionLayout';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useAccionApi } from '../../../hooks/useAccionApi';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { useAuth } from '../../../context/AuthContext';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { formatPrice } from '../../../lib/formatPrice';
import {
  adicionalesService,
  type ActualizarAdicionalPayload,
  type CrearAdicionalPayload,
} from '../../../services/adicionalesService';
import type { AdicionalGestion } from '../../../services/adicionalesService';

/** `null` es "cerrado"; `'nuevo'` es un alta; un adicional es una edicion. */
type Edicion = null | 'nuevo' | AdicionalGestion;

/** Etiqueta de estado. Igual razon de ser que `EstadoProducto` en la lista de productos. */
function EstadoAdicional({ adicional }: { adicional: AdicionalGestion }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        adicional.activo
          ? 'border-success-border text-success'
          : 'border-border text-text-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${adicional.activo ? 'bg-success' : 'bg-text-muted'}`}
      />
      {adicional.activo ? 'Disponible' : 'Sin ofrecer'}
    </span>
  );
}

/**
 * Gestion de los complementos que suman costo y nunca duracion.
 *
 * Lista, alta, edicion y despublicacion, igual que `ProductosListPage`. **No hay borrado**:
 * un adicional queda congelado en las citas pasadas que lo citaron, y despublicarlo es lo
 * unico de esta pantalla que no se deshace. Un EMPLEADO ve la lista (atiende la agenda y
 * tiene que saber que suma cada cosa) pero no escribe: los botones no se pintan.
 */
export function AdicionalesListPage() {
  const { moneda, locale } = configuracionPlaceholder;
  const { rol } = useAuth();
  const esAdmin = rol === 'ADMIN';

  const [edicion, setEdicion] = useState<Edicion>(null);
  /** Sube al cambiar algo, y es la dependencia que hace que la lista se vuelva a pedir. */
  const [version, setVersion] = useState(0);

  const cargarAdicionales = useCallback(() => adicionalesService.list(), []);
  const adicionales = useRecursoApi(cargarAdicionales, [version]);

  const guardar = useAccionApi((datos: CrearAdicionalPayload, id?: string) =>
    id
      ? adicionalesService.actualizar(id, datos as ActualizarAdicionalPayload)
      : adicionalesService.crear(datos),
  );
  const despublicar = useAccionApi((id: string) => adicionalesService.despublicar(id));

  const enEdicion = edicion === 'nuevo' || edicion === null ? null : edicion;

  async function confirmarGuardado(datos: CrearAdicionalPayload) {
    const resultado = await guardar.ejecutar(datos, enEdicion?.id);
    if (resultado) {
      setEdicion(null);
      // Se vuelve a pedir la lista en vez de insertar el resultado en memoria: el orden
      // lo decide el API y reproducirlo aqui seria una segunda implementacion del criterio.
      setVersion((n) => n + 1);
    }
  }

  async function confirmarDespublicar(adicional: AdicionalGestion) {
    if (await despublicar.ejecutar(adicional.id)) {
      setVersion((n) => n + 1);
    }
  }

  const lista = adicionales.datos ?? [];

  return (
    <GestionLayout
      pestana="adicionales"
      titulo="Adicionales"
      acciones={
        esAdmin && (
          <Button
            className="shrink-0 px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm"
            onClick={() => {
              guardar.limpiarError();
              setEdicion('nuevo');
            }}
          >
            Agregar adicional
          </Button>
        )
      }
    >

      {adicionales.error && <Alert>{adicionales.error}</Alert>}
      {despublicar.error && <Alert>{despublicar.error}</Alert>}

      {adicionales.cargando && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${CARD_SHELL_CLASSES} flex items-center gap-4 p-4`}>
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!adicionales.cargando && !adicionales.error && lista.length === 0 && (
        <EmptyState
          title="Sin adicionales"
          description="Agregue el primero con el boton de arriba."
        />
      )}

      {!adicionales.cargando && lista.length > 0 && (
        <div className="flex flex-col gap-3">
          {lista.map((adicional) => (
            <GestionItemRow
              key={adicional.id}
              monograma={adicional.nombre.charAt(0).toUpperCase()}
              titulo={adicional.nombre}
              subtitulo={adicional.descripcion ?? 'Sin descripcion'}
              precio={formatPrice(adicional.precio, moneda, locale)}
              chip={!adicional.activo ? <EstadoAdicional adicional={adicional} /> : undefined}
              atenuada={!adicional.activo}
              acciones={
                esAdmin && (
                  <>
                    <Button
                      variant="secondary"
                      className="min-h-11 px-4 py-2"
                      onClick={() => {
                        guardar.limpiarError();
                        setEdicion(adicional);
                      }}
                    >
                      Editar
                    </Button>
                    {/* Despublicar es reversible —se vuelve a ofrecer desde el
                        formulario—, asi que no lleva dialogo de confirmacion. */}
                    {adicional.activo && (
                      <Button
                        variant="secondary"
                        className="min-h-11 px-4 py-2"
                        disabled={despublicar.enviando}
                        onClick={() => confirmarDespublicar(adicional)}
                      >
                        Despublicar
                      </Button>
                    )}
                  </>
                )
              }
            />
          ))}
        </div>
      )}

      {!adicionales.cargando && !adicionales.error && lista.length === 0 && (
        <EmptyState
          title="Sin adicionales"
          description="Agregue el primero con el boton de arriba."
        />
      )}

      {!adicionales.cargando && lista.length > 0 && (
        <div className="flex flex-col gap-3">
          {lista.map((adicional) => (
            <GestionItemRow
              key={adicional.id}
              monograma={adicional.nombre.charAt(0).toUpperCase()}
              titulo={adicional.nombre}
              subtitulo={adicional.descripcion ?? 'Sin descripcion'}
              precio={formatPrice(adicional.precio, moneda, locale)}
              chip={!adicional.activo ? <EstadoAdicional adicional={adicional} /> : undefined}
              atenuada={!adicional.activo}
              acciones={
                esAdmin && (
                  <>
                    <Button
                      variant="secondary"
                      className="min-h-11 px-4 py-2"
                      onClick={() => {
                        guardar.limpiarError();
                        setEdicion(adicional);
                      }}
                    >
                      Editar
                    </Button>
                    {/* Despublicar es reversible —se vuelve a ofrecer desde el
                        formulario—, asi que no lleva dialogo de confirmacion. */}
                    {adicional.activo && (
                      <Button
                        variant="secondary"
                        className="min-h-11 px-4 py-2"
                        disabled={despublicar.enviando}
                        onClick={() => confirmarDespublicar(adicional)}
                      >
                        Despublicar
                      </Button>
                    )}
                  </>
                )
              }
            />
          ))}
        </div>
      )}

      <AdicionalFormModal
        abierto={edicion !== null}
        adicional={enEdicion}
        onCerrar={() => setEdicion(null)}
        onGuardar={confirmarGuardado}
        enviando={guardar.enviando}
        error={guardar.error}
      />
    </GestionLayout>
  );
}
