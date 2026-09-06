import {
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo de PATCH /citas/:id. Todo es opcional: sirve tanto para reprogramar como
 * para cambiar de estado. Cualquier campo que altere el espacio ocupado vuelve a
 * pasar por la misma verificacion de disponibilidad que una reserva nueva.
 */
export class ActualizarCitaDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'El servicio indicado no es valido.' })
  servicioId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'El profesional indicado no es valido.' })
  empleadoId?: string;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'La fecha y hora de inicio debe ser una fecha ISO 8601.' },
  )
  inicio?: string;

  @IsOptional()
  @IsArray({ message: 'Los adicionales deben enviarse como una lista.' })
  @ArrayUnique({ message: 'Hay adicionales repetidos en la lista.' })
  @IsUUID(undefined, { each: true, message: 'Alguno de los adicionales no es valido.' })
  adicionalIds?: string[];

  /** `EstadoCita.codigo`, no el id: es la llave estable del catalogo. */
  @IsOptional()
  @IsString({ message: 'El estado debe ser texto.' })
  @MaxLength(50, { message: 'El estado indicado no es valido.' })
  estadoCodigo?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto.' })
  @MaxLength(2000, { message: 'Las notas no pueden pasar de 2000 caracteres.' })
  notas?: string;
}
