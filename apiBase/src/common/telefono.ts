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
