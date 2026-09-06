import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Quien reserva sin sesion. El telefono es la identidad del cliente en este producto
 * (decision cerrada en SPEC.md), asi que junto al nombre es lo unico que no
 * puede faltar.
 */
export class DatosClienteDto {
  @IsString({ message: 'El telefono debe ser texto.' })
  @Matches(/^\+?[\d\s()-]{7,20}$/, {
    message: 'El telefono no tiene un formato valido.',
  })
  telefono!: string;

  @IsString({ message: 'El nombre debe ser texto.' })
  @MinLength(2, { message: 'El nombre es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede pasar de 100 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'El apellido debe ser texto.' })
  @MaxLength(100, { message: 'El apellido no puede pasar de 100 caracteres.' })
  apellido?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  email?: string;
}

/**
 * Cuerpo de POST /citas.
 *
 * No lleva `fin` ni ningun importe a proposito: el servidor calcula
 * `fin = inicio + Servicio.duracionMinutos` y recalcula precio y total leyendo la
 * base. Lo que venga de mas lo descarta el ValidationPipe (whitelist). Ver 02-reservas-concurrencia.md.
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
  @IsUUID(undefined, {
    each: true,
    message: 'Alguno de los adicionales no es valido.',
  })
  adicionalIds?: string[];

  /**
   * Datos de quien reserva sin sesion. Obligatorio cuando la peticion no lleva token
   * —lo comprueba CitasService, porque depende de la peticion y no del cuerpo— e
   * ignorado cuando si lo lleva: ahi el cliente sale del token.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DatosClienteDto)
  cliente?: DatosClienteDto;

  /**
   * Reservar a nombre de otra persona ya registrada. Solo ADMIN y EMPLEADO pueden
   * usarlo; si lo manda un CLIENTE se ignora y se usa el suyo. `registradaPorId` es
   * siempre el usuario del token, mande lo que mande. Ver 02-reservas-concurrencia.md.
   */
  @IsOptional()
  @IsUUID(undefined, { message: 'El cliente indicado no es valido.' })
  clienteId?: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto.' })
  @MaxLength(2000, { message: 'Las notas no pueden pasar de 2000 caracteres.' })
  notas?: string;
}
