import { useId, useRef, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { CajaImagen, type CajaImagenHandle } from './CajaImagen';
import { Dialogo } from './Dialogo';
import { CAMPO_CLASSES, Field } from './Field';
import { archivosService } from '../../services/archivosService';
import type {
  EmpleadoGestion,
  CrearEmpleadoPayload,
  ActualizarEmpleadoPayload,
} from '../../services/empleadosService';
import type { Especialidad } from '../../services/especialidadesService';
import type { ServicioGestion } from '../../services/serviciosService';

/** Los mismos topes que el DTO del API. */
const MAX = { nombre: 100, apellido: 100, email: 160, bio: 2000, password: 72 };

const PASSWORD_MIN = 8;

/** Forma local: 8 digitos, sin prefijo de pais. Igual que el DTO del API. */
const TELEFONO = /^\d{8}$/;

type Formulario = {
  telefono: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  bio: string;
  fotoUrl: string;
  especialidadId: string;
  servicioIds: string[];
  activo: boolean;
};

const VACIO: Formulario = {
  telefono: '',
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  bio: '',
  fotoUrl: '',
  especialidadId: '',
  servicioIds: [],
  activo: true,
};

function desdeEmpleado(empleado: EmpleadoGestion): Formulario {
  return {
    telefono: empleado.usuario.telefono,
    nombre: empleado.usuario.nombre,
    apellido: empleado.usuario.apellido ?? '',
    email: empleado.usuario.email ?? '',
    password: '',
    bio: empleado.bio ?? '',
    fotoUrl: empleado.fotoUrl ?? '',
    especialidadId: empleado.especialidad?.id ?? '',
    servicioIds: empleado.servicios.map((servicio) => servicio.id),
    activo: empleado.activo,
  };
}

/**
 * Alta y edicion de un profesional. Mismo patron (y mismas razones) que
 * `ProductoFormModal`.
 *
 * Al alta se crea la cuenta y la ficha juntas; la contrasena es opcional porque sin ella el
 * propio empleado la reclama registrandose con su telefono. Al editar, la contrasena que se
 * escriba es un **reinicio** del ADMIN, no la rotacion del propio usuario.
 */
export function EmpleadoFormModal({
  abierto,
  empleado,
  especialidades,
  servicios,
  onCerrar,
  onGuardar,
  enviando,
  error,
}: {
  abierto: boolean;
  /** Nulo para un alta; la ficha a editar en caso contrario. */
  empleado: EmpleadoGestion | null;
  especialidades: Especialidad[];
  /** Todo el catalogo, desactivado incluido: la gestion decide sobre la asignacion completa. */
  servicios: ServicioGestion[];
  onCerrar: () => void;
  /**
   * Devuelve si el guardado prospero. La foto se sube recien aqui dentro —validado ya
   * todo el formulario— y si el guardado falla, el modal deshace esa subida.
   */
  onGuardar: (datos: CrearEmpleadoPayload | ActualizarEmpleadoPayload) => Promise<boolean>;
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

  const objetivo = abierto ? (empleado?.id ?? 'nuevo') : null;
  const [sembradoPara, setSembradoPara] = useState<string | null>(null);
  if (objetivo !== sembradoPara) {
    setSembradoPara(objetivo);
    setForm(empleado ? desdeEmpleado(empleado) : VACIO);
    setTocado(false);
    setSubidaError(null);
  }

  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setForm((actual) => ({ ...actual, [clave]: valor }));

  const alternarServicio = (id: string) =>
    setForm((actual) => ({
      ...actual,
      servicioIds: actual.servicioIds.includes(id)
        ? actual.servicioIds.filter((servicioId) => servicioId !== id)
        : [...actual.servicioIds, id],
    }));

  const problemas = {
    telefono: TELEFONO.test(form.telefono) ? null : 'El telefono debe tener 8 digitos.',
    nombre: form.nombre.trim().length < 2 ? 'El nombre es obligatorio.' : null,
    password:
      form.password === '' || form.password.length >= PASSWORD_MIN
        ? null
        : `La contrasena debe tener al menos ${PASSWORD_MIN} caracteres.`,
  };
  const valido = Object.values(problemas).every((problema) => problema === null);

  // La subida de la foto es parte del guardado: mientras viaja, el formulario esta
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
      // La foto recien se sube aqui: nada toco el servidor mientras se llenaba el
      // formulario, y si la validacion corta el intento, tampoco la subida.
      const subida = (await caja.current?.subirSiExiste()) ?? null;
      // La URL nueva si se subio archivo; si no, la que la ficha ya tenia.
      const fotoUrl = subida ?? form.fotoUrl.trim();
      const base = {
        telefono: form.telefono.trim(),
        nombre: form.nombre.trim(),
        ...(form.apellido.trim() ? { apellido: form.apellido.trim() } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.bio.trim() ? { bio: form.bio.trim() } : {}),
        ...(fotoUrl ? { fotoUrl } : {}),
        ...(form.especialidadId ? { especialidadId: form.especialidadId } : {}),
        servicioIds: form.servicioIds,
      };
      const guardado = await onGuardar({
        ...base,
        // Solo al editar: el alta nace activo y el interruptor es cosa de la ficha.
        ...(empleado ? { activo: form.activo } : {}),
        // La contrasena se omite si no se escribio: al editar, vacia es "no tocar".
        ...(form.password ? { password: form.password } : {}),
      });
      if (!guardado && subida) {
        // El profesional no se guardo y la URL no la referencia nadie: deshacer la
        // subida para no dejar una imagen huerfana en el disco del servidor. Mejor
        // esfuerzo: si el borrado tampoco llega, queda huerfana, que ya era el estado.
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
          {empleado ? 'Editar profesional' : 'Agregar profesional'}
        </h2>

        <div className="flex flex-wrap gap-3">
          <Field
            label="Telefono"
            inputMode="numeric"
            placeholder="8888 7777"
            value={form.telefono}
            maxLength={8}
            disabled={ocupado}
            wrapperClassName="min-w-40 flex-1"
            hint={
              (verError('telefono') && (
                <span className="font-medium text-danger">{problemas.telefono}</span>
              )) || (
                <span>
                  {empleado
                    ? 'Es su credencial de acceso: cambiarlo obliga a avisarle.'
                    : 'Sera su credencial de acceso.'}
                </span>
              )
            }
            onChange={(evento) =>
              campo('telefono', evento.target.value.replace(/\D/g, ''))
            }
          />
          <Field
            label="Correo"
            type="email"
            placeholder="opcional@..."
            value={form.email}
            maxLength={MAX.email}
            disabled={ocupado}
            wrapperClassName="min-w-40 flex-1"
            onChange={(evento) => campo('email', evento.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Field
            label="Nombre"
            value={form.nombre}
            maxLength={MAX.nombre}
            disabled={ocupado}
            wrapperClassName="min-w-32 flex-1"
            hint={
              verError('nombre') && (
                <span className="font-medium text-danger">{problemas.nombre}</span>
              )
            }
            onChange={(evento) => campo('nombre', evento.target.value)}
          />
          <Field
            label="Apellido"
            value={form.apellido}
            maxLength={MAX.apellido}
            disabled={ocupado}
            wrapperClassName="min-w-32 flex-1"
            onChange={(evento) => campo('apellido', evento.target.value)}
          />
        </div>

        <Field
          label={empleado ? 'Reiniciar contrasena' : 'Contrasena inicial'}
          type="password"
          value={form.password}
          maxLength={MAX.password}
          autoComplete="new-password"
          disabled={ocupado}
          hint={
            (verError('password') && (
              <span className="font-medium text-danger">{problemas.password}</span>
            )) || (
              <span>
                {empleado
                  ? 'Dejela vacia para no tocar la actual.'
                  : `Opcional: sin ella, ${form.nombre.trim() || 'la persona'} se registra con su telefono y toma su cuenta.`}
              </span>
            )
          }
          onChange={(evento) => campo('password', evento.target.value)}
        />

        {especialidades.length > 0 && (
          <label className="flex flex-col gap-1 text-sm text-text">
            Especialidad
            <select
              value={form.especialidadId}
              disabled={ocupado}
              onChange={(evento) => campo('especialidadId', evento.target.value)}
              className={CAMPO_CLASSES}
            >
              <option value="">Sin especialidad</option>
              {especialidades.map((especialidad) => (
                <option key={especialidad.id} value={especialidad.id}>
                  {especialidad.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        {servicios.length > 0 && (
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-medium text-text-muted">
              Que atiende
            </legend>
            {servicios.map((servicio) => (
              <label key={servicio.id} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.servicioIds.includes(servicio.id)}
                  disabled={ocupado}
                  onChange={() => alternarServicio(servicio.id)}
                  className="size-4 shrink-0 accent-accent"
                />
                <span className="min-w-0 flex-1 truncate">
                  {servicio.nombre}
                </span>
                {!servicio.activo && (
                  <span className="shrink-0 text-xs text-text-muted">Sin publicar</span>
                )}
              </label>
            ))}
          </fieldset>
        )}

        <CajaImagen
          // `key` por objetivo: al cerrar o reabrir sobre otro profesional, la caja se
          // remonta y el archivo pendiente de la sesion anterior no se arrastra.
          key={objetivo ?? 'cerrado'}
          label="Foto"
          url={form.fotoUrl || null}
          disabled={ocupado}
          ref={caja}
        />

        <label className="flex flex-col gap-1 text-sm text-text">
          Bio
          <textarea
            rows={3}
            maxLength={MAX.bio}
            value={form.bio}
            disabled={ocupado}
            placeholder="Como trabaja y con quien."
            onChange={(evento) => campo('bio', evento.target.value)}
            className={`${CAMPO_CLASSES} min-h-20 resize-y py-2`}
          />
        </label>

        {empleado && (
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-medium text-text-muted">Ficha</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.activo}
                disabled={ocupado}
                onChange={(evento) => campo('activo', evento.target.checked)}
                className="size-4 shrink-0 accent-accent"
              />
              <span>
                <span className="font-medium text-text-h">Activo</span>
                <span className="block text-xs text-text-muted">
                  Apagado lo saca del catalogo publico y corta su acceso.
                </span>
              </span>
            </label>
          </fieldset>
        )}

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
                : empleado
                  ? 'Guardar cambios'
                  : 'Agregar profesional'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
