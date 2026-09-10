import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { almacenPeticion } from './contexto-peticion.js';

export const CABECERA_REQUEST_ID = 'x-request-id';

/**
 * Un id propio de la peticion, presente en el log y devuelto al cliente.
 *
 * Es lo que convierte "no me deja reservar" en algo buscable: la pantalla muestra el
 * codigo, el log del servidor tiene esa misma cadena y con ella sale la traza completa
 * sin haber tenido que publicarla al navegador. Ver 10-observabilidad.md.
 *
 * El id que venga en la cabecera se **acepta pero no se cree**: se valida forma y largo
 * antes de reutilizarlo. Sin eso, el cliente decide que cadena entra en el log del
 * servidor — un salto de linea ahi falsifica una linea de log entera, y un id de 10 kB
 * lo escribe en cada linea que la peticion genere. Lo que no pase el filtro se descarta
 * en silencio y se genera uno nuevo: rechazar la peticion no aportaria nada.
 */
const FORMA_VALIDA = /^[A-Za-z0-9._-]{8,64}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const entrante = request.headers[CABECERA_REQUEST_ID];
    const candidato = Array.isArray(entrante) ? entrante[0] : entrante;

    const requestId =
      candidato && FORMA_VALIDA.test(candidato) ? candidato : randomUUID();

    // Se devuelve siempre, tambien en las respuestas con exito: el frontend lo guarda
    // para poder citarlo si algo falla despues.
    response.setHeader(CABECERA_REQUEST_ID, requestId);

    // El `next()` va dentro del contexto: todo lo que corra despues —guards, controlador,
    // servicio, filtro de excepciones— queda dentro de esta misma cadena async.
    almacenPeticion.run({ requestId }, next);
  }
}
