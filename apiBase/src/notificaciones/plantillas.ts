import { TipoNotificacion } from '../generated/prisma/client.js';

/**
 * Texto de cada aviso. Vive aqui y no en el adaptador porque el mensaje es del
 * negocio, no del canal: si manana se agrega SMS o correo, el texto se reusa.
 *
 * Las variables las congela el outbox al encolar. Releerlas de la base al enviar
 * mandaria un mensaje que describe una cita distinta de la que lo origino.
 */
export interface VariablesConfirmacion {
  nombre: string;
  negocio: string;
  servicio: string;
  profesional: string;
  fecha: string;
  enlace: string;
}

function texto(variables: Record<string, unknown>, clave: string): string {
  const valor = variables[clave];
  return typeof valor === 'string' ? valor : '';
}

export function renderizar(
  plantilla: TipoNotificacion,
  variables: Record<string, unknown>,
): string {
  const nombre = texto(variables, 'nombre');
  const negocio = texto(variables, 'negocio');
  const servicio = texto(variables, 'servicio');
  const profesional = texto(variables, 'profesional');
  const fecha = texto(variables, 'fecha');
  const enlace = texto(variables, 'enlace');

  switch (plantilla) {
    case TipoNotificacion.CONFIRMACION_CITA:
      return [
        `Hola ${nombre}, su cita en ${negocio} quedo reservada.`,
        '',
        `${servicio} con ${profesional}`,
        fecha,
        '',
        'Confirmela aqui:',
        enlace,
      ].join('\n');

    case TipoNotificacion.RECORDATORIO_CITA:
      return [
        `Hola ${nombre}, le recordamos su cita en ${negocio}.`,
        '',
        `${servicio} con ${profesional}`,
        fecha,
      ].join('\n');

    case TipoNotificacion.CANCELACION_CITA:
      return [
        `Hola ${nombre}, su cita en ${negocio} fue cancelada.`,
        '',
        `${servicio} con ${profesional}`,
        fecha,
      ].join('\n');
  }
}
