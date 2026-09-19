import { HttpException, Injectable, Logger } from '@nestjs/common';
import { EstadoConversacion } from '../generated/prisma/enums.js';
import { WhatsappGateway } from '../notificaciones/whatsapp.gateway.js';
import { CatalogoBotService } from './catalogo-bot.service.js';
import { ConversacionService } from './conversacion.service.js';
import {
  DESPEDIDA,
  ERROR_INESPERADO,
  NOMBRE_INVALIDO,
  PEDIR_NOMBRE,
  SIN_SERVICIOS,
  comprobante,
  esCancelar,
  menuDias,
  menuHoras,
  menuProfesionales,
  menuServicios,
  nombreValido,
  opcion,
  resumen,
  saludo,
  sinHoras,
  type DatosConversacion,
} from './flujo-reserva.js';
import {
  MensajeEntrante,
  ProcesadorMensajes,
} from './mensajes.port.js';
import { ReservadorCitas } from './reservador-citas.port.js';

/**
 * La maquina de estados de la reserva por WhatsApp. Cada mensaje entra por
 * `procesar`, se resuelve contra la fila de la conversacion y sale una o ninguna
 * respuesta por el gateway. Nada aqui sabe que existe WAHA.
 *
 * Lo que la maquina no hace: confirmar citas por texto (eso es el enlace firmado,
 * ver 09), parsear texto libre (todo son opciones numeradas) ni preguntar el
 * telefono (lo trae el canal). Ver 11-chatbot-reservas.md.
 */
@Injectable()
export class ChatbotService extends ProcesadorMensajes {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly conversaciones: ConversacionService,
    private readonly catalogo: CatalogoBotService,
    private readonly citas: ReservadorCitas,
    private readonly canal: WhatsappGateway,
  ) {
    super();
  }

  async procesar(mensaje: MensajeEntrante): Promise<void> {
    try {
      await this.atender(mensaje);
    } catch (error) {
      /**
       * Nada de lo que falle aqui debe llegar al webhook: un 500 lo reintentaria
       * WAHA contra un evento que ya quedo registrado en `EventoWebhook`, y el
       * reintento se descarta por id — quedaria solo el ruido. Se registra fuerte
       * y se intenta una disculpa; si el canal tambien fallo, el cliente la
       * provoca con su proximo mensaje.
       */
      this.logger.error(
        `Fallo atendiendo el mensaje de ${mensaje.telefono}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.responder(mensaje, ERROR_INESPERADO);
    }
  }

  private async atender(mensaje: MensajeEntrante): Promise<void> {
    const conversacion = await this.conversaciones.cargar(mensaje.telefono);
    const texto = mensaje.texto.trim();

    if (esCancelar(texto)) {
      if (conversacion) {
        await this.conversaciones.borrar(mensaje.telefono);
      }
      await this.responder(mensaje, DESPEDIDA);
      return;
    }

    if (!conversacion) {
      await this.iniciar(mensaje);
      return;
    }

    const datos = (conversacion.datos ?? {}) as DatosConversacion;
    switch (conversacion.estado) {
      case EstadoConversacion.ELIGIENDO_SERVICIO:
        return this.elegirServicio(mensaje, texto, datos);
      case EstadoConversacion.ELIGIENDO_PROFESIONAL:
        return this.elegirProfesional(mensaje, texto, datos);
      case EstadoConversacion.ELIGIENDO_DIA:
        return this.elegirDia(mensaje, texto, datos);
      case EstadoConversacion.ELIGIENDO_HORA:
        return this.elegirHora(mensaje, texto, datos);
      case EstadoConversacion.PIDIENDO_NOMBRE:
        return this.pedirNombre(mensaje, texto, datos);
      case EstadoConversacion.CONFIRMANDO:
        return this.confirmar(mensaje, texto, datos);
    }
  }

  private async iniciar(mensaje: MensajeEntrante): Promise<void> {
    const servicios = await this.catalogo.serviciosDelMenu();
    if (servicios.length === 0) {
      await this.responder(mensaje, SIN_SERVICIOS);
      return;
    }

    const negocio = await this.catalogo.nombreNegocio();
    await this.conversaciones.guardar(
      mensaje.telefono,
      EstadoConversacion.ELIGIENDO_SERVICIO,
      {},
    );
    await this.responder(mensaje, saludo(negocio, servicios));
  }

  private async elegirServicio(
    mensaje: MensajeEntrante,
    texto: string,
    datos: DatosConversacion,
  ): Promise<void> {
    const servicios = await this.catalogo.serviciosDelMenu();
    const elegido = this.opcionDeLista(servicios, texto);

    if (!elegido) {
      await this.responder(mensaje, menuServicios(servicios));
      return;
    }

    const base = { ...datos, servicioId: elegido.id };

    // Un solo profesional no es una pregunta: se asigna y se avanza al dia.
    if (elegido.profesionales.length === 1) {
      await this.conversaciones.guardar(mensaje.telefono, EstadoConversacion.ELIGIENDO_DIA, {
        ...base,
        empleadoId: elegido.profesionales[0].id,
      });
    } else {
      await this.conversaciones.guardar(
        mensaje.telefono,
        EstadoConversacion.ELIGIENDO_PROFESIONAL,
        base,
      );
      await this.responder(mensaje, menuProfesionales(elegido.profesionales));
      return;
    }

    await this.ofrecerDias(mensaje);
  }

  private async elegirProfesional(
    mensaje: MensajeEntrante,
    texto: string,
    datos: DatosConversacion,
  ): Promise<void> {
    // El catalogo puede cambiar en plena conversacion: el servicio elegido ya no
    // esta, o ya no tiene profesionales. No hay forma honesta de seguir con una
    // eleccion que desaparecio — se empieza de cero.
    if (!datos.servicioId) {
      return this.iniciar(mensaje);
    }
    const servicios = await this.catalogo.serviciosDelMenu();
    const servicio = servicios.find((s) => s.id === datos.servicioId);
    if (!servicio || servicio.profesionales.length === 0) {
      return this.iniciar(mensaje);
    }

    const elegido = this.opcionDeLista(servicio.profesionales, texto);
    if (!elegido) {
      await this.responder(mensaje, menuProfesionales(servicio.profesionales));
      return;
    }

    await this.conversaciones.guardar(mensaje.telefono, EstadoConversacion.ELIGIENDO_DIA, {
      ...datos,
      empleadoId: elegido.id,
    });
    await this.ofrecerDias(mensaje);
  }

  private async elegirDia(
    mensaje: MensajeEntrante,
    texto: string,
    datos: DatosConversacion,
  ): Promise<void> {
    if (!datos.servicioId || !datos.empleadoId) {
      return this.iniciar(mensaje);
    }
    const dias = await this.catalogo.diasPosibles();
    const dia = this.opcionDeLista(dias, texto);

    if (!dia) {
      await this.responder(mensaje, menuDias(dias));
      return;
    }

    await this.conversaciones.guardar(mensaje.telefono, EstadoConversacion.ELIGIENDO_HORA, {
      ...datos,
      fecha: dia.fecha,
    });
    await this.ofrecerHoras(mensaje, { ...datos, fecha: dia.fecha });
  }

  private async elegirHora(
    mensaje: MensajeEntrante,
    texto: string,
    datos: DatosConversacion,
  ): Promise<void> {
    if (!datos.servicioId || !datos.empleadoId || !datos.fecha) {
      return this.iniciar(mensaje);
    }

    const disponibilidad = await this.citas.disponibilidad({
      servicioId: datos.servicioId,
      empleadoId: datos.empleadoId,
      fecha: datos.fecha,
    });
    const slot = this.opcionDeLista(disponibilidad.slots, texto);

    if (!slot) {
      // El menu que vio el cliente ya cambio (alguien tomo el hueco): se re-muestra
      // fresco. `ofrecerHoras` se encarga tambien del caso sin huecos.
      return this.ofrecerHoras(mensaje, datos);
    }

    await this.conversaciones.guardar(mensaje.telefono, EstadoConversacion.PIDIENDO_NOMBRE, {
      ...datos,
      inicio: slot.inicio,
    });
    await this.responder(mensaje, PEDIR_NOMBRE);
  }

  private async pedirNombre(
    mensaje: MensajeEntrante,
    texto: string,
    datos: DatosConversacion,
  ): Promise<void> {
    const nombre = nombreValido(texto);
    if (!nombre) {
      await this.responder(mensaje, NOMBRE_INVALIDO);
      return;
    }

    await this.conversaciones.guardar(mensaje.telefono, EstadoConversacion.CONFIRMANDO, {
      ...datos,
      nombre,
    });
    const resumen = await this.armarResumen(mensaje, { ...datos, nombre });
    if (resumen !== null) {
      await this.responder(mensaje, resumen);
    }
  }

  private async confirmar(
    mensaje: MensajeEntrante,
    texto: string,
    datos: DatosConversacion,
  ): Promise<void> {
    if (texto === '1') {
      return this.reservar(mensaje, datos);
    }
    if (texto === '2') {
      await this.conversaciones.borrar(mensaje.telefono);
      await this.responder(mensaje, DESPEDIDA);
      return;
    }
    const resumen = await this.armarResumen(mensaje, datos);
    if (resumen !== null) {
      await this.responder(mensaje, resumen);
    }
  }

  /**
   * El alta. El 409 de `reservar` es el unico mensaje redactado para el usuario
   * final — se relee tal cual y se re-ofrecen horarios. Todo lo demas es
   * ERROR_INESPERADO por el camino comun, y la conversacion queda en CONFIRMANDO:
   * el "1" reintenta sin perder nada de lo elegido.
   */
  private async reservar(
    mensaje: MensajeEntrante,
    datos: DatosConversacion,
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
        await this.conversaciones.guardar(
          mensaje.telefono,
          EstadoConversacion.ELIGIENDO_HORA,
          datos,
        );
        await this.ofrecerHoras(mensaje, datos, `${error.message}\n\n`);
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

  /** El menu de dias, ya guardado el estado que lo escucha. */
  private async ofrecerDias(mensaje: MensajeEntrante): Promise<void> {
    await this.responder(mensaje, menuDias(await this.catalogo.diasPosibles()));
  }

  /**
   * El menu de horas del dia fijado. Sin huecos, la conversacion vuelve al dia:
   * elegir una fecha imposible solo gasta turnos.
   */
  private async ofrecerHoras(
    mensaje: MensajeEntrante,
    datos: DatosConversacion,
    prefijo = '',
  ): Promise<void> {
    const disponibilidad = await this.citas.disponibilidad({
      servicioId: datos.servicioId!,
      empleadoId: datos.empleadoId!,
      fecha: datos.fecha!,
    });

    if (disponibilidad.slots.length === 0) {
      await this.conversaciones.guardar(
        mensaje.telefono,
        EstadoConversacion.ELIGIENDO_DIA,
        datos,
      );
      await this.responder(mensaje, prefijo + sinHoras(await this.catalogo.diasPosibles()));
      return;
    }

    const dia = await this.catalogo.textoDelDia(datos.fecha!);
    const horas = await Promise.all(
      disponibilidad.slots.map((slot) => this.catalogo.horaDelInstante(slot.inicio)),
    );
    await this.responder(mensaje, prefijo + menuHoras(dia, horas));
  }

  /**
   * El resumen de confirmacion, o `null` cuando el catalogo ya no tiene lo elegido
   * — en ese caso la conversacion ya se reinicio con su saludo, y no hay nada que
   * mandar aqui. Mostrar un resumen con otra cosa adentro seria peor.
   */
  private async armarResumen(
    mensaje: MensajeEntrante,
    datos: DatosConversacion,
  ): Promise<string | null> {
    const nombres = await this.nombresElegidos(datos);
    if (!nombres || !datos.inicio || !datos.nombre) {
      await this.iniciar(mensaje);
      return null;
    }
    return resumen({
      servicio: nombres.servicio,
      profesional: nombres.profesional,
      fecha: await this.catalogo.textoDelInstante(datos.inicio),
      nombre: datos.nombre,
    });
  }

  /** Los nombres de servicio y profesional de la eleccion en curso, o null. */
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

  /** Opcion `n`-esima de la lista, o undefined: la respuesta valida contra lo fresco. */
  private opcionDeLista<T>(lista: T[], texto: string): T | undefined {
    const n = opcion(texto);
    return n && n <= lista.length ? lista[n - 1] : undefined;
  }

  /**
   * La salida unica. Un fallo del canal se traga a proposito: la conversacion ya
   * avanzo y esta guardada — el proximo mensaje del cliente reencadena el flujo,
   * que es el reintento natural de una conversacion.
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
