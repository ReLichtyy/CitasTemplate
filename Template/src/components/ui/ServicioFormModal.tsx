import { useId, useRef, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { CajaImagen, type CajaImagenHandle } from './CajaImagen';
import { Dialogo } from './Dialogo';
import { CAMPO_CLASSES, Field } from './Field';
import { formatDuration } from '../../lib/formatDuration';
import { nombreCompleto } from '../../lib/especialista';
import { archivosService } from '../../services/archivosService';
import type { ServicioGestion, CrearServicioPayload } from '../../services/serviciosService';
import type { EmpleadoGestion } from '../../services/empleadosService';

/** Los mismos topes que el DTO del API. */
const MAX = { nombre: 120, descripcion: 2000 };

const IMPORTE = /^\d{1,8}(\.\d{1,2})?$/;

type Formulario = {
  nombre: string;
  descripcion: string;
  duracionMinutos: string;
  precio: string;
  imagenUrl: string;
  activo: boolean;
  empleadoIds: string[];
};

const VACIO: Formulario = {
  nombre: '',
  descripcion: '',
  duracionMinutos: '',
  precio: '',
  imagenUrl: '',
  activo: true,
  empleadoIds: [],
};

function desdeServicio(servicio: ServicioGestion): Formulario {
  return {
    nombre: servicio.nombre,
    descripcion: servicio.descripcion ?? '',
    duracionMinutos: `${servicio.duracionMinutos}`,
    precio: servicio.precio,
    imagenUrl: servicio.imagenUrl ?? '',
    activo: servicio.activo,
    empleadoIds: servicio.empleados.map((empleado) => empleado.id),
  };
}

/**
 * Alta y edicion de un servicio. Mismo patron (y mismas razones) que `ProductoFormModal`.
 *
 * La asignacion de profesionales son casillas: la lista que se manda es la asignacion
 * **completa** — desmarcar quita, marcar agrega, y el API reemplaza con `set`.
 */
export function ServicioFormModal({
  abierto,
  servicio,
  empleados,
  onCerrar,
  onGuardar,
  enviando,
  error,
}: {
  abierto: boolean;
  /** Nulo para un alta; el servicio a editar en caso contrario. */
  servicio: ServicioGestion | null;
  /** Todo el equipo, dado de baja incluido: la gestion decide sobre la asignacion completa. */
  empleados: EmpleadoGestion[];
  onCerrar: () => void;
  /**
   * Devuelve si el guardado prospero. La imagen se sube recien aqui dentro —validado
   * ya todo el formulario— y si el guardado falla, el modal deshace esa subida.
   */
  onGuardar: (datos: CrearServicioPayload) => Promise<boolean>;
  enviando: boolean;
  error: string | null;
}) {
  const tituloId = useId();
  const [form, setForm] = useState<Formulario>(VACIO);
  const [tocado, setTocado] = useState(false);
  const caja = useRef<CajaImagenHandle>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [subidaError, setSubidaError] = useState<string | null>(null);
  // En una ref y no en estado: tiene que verse en el mismo tick del doble clic, antes
  // de que el proximo render exista. Mismo motivo que en `useAccionApi`.
  const enVuelo = useRef(false);

  const objetivo = abierto ? (servicio?.id ?? 'nuevo') : null;
  const [sembradoPara, setSembradoPara] = useState<string | null>(null);
  if (objetivo !== sembradoPara) {
    setSembradoPara(objetivo);
    setForm(servicio ? desdeServicio(servicio) : VACIO);
    setTocado(false);
    setSubidaError(null);
  }

  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setForm((actual) => ({ ...actual, [clave]: valor }));

  const alternarEmpleado = (id: string) =>
    setForm((actual) => ({
      ...actual,
      empleadoIds: actual.empleadoIds.includes(id)
        ? actual.empleadoIds.filter((empleadoId) => empleadoId !== id)
        : [...actual.empleadoIds, id],
    }));

  const duracion = Number(form.duracionMinutos);
  const problemas = {
    nombre: form.nombre.trim().length < 2 ? 'El nombre es obligatorio.' : null,
    duracionMinutos:
      Number.isInteger(duracion) && duracion >= 5 && duracion <= 720
        ? null
        : 'Minutos entre 5 y 720.',
    precio: IMPORTE.test(form.precio) ? null : 'Importe con hasta dos decimales.',
  };
  const valido = Object.values(problemas).every((problema) => problema === null);

  // La subida de la imagen es parte del guardado: mientras viaja, el formulario esta
  // ocupado igual que cuando el API esta creando el registro.
  const ocupado = enviando || subiendo;

  const cerrar = () => {
    if (!ocupado) {
      onCerrar();
    }
  };

  async function enviar() {
    setTocado(true);
    if (!valido || ocupado || enVuelo.current) {
      return;
    }
    enVuelo.current = true;
    setSubiendo(true);
    setSubidaError(null);
    try {
      // La imagen recien se sube aqui: nada toco el servidor mientras se llenaba el
      // formulario, y si la validacion corta el intento, tampoco la subida.
      const subida = (await caja.current?.subirSiExiste()) ?? null;
      // La URL nueva si se subio archivo; si no, la que el registro ya tenia.
      const imagenUrl = subida ?? form.imagenUrl.trim();
      const guardado = await onGuardar({
        nombre: form.nombre.trim(),
        duracionMinutos: duracion,
        precio: form.precio,
        activo: form.activo,
        empleadoIds: form.empleadoIds,
        ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
        ...(imagenUrl ? { imagenUrl } : {}),
      });
      if (!guardado && subida) {
        // El servicio no se guardo y la URL no la referencia nadie: deshacer la subida
        // para no dejar una imagen huerfana en el disco del servidor. Mejor esfuerzo:
        // si el borrado tampoco llega, queda huerfana, que ya era el estado sin esto.
        archivosService.eliminar(subida).catch(() => undefined);
      }
    } catch (fallo) {
      // Solo `subirSiExiste` lanza: el guardado de la pagina devuelve null al fallar.
      // El texto sale del API cuando lo trae: es el que sabe que fallo de verdad.
      setSubidaError(fallo instanceof Error ? fallo.message : 'No se pudo subir la imagen.');
    } finally {
      enVuelo.current = false;
      setSubiendo(false);
    }
  }

  const verError = (clave: keyof typeof problemas) => (tocado ? problemas[clave] : null);

  return (
    <Dialogo open={abierto} onClose={cerrar} tituloId={tituloId} className="max-w-lg">
      <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:p-6">
        <h2 id={tituloId} className="text-xl">
          {servicio ? 'Editar servicio' : 'Agregar servicio'}
        </h2>

        <Field
          label="Nombre"
          value={form.nombre}
          maxLength={MAX.nombre}
          disabled={ocupado}
          hint={
            verError('nombre') && (
              <span className="font-medium text-danger">{problemas.nombre}</span>
            )
          }
          onChange={(evento) => campo('nombre', evento.target.value)}
        />

        <div className="flex flex-wrap gap-3">
          <Field
            label="Duracion"
            inputMode="numeric"
            placeholder="45"
            value={form.duracionMinutos}
            disabled={ocupado}
            wrapperClassName="min-w-32 flex-1"
            hint={
              (verError('duracionMinutos') && (
                <span className="font-medium text-danger">{problemas.duracionMinutos}</span>
              )) ||
              (form.duracionMinutos !== '' && Number.isInteger(duracion) && duracion > 0 ? (
                <span>{formatDuration(duracion)}</span>
              ) : null)
            }
            onChange={(evento) => campo('duracionMinutos', evento.target.value)}
          />
          <Field
            label="Precio"
            inputMode="decimal"
            placeholder="25.00"
            value={form.precio}
            disabled={ocupado}
            wrapperClassName="min-w-32 flex-1"
            hint={
              verError('precio') && (
                <span className="font-medium text-danger">{problemas.precio}</span>
              )
            }
            onChange={(evento) => campo('precio', evento.target.value)}
          />
        </div>

        <CajaImagen
          // `key` por objetivo: al cerrar o reabrir sobre otro servicio, la caja se
          // remonta y el archivo pendiente de la sesion anterior no se arrastra.
          key={objetivo ?? 'cerrado'}
          label="Imagen"
          url={form.imagenUrl || null}
          disabled={ocupado}
          ref={caja}
        />

        <label className="flex flex-col gap-1 text-sm text-text">
          Descripcion
          <textarea
            rows={3}
            maxLength={MAX.descripcion}
            value={form.descripcion}
            disabled={ocupado}
            placeholder="En que consiste y que incluye."
            onChange={(evento) => campo('descripcion', evento.target.value)}
            className={`${CAMPO_CLASSES} min-h-20 resize-y py-2`}
          />
        </label>

        {empleados.length > 0 && (
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-medium text-text-muted">
              Quien lo atiende
            </legend>
            {empleados.map((empleado) => (
              <label key={empleado.id} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.empleadoIds.includes(empleado.id)}
                  disabled={ocupado}
                  onChange={() => alternarEmpleado(empleado.id)}
                  className="size-4 shrink-0 accent-accent"
                />
                <span className="min-w-0 flex-1 truncate">
                  {nombreCompleto(empleado.usuario.nombre, empleado.usuario.apellido)}
                </span>
                {!empleado.activo && (
                  <span className="shrink-0 text-xs text-text-muted">Dado de baja</span>
                )}
              </label>
            ))}
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium text-text-muted">Estado</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.activo}
              disabled={ocupado}
              onChange={(evento) => campo('activo', evento.target.checked)}
              className="size-4 shrink-0 accent-accent"
            />
            <span>
              <span className="font-medium text-text-h">Publicado</span>
              <span className="block text-xs text-text-muted">
                Aparece en el catalogo publico y se puede reservar.
              </span>
            </span>
          </label>
        </fieldset>

        {error && <Alert>{error}</Alert>}
        {subidaError && <Alert>{subidaError}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado}>
            {enviando
              ? 'Guardando...'
              : subiendo
                ? 'Subiendo imagen...'
                : servicio
                  ? 'Guardar cambios'
                  : 'Agregar servicio'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
