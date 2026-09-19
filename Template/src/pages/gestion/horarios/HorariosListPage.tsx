import { useCallback, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { HorarioFormModal } from '../../../components/ui/HorarioFormModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { DiasLibresSeccion } from '../../../components/gestion/DiasLibresSeccion';
import { GestionLayout } from '../../../components/gestion/GestionLayout';
import { useAccionApi } from '../../../hooks/useAccionApi';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { useAuth } from '../../../context/AuthContext';
import {
  DIAS_SEMANA,
  aHoraPared,
  horariosService,
  type ActualizarHorarioPayload,
  type CrearHorarioPayload,
} from '../../../services/horariosService';
import type { HorarioGestion } from '../../../services/horariosService';

/** `null` es "cerrado"; `'nuevo'` es un alta; una franja es una edicion. */
type Edicion = null | 'nuevo' | HorarioGestion;

/**
 * La semana de atencion, dia por dia. Se agrupa por dia y no como una tabla plana: lo que
 * se administra es "el martes" entero, y las franjas de un dia se comparan entre ellas —
 * ahi es donde se ve un turno partido que quedo pegado al otro.
 */
function FranjaDelDia({
  dia,
  franjas,
  esAdmin,
  enviando,
  onEditar,
  onEliminar,
}: {
  dia: (typeof DIAS_SEMANA)[number];
  franjas: HorarioGestion[];
  esAdmin: boolean;
  enviando: boolean;
  onEditar: (franja: HorarioGestion) => void;
  onEliminar: (franja: HorarioGestion) => void;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-text-h">{dia.etiqueta}</p>
        <p className="m-0 text-xs text-text-muted">
          {franjas.length === 0
            ? 'No atiende'
            : franjas.every((franja) => !franja.activo)
              ? 'En pausa'
              : 'Atiende'}
        </p>
      </div>

      {franjas.length === 0 ? (
        <p className="m-0 text-sm text-text-muted">Sin franjas para este dia.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {franjas.map((franja) => (
            <div
              key={franja.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 ${
                franja.activo ? '' : 'opacity-70'
              }`}
            >
              <p className="m-0 flex-1 tabular-nums text-sm text-text">
                {aHoraPared(franja.minutoApertura)} – {aHoraPared(franja.minutoCierre)}
                {!franja.activo && (
                  <span className="ml-2 font-medium text-text-muted">En pausa</span>
                )}
              </p>
              {esAdmin && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    className="min-h-11 px-4 py-2"
                    disabled={enviando}
                    onClick={() => onEditar(franja)}
                  >
                    Editar
                  </Button>
                  {/* Borra de verdad: crear la franja otra vez es la vuelta atras, y no hay
                      historico que la cite. */}
                  <Button
                    variant="secondary"
                    className="min-h-11 px-4 py-2"
                    disabled={enviando}
                    onClick={() => onEliminar(franja)}
                  >
                    Eliminar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Gestion de la semana de atencion **y** de sus excepciones. Lista, alta, edicion, pausa y
 * borrado de franjas — una franja no cuelga de ningun historico, asi que aqui **si** se
 * borra de verdad, a diferencia de productos y adicionales — y abajo la seccion de dias
 * libres, que es la otra mitad de la misma pregunta: cuando no se atiende. Un EMPLEADO
 * ve la semana (su agenda depende de ella) pero no escribe: los botones no se pintan.
 */
export function HorariosListPage() {
  const { rol } = useAuth();
  const esAdmin = rol === 'ADMIN';

  const [edicion, setEdicion] = useState<Edicion>(null);
  const [version, setVersion] = useState(0);

  const cargarHorarios = useCallback(() => horariosService.list(), []);
  const horarios = useRecursoApi(cargarHorarios, [version]);

  const guardar = useAccionApi((datos: CrearHorarioPayload, id?: string) =>
    id
      ? horariosService.actualizar(id, datos as ActualizarHorarioPayload)
      : horariosService.crear(datos),
  );
  const eliminar = useAccionApi((id: string) => horariosService.eliminar(id));

  const enEdicion = edicion === 'nuevo' || edicion === null ? null : edicion;

  async function confirmarGuardado(datos: CrearHorarioPayload) {
    const resultado = await guardar.ejecutar(datos, enEdicion?.id);
    if (resultado) {
      setEdicion(null);
      setVersion((n) => n + 1);
    }
  }

  async function confirmarEliminar(horario: HorarioGestion) {
    if (await eliminar.ejecutar(horario.id)) {
      setVersion((n) => n + 1);
    }
  }

  const lista = horarios.datos ?? [];

  return (
    <GestionLayout
      pestana="horarios"
      titulo="Horarios"
      acciones={
        esAdmin && (
          <Button
            className="min-h-11 shrink-0 px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm"
            onClick={() => {
              guardar.limpiarError();
              setEdicion('nuevo');
            }}
          >
            Agregar franja
          </Button>
        )
      }
    >

      {horarios.error && <Alert>{horarios.error}</Alert>}
      {eliminar.error && <Alert>{eliminar.error}</Alert>}

      {horarios.cargando && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${CARD_SHELL_CLASSES} flex items-center gap-4 p-4`}>
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-1/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!horarios.cargando && !horarios.error && (
        <div className="flex flex-col gap-3">
          {DIAS_SEMANA.map((dia) => (
            <FranjaDelDia
              key={dia.valor}
              dia={dia}
              franjas={lista.filter((horario) => horario.dia === dia.valor)}
              esAdmin={esAdmin}
              enviando={guardar.enviando || eliminar.enviando}
              onEditar={(franja) => {
                guardar.limpiarError();
                setEdicion(franja);
              }}
              onEliminar={confirmarEliminar}
            />
          ))}
        </div>
      )}

      {/* La excepcion de la semana: feriados, vacaciones, cierres. La misma seccion que
          vive sola en /gestion/restricciones. */}
      <DiasLibresSeccion />

      <HorarioFormModal
        abierto={edicion !== null}
        horario={enEdicion}
        onCerrar={() => setEdicion(null)}
        onGuardar={confirmarGuardado}
        enviando={guardar.enviando}
        error={guardar.error}
      />
    </GestionLayout>
  );
}
