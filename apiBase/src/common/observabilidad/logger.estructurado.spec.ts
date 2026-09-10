import { almacenPeticion } from './contexto-peticion.js';
import { LoggerEstructurado } from './logger.estructurado.js';

/**
 * Captura lo que el logger escribe a stdout y lo devuelve ya parseado. Si una linea no es
 * JSON valido, `JSON.parse` lanza y la prueba falla — que es justo lo que se quiere
 * comprobar en el caso de la inyeccion.
 */
function capturar(accion: (logger: LoggerEstructurado) => void, nivel = 'debug' as const) {
  const lineas: string[] = [];
  const espia = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((texto: string | Uint8Array) => {
      lineas.push(String(texto));
      return true;
    });

  try {
    accion(new LoggerEstructurado({ json: true, nivel }));
  } finally {
    espia.mockRestore();
  }

  return lineas;
}

describe('LoggerEstructurado', () => {
  it('escribe una linea JSON por evento, con nivel y contexto', () => {
    const [linea] = capturar((logger) => logger.log('arranco', 'Bootstrap'));

    expect(linea.endsWith('\n')).toBe(true);
    const registro = JSON.parse(linea);
    expect(registro).toMatchObject({ nivel: 'log', ctx: 'Bootstrap', msg: 'arranco' });
    expect(typeof registro.ts).toBe('string');
  });

  it('estampa el requestId del contexto de la peticion', () => {
    const lineas = capturar((logger) => {
      almacenPeticion.run({ requestId: 'req-de-prueba' }, () => logger.warn('algo'));
    });

    expect(JSON.parse(lineas[0]).requestId).toBe('req-de-prueba');
  });

  it('deja requestId nulo fuera de una peticion', () => {
    const lineas = capturar((logger) => logger.log('cron'));
    expect(JSON.parse(lineas[0]).requestId).toBeNull();
  });

  it('mezcla como campos el mensaje que ya viene en objeto', () => {
    const lineas = capturar((logger) =>
      logger.log({ evento: 'peticion', status: 200, ms: 3.4 }, 'Acceso'),
    );

    expect(JSON.parse(lineas[0])).toMatchObject({
      evento: 'peticion',
      status: 200,
      ms: 3.4,
      ctx: 'Acceso',
    });
  });

  it('escapa los saltos de linea: un mensaje no puede fabricar una segunda linea de log', () => {
    // El caso real: esto llega desde el navegador por POST /telemetria/errores, donde el
    // contenido lo escribe alguien que no se autentica.
    const inyeccion = 'inocente\n{"nivel":"error","msg":"ADMIN BORRADO"}';
    const lineas = capturar((logger) => logger.warn(inyeccion));

    expect(lineas).toHaveLength(1);
    expect(lineas[0].split('\n').filter(Boolean)).toHaveLength(1);
    expect(JSON.parse(lineas[0]).msg).toBe(inyeccion);
  });

  it('recorta un mensaje desmedido en vez de escribirlo entero', () => {
    const lineas = capturar((logger) => logger.log('x'.repeat(5_000)));
    const { msg } = JSON.parse(lineas[0]);

    expect(msg).toContain('[recortado]');
    expect(msg.length).toBeLessThan(2_100);
  });

  it('separa la traza del contexto cuando llega un Error', () => {
    const lineas = capturar((logger) => logger.error('fallo', new Error('boom'), 'Citas'));
    const registro = JSON.parse(lineas[0]);

    expect(registro.ctx).toBe('Citas');
    expect(registro.traza).toContain('boom');
  });

  it('no escribe lo que esta por debajo del nivel configurado', () => {
    const lineas = capturar((logger) => {
      logger.debug('detalle');
      logger.error('grave');
    }, 'warn');

    expect(lineas).toHaveLength(1);
    expect(JSON.parse(lineas[0]).nivel).toBe('error');
  });

  it('sobrevive a una referencia circular: un log no puede tumbar la peticion', () => {
    const circular: Record<string, unknown> = { evento: 'raro' };
    circular.yo = circular;

    const lineas = capturar((logger) => logger.error(circular));

    // La primera vuelta se serializa entera; el ciclo se corta al reencontrarse.
    const registro = JSON.parse(lineas[0]);
    expect(registro.evento).toBe('raro');
    expect(registro.yo.yo).toBe('[circular]');
  });
});
