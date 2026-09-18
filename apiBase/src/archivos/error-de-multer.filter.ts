import { Catch, ExceptionFilter, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { MulterError } from 'multer';
import { ExcepcionesFilter } from '../common/filters/excepciones.filter.js';

/**
 * Traduce los errores de multer antes de que lleguen al filtro global.
 *
 * Un `MulterError` no es una `HttpException`, y sin esto saldria como 500 generico con su
 * detalle al log — cuando lo que paso es que el usuario eligio un archivo que la caja de
 * subida ya le habia dicho que no. Se delega en `ExcepcionesFilter` con la excepcion ya
 * traducida, que es quien escribe el sobre: este filtro no duplica el contrato.
 */
@Catch(MulterError)
export class ErrorDeMulterFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const mensaje =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen no puede pasar de 4 MB.'
        : 'La imagen no es valida.';
    new ExcepcionesFilter().catch(new BadRequestException(mensaje), host);
  }
}
