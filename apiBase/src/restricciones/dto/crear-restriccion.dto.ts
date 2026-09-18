import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TipoRestriccion } from '../../generated/prisma/enums.js';

/**
 * Cuerpo de `POST /restricciones`.
 *
 * `inicio` y `fin` son instantes absolutos (ISO 8601), no horas de pared: un feriado no es
 * "el 25 de 9 a 18" en cualquier zona, es un rango concreto en la zona del negocio. La
 * pantalla convierte; aqui llega ya resuelto.
 */
export class CrearRestriccionDto {
  @IsEnum(TipoRestriccion, { message: 'El tipo indicado no es valido.' })
  tipo!: TipoRestriccion;

  /**
   * Nulo = cierre de todo el negocio. Con id = bloqueo de ese profesional solo, que es la
   * diferencia que hace util la pantalla: un dia de vacaciones de uno no cierra la agenda
   * de los demas.
   */
  @IsOptional()
  @IsUUID(undefined, { message: 'El profesional indicado no es valido.' })
  empleadoId?: string;

  @IsISO8601({ strict: true }, { message: 'El inicio debe ser una fecha ISO 8601.' })
  inicio!: string;

  @IsISO8601({ strict: true }, { message: 'El fin debe ser una fecha ISO 8601.' })
  fin!: string;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto.' })
  @MaxLength(255, { message: 'El motivo no puede pasar de 255 caracteres.' })
  motivo?: string;
}
