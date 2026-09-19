import { TipoNotificacion } from '../generated/prisma/client.js';
import { renderizar } from './plantillas.js';

/**
 * La plantilla es lo que el cliente lee; los casos que pueden romperla en silencio
 * son dos: el enlace que ya no existe porque el negocio desactivo la confirmacion, y
 * el aviso nuevo al administrador.
 */

const VARIABLES = {
  nombre: 'Marta Lopez',
  negocio: 'El Negocio',
  servicio: 'Corte',
  profesional: 'Ana',
  fecha: 'viernes 25 de septiembre, 3 p.m.',
  enlace: 'https://app.example/citas/confirmar/abc',
};

describe('renderizar', () => {
  it('la confirmacion pide tocar el enlace cuando existe', () => {
    const texto = renderizar(TipoNotificacion.CONFIRMACION_CITA, VARIABLES);

    expect(texto).toContain('Confirmela aqui:');
    expect(texto).toContain(VARIABLES.enlace);
  });

  /** Sin el "select", el mensaje no puede ofrecer un enlace que no existe. */
  it('la confirmacion termina en la fecha cuando no hay enlace', () => {
    const texto = renderizar(TipoNotificacion.CONFIRMACION_CITA, {
      ...VARIABLES,
      enlace: '',
    });

    expect(texto).not.toContain('Confirmela');
    expect(texto.endsWith(VARIABLES.fecha)).toBe(true);
  });

  it('el aviso de reserva dice quien, con quien y cuando, sin enlace', () => {
    const texto = renderizar(TipoNotificacion.AVISO_RESERVA_CITA, VARIABLES);

    expect(texto).toContain('Marta Lopez reservo Corte con Ana');
    expect(texto).toContain(VARIABLES.fecha);
    expect(texto).not.toContain('Confirmela');
  });
});
