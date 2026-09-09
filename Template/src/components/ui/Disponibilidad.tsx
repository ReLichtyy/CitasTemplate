/**
 * Etiqueta de si algo se puede llevar hoy.
 *
 * Punto de color mas texto, como las etiquetas de estado del sistema de diseño: el punto no
 * lleva la informacion solo —el texto la dice igual— porque un estado que solo se distingue
 * por color no se distingue.
 *
 * Agotado va en **neutro**, no en `--color-danger`: que algo se haya acabado no es un error
 * ni algo que el visitante hizo mal. Rojo aqui seria una alarma sin nada que atender.
 *
 * El fondo es opaco (`bg-surface/90` con desenfoque) y no el tono semantico al 12%, porque
 * esta etiqueta se apoya tambien encima de una foto: un fondo translucido dejaria pasar la
 * imagen y el texto quedaria ilegible justo donde mas se lo mira.
 */
export function Disponibilidad({
  disponible,
  className = '',
}: {
  disponible: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border bg-surface/90 px-3 py-1 text-xs font-medium backdrop-blur-sm ${
        disponible ? 'border-success-border text-success' : 'border-border text-text-muted'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${disponible ? 'bg-success' : 'bg-text-muted'}`}
      />
      {disponible ? 'Disponible' : 'Agotado'}
    </span>
  );
}
