import { useId, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Dialogo } from './Dialogo';
import { CAMPO_CLASSES, Field } from './Field';
import type { AdicionalGestion } from '../../services/adicionalesService';
import type { CrearAdicionalPayload } from '../../services/adicionalesService';

/** Los mismos topes que el DTO del API. Repetirlos aqui evita un viaje para saber que sobra. */
const MAX = { nombre: 120, descripcion: 2000 };

/** Hasta dos decimales, que es lo que cabe en `Decimal(10, 2)`. Igual que el DTO. */
const IMPORTE = /^\d{1,8}(\.\d{1,2})?$/;

type Formulario = {
  nombre: string;
  descripcion: string;
  precio: string;
  activo: boolean;
};

const VACIO: Formulario = {
  nombre: '',
  descripcion: '',
  precio: '',
  activo: true,
};

function desdeAdicional(adicional: AdicionalGestion): Formulario {
  return {
    nombre: adicional.nombre,
    descripcion: adicional.descripcion ?? '',
    precio: adicional.precio,
    activo: adicional.activo,
  };
}

/**
 * Alta y edicion de un adicional. El mismo formulario para las dos, igual que
 * `ProductoFormModal`: los campos son los mismos y dos copias terminan validando distinto.
 *
 * La validacion de aqui es **comodidad, no autoridad**: el API vuelve a aplicar todo y su
 * mensaje es el que se muestra si algo se escapa.
 */
export function AdicionalFormModal({
  abierto,
  adicional,
  onCerrar,
  onGuardar,
  enviando,
  error,
}: {
  abierto: boolean;
  /** Nulo para un alta; el adicional a editar en caso contrario. */
  adicional: AdicionalGestion | null;
  onCerrar: () => void;
  onGuardar: (datos: CrearAdicionalPayload) => void;
  enviando: boolean;
  error: string | null;
}) {
  const tituloId = useId();
  const [form, setForm] = useState<Formulario>(VACIO);
  const [tocado, setTocado] = useState(false);

  // Siembra el formulario al abrir, ajustando el estado durante el render y no desde un
  // efecto — mismo patron y misma razon que `ProductoFormModal`.
  const objetivo = abierto ? (adicional?.id ?? 'nuevo') : null;
  const [sembradoPara, setSembradoPara] = useState<string | null>(null);
  if (objetivo !== sembradoPara) {
    setSembradoPara(objetivo);
    setForm(adicional ? desdeAdicional(adicional) : VACIO);
    setTocado(false);
  }

  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setForm((actual) => ({ ...actual, [clave]: valor }));

  const problemas = {
    nombre: form.nombre.trim().length < 2 ? 'El nombre es obligatorio.' : null,
    precio: IMPORTE.test(form.precio) ? null : 'Importe con hasta dos decimales.',
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
      nombre: form.nombre.trim(),
      precio: form.precio,
      activo: form.activo,
      // Los opcionales se **omiten** en vez de mandarse vacios, igual que en productos.
      ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
    });
  }

  const verError = (clave: keyof typeof problemas) => (tocado ? problemas[clave] : null);

  return (
    <Dialogo open={abierto} onClose={cerrar} tituloId={tituloId} className="max-w-lg">
      <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:p-6">
        <h2 id={tituloId} className="text-xl">
          {adicional ? 'Editar adicional' : 'Agregar adicional'}
        </h2>

        <Field
          label="Nombre"
          value={form.nombre}
          maxLength={MAX.nombre}
          disabled={enviando}
          hint={
            verError('nombre') && (
              <span className="font-medium text-danger">{problemas.nombre}</span>
            )
          }
          onChange={(evento) => campo('nombre', evento.target.value)}
        />

        <Field
          label="Precio"
          inputMode="decimal"
          placeholder="10.00"
          value={form.precio}
          disabled={enviando}
          hint={
            verError('precio') && (
              <span className="font-medium text-danger">{problemas.precio}</span>
            )
          }
          onChange={(evento) => campo('precio', evento.target.value)}
        />

        <label className="flex flex-col gap-1 text-sm text-text">
          Descripcion
          <textarea
            rows={3}
            maxLength={MAX.descripcion}
            value={form.descripcion}
            disabled={enviando}
            placeholder="Que suma al servicio."
            onChange={(evento) => campo('descripcion', evento.target.value)}
            className={`${CAMPO_CLASSES} min-h-20 resize-y py-2`}
          />
        </label>

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
              <span className="font-medium text-text-h">Disponible</span>
              <span className="block text-xs text-text-muted">
                Se ofrece al reservar. Sin esto queda citado en las citas pasadas.
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
            {enviando ? 'Guardando...' : adicional ? 'Guardar cambios' : 'Agregar adicional'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
