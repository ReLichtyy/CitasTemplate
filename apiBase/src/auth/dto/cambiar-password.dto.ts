import { IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN } from './login.dto.js';

/**
 * Cuerpo de `POST /auth/password`.
 *
 * Pide la contrasena **actual** y esa es toda la decision de diseno que faltaba
 * (`03-autorizacion.md`, "Lo que quedo fuera"): sin ella, una sesion robada —un token en
 * el `localStorage` de un equipo prestado— se convierte en la cuenta perdida, porque el
 * ladron cambia la clave y el dueno queda fuera. Con ella, robar el token da acceso
 * mientras el token viva, pero no la propiedad de la cuenta.
 *
 * `actual` no lleva `MinLength`: es una contrasena que ya existe, y una cuenta vieja puede
 * tener una mas corta que el minimo de hoy. El piso se aplica solo a la nueva.
 */
export class CambiarPasswordDto {
  @IsString()
  @MaxLength(PASSWORD_MAX)
  actual!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `La contrasena debe tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  nueva!: string;
}
