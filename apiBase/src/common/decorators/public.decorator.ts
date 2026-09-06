import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AUTH_OPCIONAL_KEY = 'authOpcional';

/**
 * La ruta se atiende con o sin token, pero si viene uno valido el usuario queda
 * disponible en `@CurrentUser()`.
 *
 * No es lo mismo que `@Public()`: aquel corta el guard de raiz, asi que un cliente
 * con sesion se atenderia como invitado y la cita se colgaria del usuario equivocado.
 * Es lo que necesita reservar, que acepta invitados sin dejar de reconocer al que entro.
 */
export const AuthOpcional = () => SetMetadata(AUTH_OPCIONAL_KEY, true);
