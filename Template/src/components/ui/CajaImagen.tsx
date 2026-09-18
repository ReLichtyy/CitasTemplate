import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { archivosService } from '../../services/archivosService';

/** Lo que acepta el API. Lo mismo que dice el aviso: comprobarlo aqui evita el viaje. */
const TAMANO_MAX = 4 * 1024 * 1024;

const MIMES = new Set(['image/jpeg', 'image/png']);

/** Lo que el modal le puede pedir a la caja cuando el guardado ya paso su validacion. */
export type CajaImagenHandle = {
  /**
   * Sube el archivo elegido, si hay uno, y devuelve la URL que devolvio el API. Nulo
   * cuando no habia nada pendiente (una edicion sin cambiar la foto, por ejemplo).
   * Fallar la subida lanza con el texto del API: quien llama decide como mostrarlo.
   */
  subirSiExiste: () => Promise<string | null>;
};

/**
 * Caja de subida de imagen, con vista previa.
 *
 * La imagen **no se sube al elegirla**: el archivo queda en memoria del navegador con una
 * vista previa local (`URL.createObjectURL`), y recien al guardar —cuando el resto del
 * formulario ya paso la validacion— el modal invoca `subirSiExiste` y recibe la URL que
 * se persiste en `imagenUrl`/`fotoUrl`. Cancelar el modal descarta esa memoria: al
 * servidor no llego nada y no queda ningun archivo huerfano en el disco. Elegir otro
 * archivo antes de guardar reemplaza al pendiente, que tampoco existio alla.
 *
 * `url` es la imagen que el registro ya tiene guardada: se muestra mientras no haya
 * archivo pendiente que la reemplace, y es la que sigue viajando en el formulario si el
 * usuario no toca la caja.
 */
export function CajaImagen({
  label,
  url,
  disabled = false,
  ref,
}: {
  label: string;
  /** La que se ve hoy si no hay archivo pendiente: la del registro. Nulo = todavia ninguna. */
  url: string | null;
  disabled?: boolean;
  /** El modal lo usa para pedir la subida en su `onSubmit`, no antes. */
  ref?: Ref<CajaImagenHandle>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sin dependencias: `subirSiExiste` tiene que ver el archivo del render actual, no el
  // de cuando se creo el handle. El modal lo invoca una vez por intento de guardado.
  useImperativeHandle(ref, () => ({
    async subirSiExiste() {
      if (!archivo) {
        return null;
      }
      const { url: subida } = await archivosService.subir(archivo);
      return subida;
    },
  }));

  // La URL de objeto se revoca cuando deja de usarse: el navegador no sabe que el
  // archivo dejo de interesarnos y el preview vive en memoria hasta que alguien la
  // suelte. El cleanup corre tambien al desmontar (cerrar el dialogo, remontar la caja).
  useEffect(() => {
    if (!preview) {
      return;
    }
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function elegir(archivos: FileList) {
    const imagen = archivos[0];
    if (!imagen) {
      return;
    }

    // Las mismas reglas del API, aqui para que el error se vea al elegir y no despues de
    // esperar la subida. El API las vuelve a aplicar todas.
    if (!MIMES.has(imagen.type)) {
      setError('La imagen debe ser JPG o PNG.');
      return;
    }
    if (imagen.size > TAMANO_MAX) {
      setError('La imagen no puede pasar de 4 MB.');
      return;
    }

    setError(null);
    setArchivo(imagen);
    setPreview(URL.createObjectURL(imagen));
  }

  const mostrada = preview ?? url;

  return (
    <div className="flex flex-col gap-1 text-sm text-text">
      {label}

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-3">
        <div
          className={`flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
            mostrada ? '' : 'border border-dashed border-border'
          }`}
        >
          {mostrada ? (
            // La preview de lo que va a quedar: la card de a lado recorta al centro, y esto
            // muestra exactamente ese recorte y no la foto entera. Con archivo pendiente es
            // la URL de objeto local; sin el, la que el registro ya tiene en el servidor.
            <img src={mostrada} alt="" className="size-full object-cover" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-6 text-text-muted"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </div>

        <div className="flex min-w-40 flex-1 flex-col gap-2">
          <p className="m-0 text-xs text-text-muted">
            JPG o PNG, hasta 4 MB. Se recorta al centro en las tarjetas.
          </p>
          <div>
            <Button
              variant="secondary"
              className="min-h-11 px-4 py-2"
              disabled={disabled}
              onClick={() => entrada.current?.click()}
            >
              {mostrada ? 'Elegir otra imagen' : 'Elegir archivo'}
            </Button>
          </div>
        </div>

        {/* Oculto y no `display:none`: el input es el que trae el dialogo de archivos y el
            teclado; el boton solo lo dispara. */}
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          disabled={disabled}
          onChange={(evento) => {
            if (evento.target.files) {
              elegir(evento.target.files);
            }
            // Se limpia siempre: sin esto, elegir el mismo archivo rechazado no dispara
            // otro `change`, y el usuario no puede reintentar la misma foto corregida.
            evento.target.value = '';
          }}
        />
      </div>

      {error && <Alert>{error}</Alert>}
    </div>
  );
}
