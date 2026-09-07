import type { ConfigService } from '@nestjs/config';

/** 256 bits en hexadecimal. Menos que esto y firmar HS256 deja de ser el eslabon fuerte. */
const LARGO_MINIMO = 32;

/**
 * `JWT_SECRET` sin valor por defecto, y con un piso de largo.
 *
 * El fallback anterior (`'dev-secret-change-me'`) estaba publicado en el repositorio: si la
 * variable faltaba en produccion, el API firmaba con un secreto conocido y cualquiera se
 * fabricaba un token de administrador. Una caida al arrancar es un incidente de cinco
 * minutos; un secreto por defecto es una brecha silenciosa. Ver 03-autorizacion.md.
 */
export function leerJwtSecret(config: ConfigService): string {
  const secreto = config.get<string>('JWT_SECRET');
  if (!secreto) {
    throw new Error('Falta JWT_SECRET. Ver apiBase/.env.example.');
  }
  if (secreto.length < LARGO_MINIMO) {
    throw new Error(
      `JWT_SECRET debe tener al menos ${LARGO_MINIMO} caracteres. Genere uno con: openssl rand -hex 32`,
    );
  }
  return secreto;
}
