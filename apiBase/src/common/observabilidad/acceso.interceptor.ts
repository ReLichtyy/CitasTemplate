import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap, type Observable } from 'rxjs';

/**
 * Rutas cuyo exito no se registra a nivel `log`. `/health` lo pregunta un monitor cada
 * pocos segundos: dejarlo en `log` llena el archivo de lineas que no dicen nada y esconde
 * las que si. Sus fallos si se registran, como los de cualquier otra.
 */
const RUTAS_SILENCIOSAS = new Set(['/health']);

/**
 * Una linea por peticion atendida: metodo, ruta, codigo y cuanto tardo.
 *
 * Es la mitad de la observabilidad que no son errores. Sin esto solo se ve lo que falla, y
 * entonces no hay forma de contestar "¿esta lento?" ni "¿el frontend esta llamando a lo
 * que creo?" — que en una demo son justo las dos preguntas que aparecen.
 *
 * Se registra la **ruta declarada** (`/citas/:id`), no la url concreta (`/citas/9f3…`):
 * agrupa, y de paso no mete ids de recursos en cada linea. La url completa solo aparece
 * en el registro de error, donde hace falta para reproducir.
 */
@Injectable()
export class AccesoInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Acceso');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const inicio = process.hrtime.bigint();

    const registrar = (status: number) => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1_000_000;
      const ruta = request.route?.path ?? request.url;
      const datos = {
        evento: 'peticion',
        metodo: request.method,
        ruta,
        status,
        ms: Math.round(ms * 10) / 10,
      };

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(datos);
      } else if (status >= HttpStatus.BAD_REQUEST) {
        // Un 4xx no es una falla del servidor, pero casi siempre es una falla del cliente
        // que lo llamo: DTO mal armado, token vencido, id que no existe. Es la señal que
        // mas veces explica un "no me deja" en el navegador, y hasta ahora no se
        // registraba en ningun lado.
        this.logger.warn(datos);
      } else if (RUTAS_SILENCIOSAS.has(ruta)) {
        this.logger.debug(datos);
      } else {
        this.logger.log(datos);
      }
    };

    return next.handle().pipe(
      tap({
        next: () => registrar(response.statusCode),
        // En el camino de error la respuesta todavia no tiene codigo: lo pone el filtro
        // despues. Se toma de la excepcion, que es quien ya lo sabe.
        error: (fallo: unknown) =>
          registrar(
            fallo instanceof HttpException
              ? fallo.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR,
          ),
      }),
    );
  }
}
