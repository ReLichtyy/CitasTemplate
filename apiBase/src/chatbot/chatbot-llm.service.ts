import { HttpException, Injectable, Logger } from '@nestjs/common';
import { EstadoConversacion } from '../generated/prisma/enums.js';
import { WhatsappGateway } from '../notificaciones/whatsapp.gateway.js';
import {
  AsistenteChat,
  type RespuestaAsistente,
} from './asistente.port.js';
import { CatalogoBotService } from './catalogo-bot.service.js';
import { ConversacionService } from './conversacion.service.js';
import {
  DESPEDIDA,
  ERROR_INESPERADO,
  HORARIO_OCUPADO,
  SIN_SERVICIOS,
  comprobante,
  esCancelar,
  nombreValido,
  type DatosConversacion,
  type MensajeDeChat,
  type OpcionDia,
  type ServicioDelMenu,
} from './flujo-reserva.js';
import { acotarHistorial, instruccionesDelAsistente } from './instrucciones.js';
import {
  MensajeEntrante,
  ProcesadorMensajes,
} from './mensajes.port.js';
import { ReservadorCitas } from './reservador-citas.port.js';

/**
 * El modo conversacional: el asistente LLM interpreta texto libre y decide el
 * paso, y este servicio es la valla. Todo lo que el modelo devuelve en `datos` se
 * valida contra el catalogo y los horarios reales de este turno antes de tocar la
 * base — el modelo no inventa disponibilidad, ni precios, ni citas: con `accion
 * "reservar"` y los cuatro datos validados, el alta es la misma `reservar` del
 * modo de menus y de la web.
 *
 * Sin `LLM_API_KEY` este servicio no se compone y el modulo cae al modo de menus
 * (`chatbot.service.ts`). Ver 11-chatbot-reservas.md.
 */
@Injectable()
export class ChatbotLlmService extends ProcesadorMensajes {
  private readonly logger = new Logger(ChatbotLlmService.name);

  constructor(
    private readonly conversaciones: ConversacionService,
    private readonly catalogo: CatalogoBotService,
    private readonly citas: ReservadorCitas,
    private readonly canal: WhatsappGateway,
    private readonly asistente: AsistenteChat,
  ) {
    super();
  }

  async procesar(mensaje: MensajeEntrante): Promise<void> {
    try {
      await this.atender(mensaje);
    } catch (error) {
      this.logger.error(
        `Fallo atendiendo el mensaje de ${mensaje.telefono}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.responder(mensaje, ERROR_INESPERADO);
    }
  }

  private async atender(mensaje: MensajeEntrante): Promise<void> {
    const conversacion = await this.conversaciones.cargar(mensaje.telefono);
    const texto = mensaje.texto.trim();

    // La salida de emergencia no pasa por el LLM: "cancelar" corta siempre, aun
    // con el asistente caido, y no gasta un turno del modelo.
    if (esCancelar(texto)) {
      if (conversacion) {
        await this.conversaciones.borrar(mensaje.telefono);
      }
      await this.responder(mensaje, DESPEDIDA);
      return;
    }

    const servicios = await this.catalogo.serviciosDelMenu();
    if (servicios.length === 0) {
      await this.responder(mensaje, SIN_SERVICIOS);
      return;
    }

    const previos = (conversacion?.datos ?? {}) as DatosConversacion;
    const historial = acotarHistorial([
      ...(previos.historial ?? []),
      { rol: 'usuario', texto },
    ]);

    const dias = await this.catalogo.diasPosibles();
    const horarios = await this.horariosPorDia(previos, dias);

    // Quien escribe decide la personalidad: el telefono del administrador recibe
    // el trato de colega y su agenda; el de un cliente, el flujo de reservas. La
    // verificacion es del servidor — el modelo solo recibe el resultado.
    const esAdmin = await this.catalogo.esAdministrador(mensaje.telefono);

    const respuesta = await this.asistente.conversar(
      instruccionesDelAsistente({
        negocio: await this.catalogo.nombreNegocio(),
        servicios,
        enCurso: this.sinHistorial(previos),
        horariosPorDia: horarios.map((dia) => dia.linea),
        hoy: dias[0].texto,
        esAdmin,
        agenda: esAdmin ? await this.catalogo.agendaDelDia() : '',
      }),
      historial,
    );

    const datos = this.validarYFusionar(respuesta, previos, servicios, horarios);

    if (respuesta.accion === 'cancelar') {
      await this.conversaciones.borrar(mensaje.telefono);
      await this.responder(mensaje, respuesta.respuesta);
      return;
    }

    if (respuesta.accion === 'reservar') {
      const faltantes = this.faltan(datos);
      if (faltantes.length > 0) {
        // El modelo pidio el alta sin los datos: su texto no se relee, porque
        // puede decir "listo, reservada" de una cita que no existe.
        await this.conversaciones.guardar(mensaje.telefono, EstadoConversacion.CONVERSANDO, {
          ...datos,
          historial,
        });
        await this.responder(
          mensaje,
          `Antes de confirmar me falta: ${faltantes.join(', ')}. ¿Me los confirma?`,
        );
        return;
      }
      await this.reservar(mensaje, datos, historial);
      return;
    }

    await this.conversaciones.guardar(mensaje.telefono, EstadoConversacion.CONVERSANDO, {
      ...datos,
      historial: acotarHistorial([
        ...historial,
        { rol: 'asistente', texto: respuesta.respuesta },
      ]),
    });
    await this.responder(mensaje, respuesta.respuesta);
  }

  /**
   * La valla. Lo que el modelo devuelve solo entra si coincide con lo que este
   * turno le mostro: el servicio contra el catalogo, el profesional contra los del
   * servicio, la hora contra los slots reales, el nombre contra las cotas del DTO.
   * Lo invalid se descarta y se registra — el proximo turno lo vuelve a pedir.
   */
  private validarYFusionar(
    respuesta: RespuestaAsistente,
    previos: DatosConversacion,
    servicios: ServicioDelMenu[],
    horarios: HorariosDelDia[],
  ): DatosConversacion {
    const propuestos = respuesta.datos ?? {};
    const datos = this.sinHistorial(previos);

    if (propuestos.servicioId !== undefined) {
      const servicio = servicios.find((s) => s.id === propuestos.servicioId);
      if (!servicio) {
        this.logger.warn(`El modelo propuso un servicio inexistente; se descarta.`);
      } else {
        datos.servicioId = servicio.id;
      }
    }

    const servicio = datos.servicioId
      ? servicios.find((s) => s.id === datos.servicioId)
      : undefined;

    if (propuestos.empleadoId !== undefined && servicio) {
      const profesional = servicio.profesionales.find(
        (p) => p.id === propuestos.empleadoId,
      );
      if (!profesional) {
        this.logger.warn(`El modelo propuso un profesional ajeno al servicio; se descarta.`);
      } else {
        datos.empleadoId = profesional.id;
      }
    }

    if (propuestos.inicio !== undefined) {
      const slot = horarios
        .flatMap((dia) => dia.slots)
        .find((slot) => slot.inicio === propuestos.inicio);
      if (!slot) {
        this.logger.warn(`El modelo propuso un horario que no estaba en el menu; se descarta.`);
      } else {
        datos.inicio = slot.inicio;
      }
    }

    if (propuestos.nombre !== undefined) {
      const nombre = nombreValido(propuestos.nombre);
      if (!nombre) {
        this.logger.warn(`El modelo propuso un nombre fuera de las cotas; se descarta.`);
      } else {
        datos.nombre = nombre;
      }
    }

    return datos;
  }

  /** El alta: el mismo camino del modo de menus y de la web. */
  private async reservar(
    mensaje: MensajeEntrante,
    datos: DatosConversacion,
    historial: MensajeDeChat[],
  ): Promise<void> {
    try {
      await this.citas.reservar({
        servicioId: datos.servicioId!,
        empleadoId: datos.empleadoId!,
        inicio: datos.inicio!,
        cliente: { telefono: mensaje.telefono, nombre: datos.nombre! },
      });
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 409) {
        await this.conversaciones.guardar(mensaje.telefono, EstadoConversacion.CONVERSANDO, {
          ...datos,
          inicio: undefined,
          historial,
        });
        await this.responder(mensaje, HORARIO_OCUPADO);
        return;
      }
      throw error;
    }

    await this.conversaciones.borrar(mensaje.telefono);

    const fecha = await this.catalogo.textoDelInstante(datos.inicio!);
    const nombres = await this.nombresElegidos(datos);
    await this.responder(
      mensaje,
      comprobante(datos.nombre!, fecha, nombres?.servicio, nombres?.profesional),
    );
  }

  /** Los horarios libres que se le muestran al modelo, solo con servicio y profesional. */
  private async horariosPorDia(
    datos: DatosConversacion,
    dias: OpcionDia[],
  ): Promise<HorariosDelDia[]> {
    if (!datos.servicioId || !datos.empleadoId) {
      return [];
    }

    const porDia: HorariosDelDia[] = [];
    for (const dia of dias) {
      const disponibilidad = await this.citas.disponibilidad({
        servicioId: datos.servicioId,
        empleadoId: datos.empleadoId,
        fecha: dia.fecha,
      });
      if (disponibilidad.slots.length === 0) {
        porDia.push({ linea: `${dia.texto}: sin horarios`, slots: [] });
        continue;
      }
      const horas = await Promise.all(
        disponibilidad.slots.map(async (slot) => {
          const hora = await this.catalogo.horaDelInstante(slot.inicio);
          return { inicio: slot.inicio, hora };
        }),
      );
      porDia.push({
        linea: `${dia.texto}: ${horas.map((h) => `${h.hora} (${h.inicio})`).join(', ')}`,
        slots: disponibilidad.slots,
      });
    }
    return porDia;
  }

  private faltan(datos: DatosConversacion): string[] {
    const faltantes: string[] = [];
    if (!datos.servicioId) faltantes.push('el servicio');
    if (!datos.empleadoId) faltantes.push('el profesional');
    if (!datos.inicio) faltantes.push('el dia y la hora');
    if (!datos.nombre) faltantes.push('el nombre');
    return faltantes;
  }

  private sinHistorial(datos: DatosConversacion): DatosConversacion {
    const { historial: _historial, ...resto } = datos;
    return resto;
  }

  private async nombresElegidos(datos: DatosConversacion): Promise<{
    servicio: string;
    profesional: string;
  } | null> {
    if (!datos.servicioId || !datos.empleadoId) {
      return null;
    }
    const servicios = await this.catalogo.serviciosDelMenu();
    const servicio = servicios.find((s) => s.id === datos.servicioId);
    const profesional = servicio?.profesionales.find(
      (p) => p.id === datos.empleadoId,
    );
    if (!servicio || !profesional) {
      return null;
    }
    return { servicio: servicio.nombre, profesional: profesional.nombre };
  }

  /**
   * La salida unica, igual que en el modo de menus: un fallo del canal no tumba
   * nada — la conversacion ya quedo guardada y el proximo mensaje del cliente
   * reencadena el flujo.
   */
  private async responder(mensaje: MensajeEntrante, texto: string): Promise<void> {
    try {
      await this.canal.enviarTexto(mensaje.destino, texto);
    } catch (error) {
      this.logger.warn(
        `No salio la respuesta para ${mensaje.telefono}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/** Un dia de horarios libres: la linea que ve el modelo y los slots para validar. */
interface HorariosDelDia {
  linea: string;
  slots: { inicio: string }[];
}
