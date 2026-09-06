// TODO(spec 05): esto lo sirve `GET /configuracion` (ConfiguracionNegocio, fila unica) y se
// carga una vez al iniciar la app. Mientras ese endpoint no exista, este archivo es el UNICO
// lugar del frontend con valores de negocio fijos: cuando el backend este listo se reemplaza
// por el fetch y ninguna pagina cambia.
export type ConfiguracionNegocio = {
  nombre: string;
  eslogan: string | null;
  logoUrl: string | null;
  moneda: string;
  locale: string;
  terminoEmpleadoPlural: string;
  terminoServicioPlural: string;
};

export const configuracionPlaceholder: ConfiguracionNegocio = {
  nombre: 'Tu Negocio',
  eslogan: 'Reserva tu cita en minutos',
  logoUrl: null,
  moneda: 'USD',
  locale: 'es',
  terminoEmpleadoPlural: 'Especialistas',
  terminoServicioPlural: 'Servicios',
};
