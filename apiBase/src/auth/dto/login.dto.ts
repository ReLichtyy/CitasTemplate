import { IsString, Matches, MaxLength } from 'class-validator';

/** bcrypt solo mira los primeros 72 bytes; aceptar mas es prometer una fuerza que no da. */
export const PASSWORD_MAX = 72;
export const PASSWORD_MIN = 8;

/**
 * El telefono no se valida contra un pais: el template se despliega donde sea. Solo se
 * exige la forma que `normalizarTelefono` sabe reducir a una sola representacion.
 */
export const TELEFONO_REGEX = /^\+?[\d\s()-]{7,20}$/;
export const TELEFONO_MENSAJE = 'El telefono no tiene un formato valido.';

export class LoginDto {
  @IsString()
  @Matches(TELEFONO_REGEX, { message: TELEFONO_MENSAJE })
  telefono!: string;

  // Sin `MinLength` aqui: el login no enseña las reglas de la contrasena, y una cuenta
  // vieja con una mas corta tiene que poder entrar.
  @IsString()
  @MaxLength(PASSWORD_MAX)
  password!: string;
}
