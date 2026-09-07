import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  TELEFONO_MENSAJE,
  TELEFONO_REGEX,
} from './login.dto.js';

/**
 * No lleva `rol`: el `ValidationPipe` corre con `whitelist`, asi que un `rol` en el cuerpo
 * se descarta antes de llegar al servicio. Aun asi el servicio lo fija a CLIENTE — la
 * defensa no depende de la configuracion de un pipe.
 */
export class RegistroDto {
  @IsString()
  @Matches(TELEFONO_REGEX, { message: TELEFONO_MENSAJE })
  telefono!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `La contrasena debe tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellido?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  @MaxLength(160)
  email?: string;
}
