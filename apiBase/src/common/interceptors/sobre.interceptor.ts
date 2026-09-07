import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

export interface Sobre<T> {
  success: boolean;
  data: T;
  message: string | null;
}

/**
 * Envuelve toda respuesta con exito en `{ success, data, message }`. El caso de error lo
 * arma `ExcepcionesFilter`, con la misma forma. Ningun controlador arma su propio formato:
 * ese es todo el valor del contrato. Ver 04-contrato-api.md.
 */
@Injectable()
export class SobreInterceptor<T> implements NestInterceptor<T, Sobre<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Sobre<T>> {
    return next.handle().pipe(
      map((data) => ({ success: true, data, message: null })),
    );
  }
}
