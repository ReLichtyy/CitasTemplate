import { useId, useRef, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { CajaImagen, type CajaImagenHandle } from './CajaImagen';
import { Dialogo } from './Dialogo';
import { CAMPO_CLASSES, Field } from './Field';
import { archivosService } from '../../services/archivosService';
import type { CrearFotoGaleriaPayload } from '../../services/galeriaService';

/** Los mismos topes que el DTO del API. */
const MAX = { descripcion: 200 };

/** Lo minimo que el selector necesita de un servicio; el resto no se muestra. */
type ServicioParaFoto = { id: string; nombre: string };

type Formulario = {
  servicioId: string;
  descripcion: string;
};

const VACIO: Formulario = { servicioId: '', descripcion: '' };

/**
 * Alta de una foto de resultado para la galeria. A diferencia de `ServicioFormModal`, no
 * hay edicion: la foto siempre es nueva, y por eso la imagen es obligatoria de verdad —
 * no hay una URL previa que conservar si la caja queda vacia.
 *
 * El servicio es un desplegable y no casillas: la foto cuenta **un** resultado de **un**
 * servicio de los que ya hay, no una asignacion.
 */
export function GaleriaFormModal({
  abierto,
  servicios,
  onCerrar,
  onGuardar,
  enviando,
  error,
}: {
  abierto: boolean;
  /** Los servicios publicados; el resultado se logro con uno de ellos o no se agrega. */
  servicios: ServicioParaFoto[];
  onCerrar: () => void;
  /**
   * Devuelve si el guardado prospero. La imagen se sube recien aqui dentro —validado ya
   * todo el formulario— y si el guardado falla, el modal deshace esa subida.
   */
  onGuardar: (datos: CrearFotoGaleriaPayload) => Promise<boolean>;
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

  const objetivo = abierto ? 'nuevo' : null;
  const [sembradoPara, setSembradoPara] = useState<string | null>(null);
  if (objetivo !== sembradoPara) {
    setSembradoPara(objetivo);
    setForm(VACIO);
    setTocado(false);
    setSubidaError(null);
  }

  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setForm((actual) => ({ ...actual, [clave]: valor }));

  const problemas = {
    servicioId: form.servicioId ? null : 'Elija con que servicio se logro el resultado.',
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
      const subida = await caja.current?.subirSiExiste();
      if (!subida) {
        // Este modal es solo alta: sin archivo no hay foto que guardar.
        setSubidaError('La imagen es obligatoria.');
        return;
      }
      const guardado = await onGuardar({
        imagenUrl: subida,
        servicioId: form.servicioId,
        ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
      });
      if (!guardado) {
        // La foto no se guardo y la URL no la referencia nadie: deshacer la subida para
        // no dejar una imagen huerfana en el disco del servidor. Mejor esfuerzo: si el
        // borrado tampoco llega, queda huerfana, que ya era el estado sin esto.
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
          Agregar foto a la galeria
        </h2>

        <CajaImagen
          // `key` por objetivo: al cerrar o reabrir, la caja se remonta y el archivo
          // pendiente de la sesion anterior no se arrastra.
          key={objetivo ?? 'cerrado'}
          label="Imagen"
          url={null}
          disabled={ocupado}
          ref={caja}
        />

        <label className="flex flex-col gap-1 text-sm text-text">
          Servicio
          <select
            value={form.servicioId}
            disabled={ocupado}
            onChange={(evento) => campo('servicioId', evento.target.value)}
            className={CAMPO_CLASSES}
          >
            {/* Sin `value` fijo en la primera: es el texto del estado vacio, no una
                opcion elegible. */}
            <option value="">Elija un servicio</option>
            {servicios.map((servicio) => (
              <option key={servicio.id} value={servicio.id}>
                {servicio.nombre}
              </option>
            ))}
          </select>
          {verError('servicioId') && (
            <span className="font-medium text-danger">{problemas.servicioId}</span>
          )}
        </label>

        <Field
          label="Descripcion (opcional)"
          value={form.descripcion}
          maxLength={MAX.descripcion}
          disabled={ocupado}
          placeholder="Un pie de foto para el visitante."
          onChange={(evento) => campo('descripcion', evento.target.value)}
        />

        {error && <Alert>{error}</Alert>}
        {subidaError && <Alert>{subidaError}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado}>
            {enviando ? 'Guardando...' : subiendo ? 'Subiendo imagen...' : 'Agregar foto'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
