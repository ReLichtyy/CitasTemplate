import { useId, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Dialogo } from './Dialogo';
import { CAMPO_CLASSES, Field } from './Field';
import { DIAS_SEMANA, aMinutos, aHoraPared, type HorarioGestion } from '../../services/horariosService';
import type { CrearHorarioPayload } from '../../services/horariosService';

type Formulario = {
  dia: HorarioGestion['dia'];
  apertura: string;
  cierre: string;
  activo: boolean;
};

const VACIO: Formulario = {
  dia: 'LUNES',
  apertura: '',
  cierre: '',
  activo: true,
};

function desdeHorario(horario: HorarioGestion): Formulario {
  return {
    dia: horario.dia,
    apertura: aHoraPared(horario.minutoApertura),
    cierre: aHoraPared(horario.minutoCierre),
    activo: horario.activo,
  };
}

/**
 * Alta y edicion de una franja de atencion. Mismo patron (y mismas razones) que
 * `ProductoFormModal`: un solo formulario para las dos y validacion de comodidad — la
 * autoridad es la del API, incluido el 409 de dos franjas que abren a la misma hora.
 */
export function HorarioFormModal({
  abierto,
  horario,
  onCerrar,
  onGuardar,
  enviando,
  error,
}: {
  abierto: boolean;
  /** Nulo para un alta; la franja a editar en caso contrario. */
  horario: HorarioGestion | null;
  onCerrar: () => void;
  onGuardar: (datos: CrearHorarioPayload) => void;
  enviando: boolean;
  error: string | null;
}) {
  const tituloId = useId();
  const [form, setForm] = useState<Formulario>(VACIO);
  const [tocado, setTocado] = useState(false);

  const objetivo = abierto ? (horario?.id ?? 'nuevo') : null;
  const [sembradoPara, setSembradoPara] = useState<string | null>(null);
  if (objetivo !== sembradoPara) {
    setSembradoPara(objetivo);
    setForm(horario ? desdeHorario(horario) : VACIO);
    setTocado(false);
  }

  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setForm((actual) => ({ ...actual, [clave]: valor }));

  const problemas = {
    apertura: form.apertura === '' ? 'La hora de apertura es obligatoria.' : null,
    // Semiabierto: cerrar exactamente cuando otra franja abre es valido. Lo que no atiende
    // nada es cerrar antes de abrir.
    cierre: form.cierre === '' ? 'La hora de cierre es obligatoria.' : null,
    rango:
      form.apertura !== '' && form.cierre !== '' && aMinutos(form.cierre) <= aMinutos(form.apertura)
        ? 'La apertura debe ser anterior al cierre.'
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
      dia: form.dia,
      minutoApertura: aMinutos(form.apertura),
      minutoCierre: aMinutos(form.cierre),
      activo: form.activo,
    });
  }

  const verError = (clave: keyof typeof problemas) => (tocado ? problemas[clave] : null);

  return (
    <Dialogo open={abierto} onClose={cerrar} tituloId={tituloId} className="max-w-lg">
      <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:p-6">
        <h2 id={tituloId} className="text-xl">
          {horario ? 'Editar franja' : 'Agregar franja'}
        </h2>

        <label className="flex flex-col gap-1 text-sm text-text">
          Dia
          <select
            value={form.dia}
            disabled={enviando}
            onChange={(evento) => campo('dia', evento.target.value as HorarioGestion['dia'])}
            className={CAMPO_CLASSES}
          >
            {DIAS_SEMANA.map((dia) => (
              <option key={dia.valor} value={dia.valor}>
                {dia.etiqueta}
              </option>
            ))}
          </select>
        </label>

        {/* Horas de pared y no minutos: el usuario escribe "09:00", no "540". El
            `<input type="time">` trae su propio spinner y su propia validacion de forma. */}
        <div className="flex flex-wrap gap-3">
          <Field
            label="Apertura"
            type="time"
            value={form.apertura}
            disabled={enviando}
            wrapperClassName="min-w-32 flex-1"
            hint={
              verError('apertura') && (
                <span className="font-medium text-danger">{problemas.apertura}</span>
              )
            }
            onChange={(evento) => campo('apertura', evento.target.value)}
          />
          <Field
            label="Cierre"
            type="time"
            value={form.cierre}
            disabled={enviando}
            wrapperClassName="min-w-32 flex-1"
            hint={
              (verError('cierre') || verError('rango')) && (
                <span className="font-medium text-danger">
                  {problemas.cierre ?? problemas.rango}
                </span>
              )
            }
            onChange={(evento) => campo('cierre', evento.target.value)}
          />
        </div>

        <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium text-text-muted">Estado</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.activo}
              disabled={enviando}
              onChange={(evento) => campo('activo', evento.target.checked)}
              className="size-4 shrink-0 accent-accent"
            />
            <span>
              <span className="font-medium text-text-h">Atiende</span>
              <span className="block text-xs text-text-muted">
                Apagado pausa el rango sin borrarlo, para temporadas.
              </span>
            </span>
          </label>
        </fieldset>

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? 'Guardando...' : horario ? 'Guardar cambios' : 'Agregar franja'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
