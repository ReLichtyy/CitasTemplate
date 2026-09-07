import { SetMetadata } from '@nestjs/common';

export const LIMITE_INTENTOS_KEY = 'limiteIntentos';

export interface OpcionesLimiteIntentos {
  /** Peticiones permitidas por IP dentro de la ventana. */
  intentos: number;
  /** Largo de la ventana, en milisegundos. */
  ventanaMs: number;
}

/**
 * Limita cuantas veces una misma IP puede llamar a la ruta. Solo tiene efecto donde el
 * handler o el controlador lleve `@UseGuards(LimiteIntentosGuard)`.
 *
 * Se declara donde una peticion es barata para quien la manda y cara para el servidor —o
 * repetible hasta acertar—, que en la practica son las rutas abiertas de `auth`.
 */
export const LimiteIntentos = (opciones: OpcionesLimiteIntentos) =>
  SetMetadata<string, OpcionesLimiteIntentos>(LIMITE_INTENTOS_KEY, opciones);
