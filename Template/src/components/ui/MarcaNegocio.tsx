import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';

type MarcaNegocioProps = {
  /** Clases del logo cuando el negocio cargo uno. El alto lo decide quien la usa. */
  imgClassName?: string;
  /** Clases del nombre cuando no hay logo: es la marca escrita, no un texto mas. */
  textClassName?: string;
};

/**
 * El nombre del negocio, como logo si lo hay y como palabra si no.
 *
 * Sale de `ConfiguracionNegocio` y de ningun otro lado: la cadena "CitasTemplate" es el
 * nombre del repositorio, no el de un producto, y estaba escrita a mano en el navbar y en
 * el pie (ver 05-marca-y-responsive.md y 06-hero-landing.md). Los tres lugares que la
 * muestran —navbar, pie y hero— comparten este componente para que cambiar de rubro no
 * obligue a abrir ningun `.tsx`.
 */
export function MarcaNegocio({
  imgClassName = 'max-h-8 w-auto',
  textClassName = '',
}: MarcaNegocioProps) {
  const { nombre, logoUrl } = configuracionPlaceholder;

  return logoUrl ? (
    <img src={logoUrl} alt={nombre} className={imgClassName} />
  ) : (
    <span className={textClassName}>{nombre}</span>
  );
}
