import type { NextFunction, Request, Response } from 'express';
import { requestIdActual } from './contexto-peticion.js';
import { CABECERA_REQUEST_ID, RequestIdMiddleware } from './request-id.middleware.js';

function correr(cabecera?: string) {
  const middleware = new RequestIdMiddleware();
  const request = { headers: cabecera === undefined ? {} : { [CABECERA_REQUEST_ID]: cabecera } };
  const enviadas = new Map<string, string>();
  const response = { setHeader: (clave: string, valor: string) => enviadas.set(clave, valor) };

  let idDentro: string | null = null;
  const next = (() => {
    idDentro = requestIdActual();
  }) as NextFunction;

  middleware.use(request as Request, response as unknown as Response, next);

  return { idDentro: idDentro as string | null, cabeceraEnviada: enviadas.get(CABECERA_REQUEST_ID) };
}

describe('RequestIdMiddleware', () => {
  it('genera un id cuando la peticion no trae uno', () => {
    const { idDentro, cabeceraEnviada } = correr();

    expect(idDentro).toMatch(/^[0-9a-f-]{36}$/);
    expect(cabeceraEnviada).toBe(idDentro);
  });

  it('reutiliza el id entrante cuando tiene forma valida', () => {
    const { idDentro, cabeceraEnviada } = correr('trace-0123456789');

    expect(idDentro).toBe('trace-0123456789');
    expect(cabeceraEnviada).toBe('trace-0123456789');
  });

  // Lo que sigue es la razon de que el id entrante se valide: sin filtro, el cliente
  // decide que cadena queda escrita en cada linea de log del servidor.
  it.each([
    ['con salto de linea', 'abcdefgh\n{"nivel":"error"}'],
    ['demasiado corto', 'abc'],
    ['demasiado largo', 'a'.repeat(200)],
    ['con caracteres fuera del juego', 'abcdefgh<script>'],
    ['vacio', ''],
  ])('descarta el id entrante %s y genera uno propio', (_caso, entrante) => {
    const { idDentro } = correr(entrante);

    expect(idDentro).not.toBe(entrante);
    expect(idDentro).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('deja el id disponible dentro de la cadena async, no solo en el request', () => {
    // Es la garantia de la que depende el logger: cualquier `new Logger(...)` que corra
    // durante la peticion lo encuentra sin recibirlo por parametro.
    const { idDentro } = correr();
    expect(idDentro).not.toBeNull();
    // Y fuera de la peticion no queda colgado.
    expect(requestIdActual()).toBeNull();
  });
});
