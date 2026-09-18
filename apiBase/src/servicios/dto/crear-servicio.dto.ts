import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** La misma forma (y la misma razon de ser cadena) que en `productos/dto/crear-producto.dto.ts`. */
const IMPORTE = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * Cuerpo de `POST /servicios`.
 *
 * El precio y la duracion se definen aqui: la reserva los lee y ni siquiera puede
 * mandarlos (ver `citas/dto/reservar-cita.dto.ts`). La lista de profesionales es la
 * asignacion completa — quien reserva elige de ahi, y un servicio sin nadie no se puede
 * reservar, asi que la pantalla la pide entera y el `PATCH` reemplaza con `set`.
 */
export class CrearServicioDto {
  @IsString({ message: 'El nombre debe ser texto.' })
  @MinLength(2, { message: 'El nombre es obligatorio.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'La descripcion debe ser texto.' })
  @MaxLength(2000, { message: 'La descripcion no puede pasar de 2000 caracteres.' })
  descripcion?: string;

  /** Con este rango basta para cualquier negocio de citas y se mantiene lejos del desborde de columnas. */
  @IsInt({ message: 'La duracion debe ser un numero de minutos.' })
  @Min(5, { message: 'La duracion no puede ser menor a 5 minutos.' })
  @Max(720, { message: 'La duracion no puede pasar de 720 minutos.' })
  duracionMinutos!: number;

  @Matches(IMPORTE, {
    message: 'El precio debe ser un importe con hasta dos decimales.',
  })
  precio!: string;

  @IsOptional()
  @IsUrl({}, { message: 'La imagen debe ser una URL valida.' })
  @MaxLength(500, { message: 'La URL de la imagen es demasiado larga.' })
  imagenUrl?: string;

  /** Publicado en el catalogo publico. Dar de baja es apagar esto, nunca borrar la fila. */
  @IsOptional()
  @IsBoolean({ message: 'El indicador de publicado debe ser verdadero o falso.' })
  activo?: boolean;

  /** Quien puede atenderlo. Vacia si y solo si se quiere dejar sin asignar por ahora. */
  @IsOptional()
  @IsArray({ message: 'Los profesionales deben enviarse como una lista.' })
  @ArrayUnique({ message: 'Hay profesionales repetidos en la lista.' })
  @IsUUID(undefined, { each: true, message: 'Alguno de los profesionales no es valido.' })
  empleadoIds?: string[];
}
