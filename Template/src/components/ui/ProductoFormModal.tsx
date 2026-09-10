import { useId, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Dialogo } from './Dialogo';
import { CAMPO_CLASSES, Field } from './Field';
import type { CategoriaProducto, ProductoGestion } from '../../types/producto';
import type { CrearProductoPayload } from '../../services/productosService';

/** Los mismos topes que el DTO del API. Repetirlos aqui evita un viaje para saber que sobra. */
const MAX = { nombre: 120, presentacion: 60, descripcion: 2000, imagenUrl: 500 };

/** Hasta dos decimales, que es lo que cabe en `Decimal(10, 2)`. Igual que el DTO. */
const IMPORTE = /^\d{1,8}(\.\d{1,2})?$/;

type Formulario = {
  categoriaId: string;
  nombre: string;
  descripcion: string;
  precio: string;
  presentacion: string;
  imagenUrl: string;
  activo: boolean;
  disponible: boolean;
};

const VACIO: Formulario = {
  categoriaId: '',
  nombre: '',
  descripcion: '',
  precio: '',
  presentacion: '',
  imagenUrl: '',
  activo: true,
  disponible: true,
};

function desdeProducto(producto: ProductoGestion): Formulario {
  return {
    categoriaId: producto.categoriaId,
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? '',
    precio: producto.precio,
    presentacion: producto.presentacion,
    imagenUrl: producto.imagenUrl ?? '',
    activo: producto.activo,
    disponible: producto.disponible,
  };
}

/**
 * Alta y edicion de un producto. El mismo formulario para las dos: los campos son los
 * mismos y mantener dos copias termina con una que valida distinto que la otra.
 *
 * La validacion de aqui es **comodidad, no autoridad**: repite las reglas del DTO para que
 * el usuario vea el problema al escribir y no despues de un viaje al servidor. El API las
 * vuelve a aplicar todas, y su mensaje es el que se muestra si algo se escapa.
 */
export function ProductoFormModal({
  abierto,
  producto,
  categorias,
  onCerrar,
  onGuardar,
  enviando,
  error,
}: {
  abierto: boolean;
  /** Nulo para un alta; el producto a editar en caso contrario. */
  producto: ProductoGestion | null;
  categorias: CategoriaProducto[];
  onCerrar: () => void;
  onGuardar: (datos: CrearProductoPayload) => void;
  enviando: boolean;
  error: string | null;
}) {
  const tituloId = useId();
  const [form, setForm] = useState<Formulario>(VACIO);
  const [tocado, setTocado] = useState(false);

  /**
   * Siembra el formulario al abrir, ajustando el estado **durante el render** y no desde un
   * efecto. Es el mismo patron que usa `Navbar` para cerrar su menu al cambiar de ruta.
   *
   * Con un efecto, el dialogo se pintaba una vez con los datos viejos antes de corregirse
   * —un parpadeo visible al reabrir sobre otro producto— y ademas encadenaba un render de
   * mas. React trata este `setState` en render como parte del mismo intento: descarta la
   * salida y vuelve a renderizar antes de tocar el DOM.
   *
   * `objetivo` es lo que se esta editando: el id del producto, `'nuevo'` en un alta, o
   * `null` con el dialogo cerrado. Al cerrarse pasa a `null`, asi que volver a abrir sobre
   * el mismo producto tambien vuelve a sembrar.
   */
  const objetivo = abierto ? (producto?.id ?? 'nuevo') : null;
  const [sembradoPara, setSembradoPara] = useState<string | null>(null);
  if (objetivo !== sembradoPara) {
    setSembradoPara(objetivo);
    setForm(producto ? desdeProducto(producto) : VACIO);
    setTocado(false);
  }

  const campo = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) =>
    setForm((actual) => ({ ...actual, [clave]: valor }));

  const problemas = {
    categoriaId: form.categoriaId === '' ? 'Elija una categoria.' : null,
    nombre: form.nombre.trim().length < 2 ? 'El nombre es obligatorio.' : null,
    precio: IMPORTE.test(form.precio) ? null : 'Importe con hasta dos decimales.',
    presentacion: form.presentacion.trim() === '' ? 'La presentacion es obligatoria.' : null,
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
      categoriaId: form.categoriaId,
      nombre: form.nombre.trim(),
      precio: form.precio,
      presentacion: form.presentacion.trim(),
      // Los opcionales se **omiten** en vez de mandarse vacios: el DTO valida `imagenUrl`
      // como URL, y una cadena vacia seria un 400 por un campo que el usuario dejo en blanco
      // a proposito.
      ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
      ...(form.imagenUrl.trim() ? { imagenUrl: form.imagenUrl.trim() } : {}),
      activo: form.activo,
      disponible: form.disponible,
    });
  }

  const verError = (clave: keyof typeof problemas) => (tocado ? problemas[clave] : null);

  return (
    <Dialogo open={abierto} onClose={cerrar} tituloId={tituloId} className="max-w-lg">
      <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:p-6">
        <h2 id={tituloId} className="text-xl">
          {producto ? 'Editar producto' : 'Agregar producto'}
        </h2>

        <label className="flex flex-col gap-1 text-sm text-text">
          Categoria
          <select
            value={form.categoriaId}
            disabled={enviando}
            onChange={(evento) => campo('categoriaId', evento.target.value)}
            className={CAMPO_CLASSES}
          >
            <option value="">Elija una...</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
          {verError('categoriaId') && (
            <span className="text-xs font-medium text-danger">{problemas.categoriaId}</span>
          )}
        </label>

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

        <div className="flex flex-wrap gap-3">
          <Field
            label="Precio"
            // `inputMode` y no `type="number"`: el numerico redondea, deja pegar notacion
            // cientifica y en algunos navegadores devuelve "" cuando el valor no le gusta.
            // El precio viaja como cadena de punta a punta.
            inputMode="decimal"
            placeholder="24.00"
            value={form.precio}
            disabled={enviando}
            wrapperClassName="min-w-32 flex-1"
            hint={
              verError('precio') && (
                <span className="font-medium text-danger">{problemas.precio}</span>
              )
            }
            onChange={(evento) => campo('precio', evento.target.value)}
          />
          <Field
            label="Presentacion"
            placeholder="50 ml"
            value={form.presentacion}
            maxLength={MAX.presentacion}
            disabled={enviando}
            wrapperClassName="min-w-32 flex-1"
            hint={
              verError('presentacion') && (
                <span className="font-medium text-danger">{problemas.presentacion}</span>
              )
            }
            onChange={(evento) => campo('presentacion', evento.target.value)}
          />
        </div>

        <Field
          label="Imagen (URL)"
          type="url"
          placeholder="https://..."
          value={form.imagenUrl}
          maxLength={MAX.imagenUrl}
          disabled={enviando}
          hint="Opcional. Sin imagen, la card muestra la inicial del nombre."
          onChange={(evento) => campo('imagenUrl', evento.target.value)}
        />

        <label className="flex flex-col gap-1 text-sm text-text">
          Descripcion
          <textarea
            rows={3}
            maxLength={MAX.descripcion}
            value={form.descripcion}
            disabled={enviando}
            placeholder="Que hace y como se usa."
            onChange={(evento) => campo('descripcion', evento.target.value)}
            className={`${CAMPO_CLASSES} min-h-20 resize-y py-2`}
          />
        </label>

        {/* Los dos indicadores, con su diferencia escrita: es la que nadie recuerda, y
            confundirlos es despublicar un producto que solo estaba agotado. */}
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
              <span className="font-medium text-text-h">Publicado</span>
              <span className="block text-xs text-text-muted">Aparece en el catalogo publico.</span>
            </span>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.disponible}
              disabled={enviando}
              onChange={(evento) => campo('disponible', evento.target.checked)}
              className="size-4 shrink-0 accent-accent"
            />
            <span>
              <span className="font-medium text-text-h">Con existencias</span>
              <span className="block text-xs text-text-muted">
                Sin esto se publica igual, marcado como agotado.
              </span>
            </span>
          </label>
        </fieldset>

        {/* El texto sale del API: es el que sabe que fallo de verdad. */}
        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? 'Guardando...' : producto ? 'Guardar cambios' : 'Agregar producto'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}
