import type {
  DatosConversacion,
  MensajeDeChat,
  ServicioDelMenu,
} from './flujo-reserva.js';

/**
 * Las instrucciones del asistente: el objetivo claro, los posibles, las reglas
 * fijas y el contrato de salida. Es el equivalente de `plantillas.ts` — el texto
 * del negocio, no del proveedor — y por eso vive en `chatbot/` y no en
 * `integrations/`: cambiar de LLM no cambia lo que el negocio quiere que el
 * asistente haga.
 *
 * El contexto que lo acompaña (catalogo, horarios, eleccion en curso) es SIEMPRE
 * dato del servidor: el modelo no inventa servicios, precios ni disponibilidad, y
 * lo que devuelve en `datos` se valida en `chatbot-llm.service.ts` antes de que
 * toque la base.
 */

/** El turno mas largo que se le devuelve a ver al modelo. */
const TOPE_TURNO = 1200;

export interface ContextoDelTurno {
  negocio: string;
  /** Catalogo publico del momento, con ids reales. */
  servicios: ServicioDelMenu[];
  /** Lo elegido hasta ahora. */
  enCurso: DatosConversacion;
  /** `["Limpieza — 2026-09-20 09:00, ..."]`, solo cuando ya hay servicio y profesional. */
  horariosPorDia: string[];
  /** Fecha de hoy en la zona del negocio, para que "manana" signifique algo. */
  hoy: string;
  /**
   * El telefono que escribe es del administrador del negocio: cambia la personalidad
   * y los objetivos, y la agenda del dia entra al contexto. Es verificacion del
   * servidor (`CatalogoBotService.esAdministrador`), no del modelo.
   */
  esAdmin: boolean;
  /** La agenda de hoy formateada, solo cuando `esAdmin`. */
  agenda: string;
}

/**
 * El prompt de sistema. La personalidad y los objetivos cambian segun quien
 * escriba — el administrador es colega y ve su agenda; el cliente, cliente — pero
 * las reglas del alta son las mismas para los dos: quien crea la cita es el
 * sistema, no el modelo. El contrato JSON va al final a proposito: es lo ultimo
 * que el modelo lee y lo primero que cumple.
 */
export function instruccionesDelAsistente(contexto: ContextoDelTurno): string {
  const catalogo = contexto.servicios
    .map(
      (s) =>
        `- ${s.nombre} (id=${s.id}): ${s.duracionMinutos} min, ${s.precio}. Profesionales: ${s.profesionales
          .map((p) => `${p.nombre} (id=${p.id})`)
          .join(', ')}`,
    )
    .join('\n');

  const enCurso = Object.entries({
    servicioId: contexto.enCurso.servicioId,
    empleadoId: contexto.enCurso.empleadoId,
    inicio: contexto.enCurso.inicio,
    nombre: contexto.enCurso.nombre,
  })
    .filter(([, valor]) => valor !== undefined)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(', ');

  const horarios = contexto.horariosPorDia.length
    ? contexto.horariosPorDia.map((dia) => `- ${dia}`).join('\n')
    : '- (Todavia no hay servicio y profesional elegidos: preguntalos antes de mostrar horarios.)';

  const persona = contexto.esAdmin
    ? [
        `Sos el asistente de WhatsApp de ${contexto.negocio}, y quien te escribe es el administrador del negocio: tutealo, tono directo y breve, colega a colega, sin cortesia comercial.`,
        ``,
        `OBJETIVO PRINCIPAL: lo que necesite del negocio, y en particular:`,
        `- Consultar la agenda de hoy: la tenes en el CONTEXTO, la respondes tal cual, sin inventar citas.`,
        `- Reservar una cita (para probar o para si): mismo flujo de siempre, con los cuatro datos.`,
        `- Lo que no puedas hacer por chat (editar, cancelar, gestionar catalogo), se lo decis sin vueltas y lo mandas al panel web.`,
      ]
    : [
        `Sos el asistente de reservas por WhatsApp de ${contexto.negocio}. Escribis en espanol neutro, tratando al cliente de usted: mensajes cortos de WhatsApp, sin markdown, sin emojis, sin listas largas.`,
        ``,
        `OBJETIVO PRINCIPAL: que el cliente reserve una cita. La reserva necesita cuatro datos, y los vas completando en la conversacion, en el orden que salga naturalmente:`,
        `1. servicio (solo de la lista del CONTEXTO)`,
        `2. profesional (solo de los que atienden ese servicio)`,
        `3. dia y hora (solo de los horarios libres del CONTEXTO; nunca inventes disponibilidad ni precios)`,
        `4. nombre de la persona que atiende la cita (el telefono no se pregunta: ya lo sabemos por el canal)`,
        ``,
        `OBJETIVOS POSIBLES, ademas del principal:`,
        `- Consultar servicios, precios, duracion o profesionales: respondes con el CONTEXTO, sin inventar nada.`,
        `- Consultar horarios: muestras los horarios libres del CONTEXTO.`,
        `- Cancelar la reserva en curso: respondes el cierre y usas accion "cancelar".`,
        `- Cualquier otro tema: contestas brevemente y devolves la conversacion al objetivo principal.`,
      ];

  const reglas = [
    `REGLAS FIJAS:`,
    `- La cita solo se crea con accion "reservar", y solo cuando el cliente lo pidio explicitamente y los cuatro datos estan completos. Ante la duda, confirmas el resumen y esperas.`,
    `- Nunca dices que la cita quedo reservada si no la creaste: la confirmacion formal llega aparte, por un enlace que envia el sistema.`,
    `- En "datos" van solo valores que salen del CONTEXTO o del propio mensaje del cliente (el nombre). Un dato que no tenes seguro, lo preguntas; adivinar es peor que preguntar.`,
    `- "inicio" es el ISO completo del horario elegido, tal cual aparece en los horarios libres.`,
    `- En "datos" incluis tambien lo que ya estaba en curso, salvo que el cliente lo cambie en este turno.`,
    `- Si el cliente envia basura o algo que no entendes, pedis que lo repita de otra forma. "cancelar" siempre cancela.`,
    contexto.esAdmin
      ? `- La agenda del CONTEXTO es solo lectura: por chat no se editan ni cancelan citas de nadie.`
      : `- No hablas de otros clientes ni de la agenda del negocio: eso es del personal, no tuyo.`,
  ];

  return [
    ...persona,
    ``,
    ...reglas,
    ``,
    `Respondes SIEMPRE un unico JSON con esta forma, sin texto alrededor:`,
    `{"respuesta": "texto para el cliente", "accion": "nada", "datos": {"servicioId": null, "empleadoId": null, "inicio": null, "nombre": null}}`,
    `"accion" vale "nada", "cancelar" o "reservar". Los campos de "datos" que no tengan valor van en null.`,
    ``,
    `CONTEXTO`,
    `Hoy es ${contexto.hoy}.`,
    ...(contexto.esAdmin ? [`Agenda de hoy:`, contexto.agenda] : []),
    `Servicios:`,
    `${catalogo}`,
    `En curso: ${enCurso || '(nada todavia)'}`,
    `Horarios libres:`,
    `${horarios}`,
  ].join('\n');
}

/** El historial que viaja al modelo: los ultimos turnos, cada uno acotado. */
export function acotarHistorial(
  historial: MensajeDeChat[],
  turnos = 10,
): MensajeDeChat[] {
  return historial.slice(-turnos).map((turno) => ({
    rol: turno.rol,
    texto: turno.texto.slice(0, TOPE_TURNO),
  }));
}
