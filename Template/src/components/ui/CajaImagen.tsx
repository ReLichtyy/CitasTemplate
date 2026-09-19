import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { archivosService } from '../../services/archivosService';

/** Lo que acepta el API. Lo mismo que dice el aviso: comprobarlo aqui evita el viaje. */
const TAMANO_MAX = 4 * 1024 * 1024;

/**
 * Lo que el usuario puede elegir. El HEIC/HEIF de iPhone nunca viaja al API como tal:
 * se convierte a JPG en el navegador antes de subir (ver `ajustar`).
 */
const MIMES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);

/** A lo que se achica la foto antes de subir: del lado mayor. */
const LADO_MAX = 1600;

/** La calidad del JPG que sale del canvas: suficiente para una tarjeta y pesa poco. */
const CALIDAD = 0.85;

/**
 * Decodifica el archivo en un `<img>` y no en `createImageBitmap`: el elemento aplica
 * solo la orientacion EXIF de la foto —el bitmap, en algunos Safari, no— y es el camino
 * que funciona igual en todos los navegadores.
 */
function decodificar(imagen: File): Promise<HTMLImageElement> {
  return new Promise((resolver, fallar) => {
    const url = URL.createObjectURL(imagen);
    const elemento = new Image();
    elemento.onload = () => {
      URL.revokeObjectURL(url);
      resolver(elemento);
    };
    elemento.onerror = () => {
      URL.revokeObjectURL(url);
      fallar(new Error('no-decodifica'));
    };
    elemento.src = url;
  });
}

/**
 * Convierte la foto a un JPG que el API acepta: reescala a `LADO_MAX` de lado mayor y
 * comprime. Es lo que vuelve subibles las fotos de telefono —HEIC, o de 48 MP que no
 * entran en 4 MB— sin tocar el servidor.
 *
 * Falla cuando el navegador no sabe decodificar el formato: HEIC solo lo lee Safari; en
 * el resto, elegir un HEIC termina en el error claro de `elegir` y no en un rechazo seco.
 */
async function ajustar(imagen: File): Promise<File> {
  const decodificada = await decodificar(imagen);
  const escala = Math.min(1, LADO_MAX / Math.max(decodificada.width, decodificada.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(decodificada.width * escala));
  canvas.height = Math.max(1, Math.round(decodificada.height * escala));
  const contexto = canvas.getContext('2d');
  if (!contexto) {
    throw new Error('no-canvas');
  }
  // Fondo blanco: el JPG no tiene alfa y el canvas nace transparente, que en JPG sale negro.
  contexto.fillStyle = 'white';
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.drawImage(decodificada, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolver) =>
    canvas.toBlob(resolver, 'image/jpeg', CALIDAD),
  );
  if (!blob) {
    throw new Error('no-codifica');
  }
  return new File([blob], `${imagen.name.replace(/\.[^.]+$/, '')}.jpg`, {
    type: 'image/jpeg',
  });
}

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
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  /**
   * Lo que va a subir, como promesa: una foto de 48 MP tarda lo suyo en ajustarse y el
   * modal puede guardar mientras tanto — `subirSiExiste` espera a esta y no se sube el
   * registro sin la imagen que el usuario acaba de elegir. Nulo = nada pendiente.
   */
  const pendiente = useRef<Promise<File | null> | null>(null);
  /**
   * La caja se remonta al cerrar el dialogo (el `key` por objetivo de los modales) y el
   * ajuste de una foto grande puede terminar despues de ese desmonte. Sin esto, la URL
   * de objeto del resultado se crearia en un componente muerto y nadie la revocaria.
   */
  const montada = useRef(true);
  useEffect(() => {
    return () => {
      montada.current = false;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    async subirSiExiste() {
      const elegida = pendiente.current ? await pendiente.current : null;
      if (!elegida) {
        return null;
      }
      const { url: subida } = await archivosService.subir(elegida);
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

  async function elegir(archivos: FileList) {
    const imagen = archivos[0];
    if (!imagen) {
      return;
    }

    // La lista del API mas el HEIC de iPhone, que nunca viaja crudo. Comprobarla aqui
    // hace que el error se vea al elegir y no despues de esperar la subida.
    if (!MIMES.has(imagen.type)) {
      setError('La imagen debe ser JPG, PNG o HEIC.');
      return;
    }

    // La que ya cumple (JPG o PNG dentro del tope) va tal cual: recomprimirla solo
    // perderia calidad. El HEIC y la que pasa de 4 MB se ajustan en el navegador.
    if (imagen.size <= TAMANO_MAX && imagen.type !== 'image/heic' && imagen.type !== 'image/heif') {
      setError(null);
      pendiente.current = Promise.resolve(imagen);
      setPreview(URL.createObjectURL(imagen));
      return;
    }

    // El preview inmediato es del archivo original: el ajuste de una foto grande tarda
    // lo suyo y lo elegido tiene que verse desde ya. Al terminar, el preview pasa a la
    // version ajustada — la que de verdad va a viajar.
    setError(null);
    setPreview(URL.createObjectURL(imagen));
    setProcesando(true);
    pendiente.current = (async () => {
      try {
        const lista = await ajustar(imagen);
        if (lista.size > TAMANO_MAX) {
          // Carambola: la ajustada deberia quedar muy por debajo del tope, pero el
          // chequeo es el mismo del API y el mensaje, el mismo de siempre.
          setError('La imagen no puede pasar de 4 MB.');
          setPreview(null);
          return null;
        }
        const urlFinal = URL.createObjectURL(lista);
        if (!montada.current) {
          // La caja ya se desmonto: ningun efecto va a correr que revoque esta URL.
          URL.revokeObjectURL(urlFinal);
          return null;
        }
        setPreview(urlFinal);
        return lista;
      } catch {
        // Safari lee HEIC; el resto de los navegadores, no. Que se sepa que fue el
        // formato y no un fallo del usuario: el JPG o PNG de siempre sigue pasando.
        setError('Este navegador no puede leer el formato de esa foto. Elija una imagen JPG o PNG.');
        setPreview(null);
        return null;
      } finally {
        setProcesando(false);
      }
    })();
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
            {procesando
              ? 'Ajustando la foto para que viaje liviana...'
              : 'JPG, PNG o HEIC. La foto que pase de 4 MB se ajusta sola. Se recorta al centro en las tarjetas.'}
          </p>
          <div>
            <Button
              variant="secondary"
              className="min-h-11 px-4 py-2"
              disabled={disabled || procesando}
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
          accept="image/jpeg,image/png,image/heic,image/heif"
          className="hidden"
          disabled={disabled || procesando}
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
