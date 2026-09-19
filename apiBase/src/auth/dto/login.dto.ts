import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  TELEFONO_MENSAJE,
  TELEFONO_REGEX,
  aTelefonoLocal,
} from '../../common/telefono.js';

/** bcrypt solo mira los primeros 72 bytes; aceptar mas es prometer una fuerza que no da. */
export const PASSWORD_MAX = 72;
export const PASSWORD_MIN = 8;

export { TELEFONO_MENSAJE, TELEFONO_REGEX } from '../../common/telefono.js';

/**
 * El telefono se guarda en forma local: 8 digitos. Se acepta tambien lo que trae
 * el prefijo nacional delante ("506...", "+506 ...") y se le quita antes del match,
 * que las cuentas existentes lo traian y quien ya lo escribia asi no choca de
 * frente con la regla nueva.
 */
export class LoginDto {
  @IsString()
  @Transform(aTelefonoLocal)
  @Matches(TELEFONO_REGEX, { message: TELEFONO_MENSAJE })
  telefono!: string;

  // Sin `MinLength` aqui: el login no enseña las reglas de la contrasena, y una cuenta
  // vieja con una mas corta tiene que poder entrar.
  @IsString()
  @MaxLength(PASSWORD_MAX)
  password!: string;
}
