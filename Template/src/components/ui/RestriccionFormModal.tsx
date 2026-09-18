import { useId, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Dialogo } from './Dialogo';
import { CAMPO_CLASSES, Field } from './Field';
import { TIPOS_RESTRICCION, type RestriccionGestion } from '../../services/restriccionesService';
import type { CrearRestriccionPayload } from '../../services/restriccionesService';
import type { EmpleadoPublico } from '../../services/empleadosService';
import { nombreCompleto } from '../../lib/especialista';

/** Los mismos topes que el DTO del API. */
const MAX_MOTIVO = 255;

/**
 * Un ISO completo, llevado a la forma "YYYY-MM-DDTHH:mm" que pide un
 * `<input type="datetime-local">` — en la zona del navegador, que es la unica que el
 * input sabe interpretar.
 */
function aValorLocal(iso: string): string {
  const fecha = new Date(iso);
  const dos = (n: number) => `${n}`.padStart(2, '0');
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
  );
}

type Formulario = {
  tipo: RestriccionGestion['tipo'];
  empleadoId: string;
  inicio: string;
  fin: string;
  motivo: string;
};

const VACIO: Formulario = {
  tipo: 'FERIADO',
  empleadoId: '',
  inicio: '',
  fin: '',
  motivo: '',
};

function desdeRestriccion(restriccion: RestriccionGestion): Formulario {
  return {
    tipo: restriccion.tipo,
    empleadoId: restriccion.empleadoId ?? '',
    inicio: aValorLocal(restriccion.inicio),
    fin: aValorLocal(restriccion.fin),
    motivo: restriccion.motivo ?? '',
  };
}

/**
 * Alta y edicion de un bloqueo puntual. Mismo patron (y mismas razones) que
 * `ProductoFormModal`.
 *
 * Sin profesional elegido, el bloqueo cierra el negocio entero — esa es la diferencia
 * entre un feriado y unas vacaciones, y se decide aqui y no leyendo el tipo.
 */
export function RestriccionFormModal({
  abierto,
  restriccion,
  empleados,
  onCerrar,
  onGuardar,
  enviando,
  error,
}: {
  abierto: boolean;
  /** Nulo para un alta; el bloqueo a editar en caso contrario. */
  restriccion: RestriccionGestion | null;
  /** Solo los activos: bloquear la agenda de quien ya no atiende no hace nada. */
  empleados: EmpleadoPublico[];
  onCerrar: () => void;
  onGuardar: (datos: CrearRestriccionPayload) => void;
  enviando: boolean;
  error: string | null;
}) {
  const tituloId = useId();
  const [form, setForm] = useState<Formulario>(VACIO);
  const [tocado, setTocado] = useState(false);

  const objetivo = abierto ? (restriccion?.id ?? 'nuevo') : null;
  const [sembradoPara, setSembradoPara] = useState<string | null>(null);
  if (objetivo !== sembradoPara) {
    setSembradoPara(objetivo);
    setForm(restriccion ? desdeRestriccion(restriccion) : VACIO);
    setTocado(false);
  }

  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setForm((actual) => ({ ...actual, [clave]: valor }));

  const problemas = {
    inicio: form.inicio === '' ? 'El inicio es obligatorio.' : null,
    // Un bloqueo que ya termino no bloquea nada: en un alta el fin no puede quedar en
    // el pasado. Al editar no se aplica a proposito — corregir el fin de un bloqueo
    // vigente que se escribio mal es justo el caso de la edicion.
    fin:
      form.fin === ''
        ? 'El fin es obligatorio.'
        : !restriccion && new Date(form.fin) < new Date()
          ? 'El fin no puede estar en el pasado.'
          : null,
    // Semiabierto, igual que las franjas y las citas: empezar donde termina otro no choca.
    rango:
      form.inicio !== '' && form.fin !== '' && new Date(form.fin) <= new Date(form.inicio)
        ? 'El inicio debe ser anterior al fin.'
        : null,
  };
  const valido = Object.values(problemas).every((problema) => problema === null);

  const cerrar = () => {
    if (!enviando) {
      onCerrar();
    }
  };

  function enviar() {
    setTocado(true);
    if (!valido || enviando) {
      return;
    }
    onGuardar({
      tipo: form.tipo,
      // El `datetime-local` da hora de pared del navegador; al instante ISO lo resuelve
      // `new Date`, y la zona del negocio la interpreta el API.
      inicio: new Date(form.inicio).toISOString(),
      fin: new Date(form.fin).toISOString(),
      // Vacia = negocio entero: se omite y no viaja como null, que el DTO no la admite.
      ...(form.empleadoId ? { empleadoId: form.empleadoId } : {}),
      ...(form.motivo.trim() ? { motivo: form.motivo.trim() } : {}),
    });
  }

  const verError = (clave: keyof typeof problemas) => (tocado ? problemas[clave] : null);

  return (
    <Dialogo open={abierto} onClose={cerrar} tituloId={tituloId} className="max-w-lg">
      <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:p-6">
        <h2 id={tituloId} className="text-xl">
          {restriccion ? 'Editar bloqueo' : 'Agregar bloqueo'}
        </h2>

        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm text-text">
            Tipo
            <select
              value={form.tipo}
              disabled={enviando}
              onChange={(evento) =>
                campo('tipo', evento.target.value as RestriccionGestion['tipo'])
              }
              className={CAMPO_CLASSES}
            >
              {TIPOS_RESTRICCION.map((tipo) => (
                <option key={tipo.valor} value={tipo.valor}>
                  {tipo.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm text-text">
            Profesional
            <select
              value={form.empleadoId}
              disabled={enviando}
              onChange={(evento) => campo('empleadoId', evento.target.value)}
              className={CAMPO_CLASSES}
            >
              <option value="">Todo el negocio</option>
              {empleados.map((empleado) => (
                <option key={empleado.id} value={empleado.id}>
                  {nombreCompleto(empleado.usuario.nombre, empleado.usuario.apellido)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Field
            label="Inicio"
            type="datetime-local"
            value={form.inicio}
            disabled={enviando}
            wrapperClassName="min-w-40 flex-1"
            hint={
              (verError('inicio') || verError('rango')) && (
                <span className="font-medium text-danger">
                  {problemas.inicio ?? problemas.rango}
                </span>
              )
            }
            onChange={(evento) => campo('inicio', evento.target.value)}
          />
          <Field
            label="Fin"
            type="datetime-local"
            value={form.fin}
            disabled={enviando}
            wrapperClassName="min-w-40 flex-1"
            hint={
              (verError('fin') || verError('rango')) && (
                <span className="font-medium text-danger">
                  {problemas.fin ?? problemas.rango}
                </span>
              )
            }
            onChange={(evento) => campo('fin', evento.target.value)}
          />
        </div>

        <Field
          label="Motivo"
          placeholder="Opcional: que se bloquea y por que."
          maxLength={MAX_MOTIVO}
          value={form.motivo}
          disabled={enviando}
          onChange={(evento) => campo('motivo', evento.target.value)}
        />

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? 'Guardando...' : restriccion ? 'Guardar cambios' : 'Agregar bloqueo'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
