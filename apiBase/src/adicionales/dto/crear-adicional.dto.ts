import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Importe con hasta dos decimales, que es lo que cabe en `Decimal(10, 2)`. La misma forma
 * (y la misma razon de ser cadena) que en `productos/dto/crear-producto.dto.ts`.
 */
const IMPORTE = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * Cuerpo de `POST /adicionales`.
 *
 * El precio se define aqui, igual que en productos: este es el catalogo. Quien no puede
 * traer el suyo propio es la reserva — ver `citas/dto/reservar-cita.dto.ts`.
 */
export class CrearAdicionalDto {
  @IsString({ message: 'El nombre debe ser texto.' })
  @MinLength(2, { message: 'El nombre es obligatorio.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'La descripcion debe ser texto.' })
  @MaxLength(2000, { message: 'La descripcion no puede pasar de 2000 caracteres.' })
  descripcion?: string;

  @Matches(IMPORTE, {
    message: 'El precio debe ser un importe con hasta dos decimales.',
  })
  precio!: string;

  /** Ofrecido al reservar. Apagarlo saca el adicional de la reserva, no de las citas viejas. */
  @IsOptional()
  @IsBoolean({ message: 'El indicador de disponible debe ser verdadero o falso.' })
  activo?: boolean;
}
