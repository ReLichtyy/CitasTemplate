import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Lo que se responde cuando el error no es uno que el cliente deba leer en detalle. */
const MENSAJES_GENERICOS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'La peticion no es valida.',
  [HttpStatus.UNAUTHORIZED]: 'Su sesion no es valida. Vuelva a iniciar sesion.',
  [HttpStatus.FORBIDDEN]: 'No tiene acceso a este recurso.',
  [HttpStatus.NOT_FOUND]: 'Recurso no encontrado.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'No se pudo completar la operacion.',
};

/**
 * Traduce cualquier excepcion al mismo sobre que usa el exito, y decide que sale y que no.
 *
 * La regla que importa: lo que **no** es `HttpException` —un error de Prisma, un `TypeError`,
 * cualquier cosa que no se penso como respuesta— sale como 500 generico y su detalle va al
 * log. Un mensaje de Prisma en el cuerpo publica nombres de tabla y de columna, y un stack
 * publica rutas del servidor. Ver 04-contrato-api.md.
 */
@Catch()
export class ExcepcionesFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excepcion');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<{ method: string; url: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.mensaje(exception, status);

    /**
     * Dos lineas por peticion fallida, y cada una tiene un trabajo distinto: la del
     * `AccesoInterceptor` dice *que* paso (metodo, ruta, codigo, ms) y esta dice *por
     * que*. Las dos llevan el mismo `requestId`, que es lo que las une — y lo que une a
     * las dos con el codigo que el navegador le mostro al usuario.
     */
    const detalle = {
      evento: 'excepcion',
      metodo: request.method,
      // Aqui si va la url concreta y no la ruta declarada: para reproducir el fallo hace
      // falta el id que se pidio.
      url: request.url,
      status,
      // El texto que efectivamente se le devolvio al cliente. Sin esto, un 400 en el log
      // no dice cual de las diez validaciones del DTO fue.
      message,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // El detalle completo va aqui y solo aqui.
      this.logger.error(detalle, exception as Error);
    } else {
      // Los 4xx se registraban en ningun lado, y son la mayoria de lo que el frontend
      // provoca: DTO rechazado, token vencido, traslape. Van a `warn` —no son fallas del
      // servidor— pero van.
      this.logger.warn(detalle);
    }

    response.status(status).json({ success: false, data: null, message });
  }

  private mensaje(exception: unknown, status: number): string {
    if (!(exception instanceof HttpException)) {
      return MENSAJES_GENERICOS[HttpStatus.INTERNAL_SERVER_ERROR];
    }

    const cuerpo = exception.getResponse();
    const propio =
      typeof cuerpo === 'string'
        ? cuerpo
        : this.primerMensaje((cuerpo as { message?: unknown }).message);

    // 400, 409 y 429 son los que se redactan para que el usuario final los lea: el primer
    // error de `class-validator`, el texto del traslape, el del limite de intentos. El
    // resto se contesta con el generico aunque la excepcion traiga algo mas especifico —
    // un 403 o un 404 con detalle convierte la ruta en un oraculo de recursos ajenos.
    const seDevuelveTalCual =
      status === HttpStatus.BAD_REQUEST ||
      status === HttpStatus.CONFLICT ||
      status === HttpStatus.TOO_MANY_REQUESTS ||
      // El 401 del login trae su propio texto ("telefono o contrasena incorrectos", igual
      // para los dos casos). El de un token vencido trae el 'Unauthorized' de Passport,
      // que ni esta en español ni le dice nada al usuario.
      (status === HttpStatus.UNAUTHORIZED && propio !== 'Unauthorized');

    if (seDevuelveTalCual && propio) {
      return propio;
    }
    return MENSAJES_GENERICOS[status] ?? 'No se pudo completar la operacion.';
  }

  /** El `ValidationPipe` devuelve un arreglo; se muestra el primero. */
  private primerMensaje(message: unknown): string | null {
    if (Array.isArray(message)) {
      return typeof message[0] === 'string' ? message[0] : null;
    }
    return typeof message === 'string' ? message : null;
  }
}
