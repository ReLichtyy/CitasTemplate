import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { aTelefonoLocal } from '../../common/telefono.js';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  TELEFONO_MENSAJE,
  TELEFONO_REGEX,
} from '../../auth/dto/login.dto.js';

/**
 * Cuerpo de `POST /empleados`: la ficha laboral **y** la cuenta de acceso.
 *
 * Un `Empleado` no existe sin su `Usuario` (la llave es `usuarioId`), asi que darlo de alta
 * es crear las dos cosas. La contrasena es opcional a proposito: sin ella la ficha queda
 * como la de un invitado, y el propio empleado la reclama despues registrandose con su
 * telefono — ese flujo ya conserva el rol EMPLEADO (ver `AuthService.registro`). Es el
 * mismo camino que sigue un cliente, sin crear uno nuevo solo para el personal.
 */
export class CrearEmpleadoDto {
  @IsString({ message: 'El telefono debe ser texto.' })
  @Transform(aTelefonoLocal)
  @Matches(TELEFONO_REGEX, { message: TELEFONO_MENSAJE })
  telefono!: string;

  @IsString({ message: 'El nombre debe ser texto.' })
  @MinLength(2, { message: 'El nombre es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede pasar de 100 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'El apellido debe ser texto.' })
  @MaxLength(100, { message: 'El apellido no puede pasar de 100 caracteres.' })
  apellido?: string;

  /** Contrasena inicial. Sin ella, la ficha se reclama desde el registro. */
  @IsOptional()
  @IsString({ message: 'La contrasena debe ser texto.' })
  @MinLength(PASSWORD_MIN, {
    message: `La contrasena debe tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  password?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  @MaxLength(160, { message: 'El correo no puede pasar de 160 caracteres.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'La bio debe ser texto.' })
  @MaxLength(2000, { message: 'La bio no puede pasar de 2000 caracteres.' })
  bio?: string;

  @IsOptional()
  @IsUrl({}, { message: 'La foto debe ser una URL valida.' })
  @MaxLength(500, { message: 'La URL de la foto es demasiado larga.' })
  fotoUrl?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'La especialidad indicada no es valida.' })
  especialidadId?: string;

  /** Que atiende. La lista completa: el `PATCH` reemplaza con `set`, igual que en servicios. */
  @IsOptional()
  @IsArray({ message: 'Los servicios deben enviarse como una lista.' })
  @ArrayUnique({ message: 'Hay servicios repetidos en la lista.' })
  @IsUUID(undefined, { each: true, message: 'Alguno de los servicios no es valido.' })
  servicioIds?: string[];
}
