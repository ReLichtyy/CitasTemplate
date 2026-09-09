import { TipoNotificacion } from '../generated/prisma/client.js';

/**
 * Imagen que acompaña a un aviso, si lleva.
 *
 * Vive aqui y no en el adaptador por la misma razon que el texto: **que la
 * confirmacion lleve una imagen de agradecimiento es una decision del negocio**, no del
 * canal. Un canal que no sepa mandar imagenes ignora esto y manda el texto solo; el
 * dia que se agregue correo, reusa la misma imagen.
 *
 * `ruta` es absoluta y se resuelve contra este archivo: en `dist/` el modulo compilado
 * y el asset quedan uno al lado del otro (ver `assets` en nest-cli.json), asi que
 * cualquier ruta relativa al directorio de trabajo se romperia segun desde donde se
 * arranque el proceso.
 */
export interface Adjunto {
  ruta: URL;
  mimetype: string;
  nombre: string;
}

const AGRADECIMIENTO: Adjunto = {
  ruta: new URL('./assets/agradecimiento.png', import.meta.url),
  mimetype: 'image/png',
  nombre: 'gracias.png',
};

/**
 * Solo la confirmacion lleva imagen. El recordatorio y la cancelacion no: son avisos
 * utiles, no celebraciones, y adjuntar una imagen a cada mensaje que sale del numero
 * es mas peso, mas ancho de banda y mas parecido a difusion publicitaria, que es
 * justo lo que arriesga la reputacion del numero.
 */
export function adjuntoDe(plantilla: TipoNotificacion): Adjunto | null {
  return plantilla === TipoNotificacion.CONFIRMACION_CITA ? AGRADECIMIENTO : null;
}

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
