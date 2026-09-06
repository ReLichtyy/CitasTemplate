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
 * Cuerpo de POST /citas.
 *
 * No lleva `fin` ni ningun importe a proposito: el servidor calcula
 * `fin = inicio + Servicio.duracionMinutos` y recalcula precio y total leyendo la
 * base. Lo que venga de mas lo descarta el ValidationPipe (whitelist). Ver spec/02.
 */
export class ReservarCitaDto {
  @IsUUID(undefined, { message: 'El servicio indicado no es valido.' })
  servicioId!: string;

  @IsUUID(undefined, { message: 'El profesional indicado no es valido.' })
  empleadoId!: string;

  @IsISO8601(
    { strict: true },
    { message: 'La fecha y hora de inicio debe ser una fecha ISO 8601.' },
  )
  inicio!: string;

  @IsOptional()
  @IsArray({ message: 'Los adicionales deben enviarse como una lista.' })
  @ArrayUnique({ message: 'Hay adicionales repetidos en la lista.' })
  @IsUUID(undefined, { each: true, message: 'Alguno de los adicionales no es valido.' })
  adicionalIds?: string[];

  /**
   * Reservar a nombre de otra persona. Solo ADMIN y EMPLEADO pueden usarlo; si lo
   * manda un CLIENTE se ignora y se usa el suyo. `registradaPorId` es siempre el
   * usuario del token, mande lo que mande. Ver spec/02.
   */
  @IsOptional()
  @IsUUID(undefined, { message: 'El cliente indicado no es valido.' })
  clienteId?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto.' })
  @MaxLength(2000, { message: 'Las notas no pueden pasar de 2000 caracteres.' })
  notas?: string;
}
