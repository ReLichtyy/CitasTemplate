/**
 * El flujo de reserva puro: tipos de datos, parseo de respuestas y textos de los
 * menus. Nada aqui toca la base, el canal ni el catalogo — `chatbot.service.ts`
 * orquesta las lecturas y este archivo decide que se contesta. Asi la maquina se
 * prueba unitaria sin base de datos y sin WhatsApp.
 *
 * La regla que ordena todo: no se parsea texto libre (ver 11-chatbot-reservas.md,
 * decision 3). Cada paso ofrece opciones numeradas; lo unico libre es el nombre,
 * con las mismas cotas del DTO de la web.
 */

/** Un dia del menu, ya resuelto en la zona del negocio. */
export interface OpcionDia {
  etiqueta: 'Hoy' | 'Mañana' | 'Pasado mañana';
  /** `YYYY-MM-DD`, la forma que `disponibilidad` espera. */
  fecha: string;
  /** "miércoles 17 de septiembre", ya formateado con el locale del negocio. */
  texto: string;
}

/** Un profesional del menu: solo lo que el menu necesita. */
export interface ProfesionalDelMenu {
  id: string;
  /** Nombre y apellido ya unidos. */
  nombre: string;
}

/** Un servicio del menu, ya formateado para listar. */
export interface ServicioDelMenu {
  id: string;
  nombre: string;
  duracionMinutos: number;
  /** Precio ya formateado con la moneda del negocio; nunca un numero crudo. */
  precio: string;
  profesionales: ProfesionalDelMenu[];
}

/**
 * Un turno de la conversacion con el asistente. El historial que viaja al LLM y
 * vuelve a la fila `datos` es el mismo tipo: no hay dos formas de lo mismo.
 */
export interface MensajeDeChat {
  rol: 'usuario' | 'asistente';
  texto: string;
}

/**
 * Lo recogido hasta ahora: la columna `datos` de `ConversacionChatbot`. Es un type
 * alias a proposito: tiene que entrar en el `Json` de Prisma sin pelearse con
 * `InputJsonValue`, y las interfaces no llevan firma de indice implicita.
 */
export type DatosConversacion = {
  servicioId?: string;
  empleadoId?: string;
  /** `YYYY-MM-DD` elegido, en la zona del negocio. */
  fecha?: string;
  /** ISO del slot elegido. */
  inicio?: string;
  nombre?: string;
  /** Solo lo usa el modo LLM: los ultimos turnos, acotados, para dar contexto. */
  historial?: MensajeDeChat[];
};

/**
 * Entero elegible como opcion de menu. "1", " 2 " valen; "1.", "uno" o "03" no:
 * aceptar mas variantes es reabrir el parseo de texto libre por la ventana.
 */
export function opcion(texto: string): number | undefined {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) {
    return undefined;
  }
  const n = Number(limpio);
  return n >= 1 ? n : undefined;
}

/** "cancelar" o "salir", en cualquier paso. Mayusculas y espacios de sobra no cuentan. */
export function esCancelar(texto: string): boolean {
  return /^(cancelar|salir)\.?$/.test(texto.trim().toLowerCase());
}

/**
 * El unico texto libre del flujo, con las cotas del DTO de la web (2-100). Los
 * espacios doblados se normalizan: la fila de `Usuario` guarda una sola forma.
 */
export function nombreValido(texto: string): string | undefined {
  const nombre = texto.trim().replace(/\s+/g, ' ');
  return nombre.length >= 2 && nombre.length <= 100 ? nombre : undefined;
}

export const DESPEDIDA =
  'Listo, cancelé lo que estaba haciendo. Cuando quiera reservar, escríbame.';

export const SIN_SERVICIOS =
  'Ahora mismo no tengo servicios para ofrecerle. Inténtelo más tarde.';

export const PEDIR_NOMBRE =
  '¿A nombre de quién reservo la cita? (nombre y apellido)';

export const NOMBRE_INVALIDO =
  'Necesito un nombre de al menos 2 letras para reservar a su nombre.';

export const ERROR_INESPERADO =
  'No pude terminar la operación en este momento. Inténtelo de nuevo en un rato o escriba "cancelar" para salir.';

/**
 * El hueco se lo llevo otro entre la respuesta del asistente y el alta: se suelta
 * la hora elegida y se le devuelve la pregunta al cliente, con la lista fresca en
 * el proximo turno.
 */
export const HORARIO_OCUPADO =
  'Ese horario acaba de tomarse. ¿Le sirve alguno de los otros que le mostré?';;

export function saludo(negocio: string, servicios: ServicioDelMenu[]): string {
  return [
    `Hola! Soy el asistente de reservas de ${negocio}.`,
    '',
    'Responda con el número de la opción. Escriba "cancelar" en cualquier momento para salir.',
    '',
    menuServicios(servicios),
  ].join('\n');
}

export function menuServicios(servicios: ServicioDelMenu[]): string {
  const opciones = servicios
    .map((s, i) => `${i + 1}. ${s.nombre} — ${s.duracionMinutos} min — ${s.precio}`)
    .join('\n');
  return `¿Qué servicio desea reservar?\n\n${opciones}`;
}

export function menuProfesionales(
  profesionales: ProfesionalDelMenu[],
): string {
  const opciones = profesionales
    .map((p, i) => `${i + 1}. ${p.nombre}`)
    .join('\n');
  return `¿Con qué profesional?\n\n${opciones}`;
}

export function menuDias(dias: OpcionDia[]): string {
  const opciones = dias
    .map((d, i) => `${i + 1}. ${d.etiqueta}, ${d.texto}`)
    .join('\n');
  return `¿Qué día?\n\n${opciones}`;
}

/** El dia ya viene como texto ("el viernes 19 de septiembre") y las horas formateadas. */
export function menuHoras(dia: string, horas: string[]): string {
  const opciones = horas.map((h, i) => `${i + 1}. ${h}`).join('\n');
  return `Horarios libres para el ${dia}:\n\n${opciones}`;
}

/** Dia sin huecos: se vuelve al menu de dias en el mismo mensaje. */
export function sinHoras(dias: OpcionDia[]): string {
  return `Ese día no tiene horarios libres.\n\n${menuDias(dias)}`;
}

export interface ResumenConfirmacion {
  servicio: string;
  profesional: string;
  /** Fecha completa con hora, ya formateada en la zona y locale del negocio. */
  fecha: string;
  nombre: string;
}

export function resumen(datos: ResumenConfirmacion): string {
  return [
    'Confirme su reserva:',
    '',
    `📅 ${datos.servicio} con ${datos.profesional}`,
    `🕒 ${datos.fecha}`,
    `A nombre de ${datos.nombre}`,
    '',
    '1. Confirmar',
    '2. Cancelar',
  ].join('\n');
}

/**
 * El comprobante del bot. El aviso formal —con el enlace firmado— sale igual por el
 * outbox como en la reserva web; este mensaje solo cierra la conversacion.
 *
 * Servicio y profesional son opcionales porque el catalogo puede retirarlos entre
 * la confirmacion y la lectura: la fecha y el nombre nunca faltan.
 */
export function comprobante(
  nombre: string,
  fecha: string,
  servicio?: string,
  profesional?: string,
): string {
  const detalle =
    servicio && profesional
      ? `📅 ${servicio} con ${profesional}\n🕒 ${fecha}\n\n`
      : `🕒 ${fecha}\n\n`;
  return [
    '✅ Cita reservada',
    '',
    `Hola ${nombre}, su cita quedó reservada.`,
    '',
    detalle,
    'Le llega un mensaje aparte con el enlace para confirmarla.',
  ].join('\n');
}
