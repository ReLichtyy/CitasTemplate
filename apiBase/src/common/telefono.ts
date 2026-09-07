/**
 * El telefono es la identidad del cliente y `Usuario.telefono` es unico, asi que
 * tiene que guardarse en una sola forma: sin normalizar, "+506 8888-8888" y
 * "50688888888" son dos personas distintas para la base y el mismo numero para
 * quien reserva. Todo lo que busque o cree un usuario por telefono pasa por aqui.
 *
 * Se conserva el "+" inicial porque distingue un numero internacional de uno local;
 * el resto de la puntuacion no aporta nada y se va.
 */
export function normalizarTelefono(telefono: string): string {
  const limpio = telefono.trim();
  const digitos = limpio.replace(/\D/g, '');
  return limpio.startsWith('+') ? `+${digitos}` : digitos;
}

/**
 * Forma internacional (E.164, con "+") de un telefono ya normalizado. Es lo que
 * cualquier canal externo necesita: un numero guardado en forma local — "88887777" —
 * no se entrega a ningun lado, y adivinarle el pais seria peor que no mandarlo.
 *
 * Devuelve `null` cuando no se puede construir, que es la senal de "esta cita no
 * recibe avisos" y no un error: la cita es el producto, el aviso es cortesia.
 * Ver 09-conexion-whatsapp.md.
 */
export function aE164(
  telefono: string,
  prefijoPais?: string | null,
): string | null {
  const normalizado = normalizarTelefono(telefono);

  if (normalizado.startsWith('+')) {
    return normalizado.length >= 9 ? normalizado : null;
  }

  const prefijo = prefijoPais ? normalizarTelefono(prefijoPais) : '';
  if (!prefijo.startsWith('+')) {
    return null;
  }

  const digitos = prefijo.slice(1);
  // Un numero que ya trae el prefijo pero sin "+" no se prefija dos veces.
  const local = normalizado.startsWith(digitos)
    ? normalizado.slice(digitos.length)
    : normalizado;

  return local.length >= 7 ? `+${digitos}${local}` : null;
}
