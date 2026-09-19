/**
 * El telefono es la identidad del cliente y `Usuario.telefono` es unico, asi que
 * tiene que guardarse en una sola forma: la local, de 8 digitos y sin prefijo de
 * pais. "+506 8888-8888", "50688888888" y "8888 8888" son la misma persona, y en la
 * base solo puede vivir una de ellas. Todo lo que busque o cree un usuario por
 * telefono pasa por aqui.
 *
 * El prefijo "506" no lo guarda ninguna tabla: se lo antepone `aE164` al entregar
 * el numero a un canal externo, leyendolo de `ConfiguracionNegocio.prefijoPais`.
 */
export const TELEFONO_REGEX = /^\d{8}$/;
export const TELEFONO_MENSAJE = 'El telefono debe tener 8 digitos.';

export function normalizarTelefono(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  // "50688887777" y "+506 8888-8888" traen el prefijo nacional delante y dejan 11
  // digitos; el numero local son los ultimos 8. Un numero que ya son 8 digitos no
  // se toca, aunque empiece en "50": nadie escribe el prefijo dentro de su numero.
  return digitos.length === 11 && digitos.startsWith('506')
    ? digitos.slice(3)
    : digitos;
}

/**
 * `@Transform` de los DTO: reduce lo que llega a la forma canonica antes del
 * `@Matches(TELEFONO_REGEX)`. Asi "50688887777" entra igual que "8888 8888", y la
 * regla de los 8 digitos vive en un solo lugar.
 */
export function aTelefonoLocal({ value }: { value: unknown }): string {
  return normalizarTelefono(String(value));
}

/**
 * Forma internacional (E.164, con "+") de un telefono guardado en forma local. Es
 * lo que cualquier canal externo necesita: un "88887777" no se entrega a ningun
 * lado, y adivinarle el pais seria peor que no mandarlo.
 *
 * Devuelve `null` cuando no se puede construir, que es la senal de "esta cita no
 * recibe avisos" y no un error: la cita es el producto, el aviso es cortesia.
 * Ver 09-conexion-whatsapp.md.
 */
export function aE164(
  telefono: string,
  prefijoPais?: string | null,
): string | null {
  const local = normalizarTelefono(telefono);
  if (!TELEFONO_REGEX.test(local)) {
    return null;
  }

  const prefijo = prefijoPais ? normalizarTelefono(prefijoPais) : '';
  if (!prefijo) {
    return null;
  }

  return `+${prefijo}${local}`;
}
