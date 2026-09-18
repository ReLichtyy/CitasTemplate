import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearEmpleadoDto } from './crear-empleado.dto.js';

/**
 * Cuerpo de `PATCH /empleados/:id`: lo mismo que al crear, todo opcional, mas el
 * interruptor de la ficha. La contrasena, cuando viene, es el **reinicio**: sustituye a
 * la que habia, no se compara con ella (eso es `/auth/password`, que es del propio
 * usuario y pide la actual).
 */
export class ActualizarEmpleadoDto extends PartialType(CrearEmpleadoDto) {
  /**
   * La ficha laboral completa: el catalogo publico **y** el acceso. Con un solo
   * indicador para las dos cosas, un EMPLEADO desactivado no queda dentro de la gestion
   * con su sesion viva — y reactivarlo es un clic, no dos pantallas.
   */
  @IsOptional()
  @IsBoolean({ message: 'El indicador de activo debe ser verdadero o falso.' })
  activo?: boolean;
}
