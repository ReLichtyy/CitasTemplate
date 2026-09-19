// TODO(spec 05): esto lo sirve `GET /configuracion` (ConfiguracionNegocio, fila unica) y se
// carga una vez al iniciar la app. Mientras ese endpoint no exista, este archivo es el UNICO
// lugar del frontend con valores de negocio fijos: cuando el backend este listo se reemplaza
// por el fetch y ninguna pagina cambia.
export type ConfiguracionNegocio = {
  nombre: string;
  eslogan: string | null;
  logoUrl: string | null;
  /**
   * Portada de la seccion de ubicacion de la landing: la foto del local o el logo grande.
   * Nulo = la card muestra el monograma del nombre, como cualquier card de catalogo sin foto.
   */
  portadaUrl: string | null;
  /**
   * Video de presentacion de la seccion de ubicacion. Nulo = el contenedor muestra su
   * lugar con el glyph de video; la seccion no cambia de forma al cargar uno.
   */
  videoPresentacionUrl: string | null;
  /**
   * Lo que Google Maps resuelve al buscar el local: la direccion o el nombre del punto.
   * Del esto sale el embed del mapa, asi que mudarse de local es editar este string.
   */
  ubicacionMapsQuery: string;
  moneda: string;
  locale: string;
  terminoEmpleadoPlural: string;
  terminoServicioPlural: string;
  terminoProductoPlural: string;
};

export const configuracionPlaceholder: ConfiguracionNegocio = {
  nombre: 'Tu Negocio',
  eslogan: 'Reserva tu cita en minutos',
  logoUrl: null,
  portadaUrl: null,
  videoPresentacionUrl: null,
  ubicacionMapsQuery: 'Mercado de Alajuela, Alajuela, Costa Rica',
  moneda: 'USD',
  locale: 'es',
  terminoEmpleadoPlural: 'Especialistas',
  terminoServicioPlural: 'Servicios',
  terminoProductoPlural: 'Productos',
};
