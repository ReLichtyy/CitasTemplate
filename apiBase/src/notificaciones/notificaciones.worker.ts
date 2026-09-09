import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  EstadoNotificacion,
  type NotificacionSalida,
  type Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESPERA_MINUTOS } from './notificaciones.config.js';
import {
  CanalNoDisponibleError,
  EnvioPermanenteError,
  WhatsappGateway,
} from './whatsapp.gateway.js';

/** Nombre del sondeo en el registro de tareas. */
const NOMBRE_SONDEO = 'notificaciones-outbox';

/** Una fila ENVIANDO mas vieja que esto es un proceso que murio a mitad de envio. */
const MINUTOS_RECLAMO_VENCIDO = 10;

/**
 * Espera fija mientras el canal esta caido, en minutos. No es el retroceso exponencial
 * porque no hay nada que espaciar: el canal vuelve cuando alguien lo repara, y hasta
 * entonces todas las filas estan igual de bloqueadas.
 */
const ESPERA_CANAL_CAIDO = 5;

/**
 * Techo de la espera con el canal caido. Sin el, un aviso reintentaria para siempre
 * contra una sesion que nadie va a volver a parear. Un dia es de sobra: pasado eso, la
 * cita ya ocurrio o alguien llamo por telefono.
 */
const HORAS_MAX_CANAL_CAIDO = 24;

/**
 * Drena el outbox. Es el mismo binario que el API: `NOTIFICACIONES_WORKER=true`
 * decide si este proceso corre el cron. Dokploy despliega la misma imagen dos veces
 * con distinta configuracion. Ver 09-conexion-whatsapp.md.
 *
 * Que sea un despliegue aparte obliga a que el reclamo de trabajo sea atomico: dos
 * workers leyendo `WHERE estado = 'PENDIENTE'` a la vez mandan el mensaje dos veces.
 * De ahi el `FOR UPDATE SKIP LOCKED`, que existe en MariaDB desde 10.6 y el
 * despliegue esta fijado en 11.4.
 */
@Injectable()
export class NotificacionesWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificacionesWorker.name);
  /** Una pasada a la vez por proceso: el sondeo no espera a la anterior. */
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: WhatsappGateway,
    private readonly agenda: SchedulerRegistry,
  ) {}

  /**
   * El sondeo se registra a mano y no con `@Cron` porque el periodo sale de la
   * configuracion, y un decorador se evalua al cargar la clase, cuando todavia no hay
   * `ConfigService`. Un cron de un minuto tampoco podria bajar de ahi: es la unidad
   * mas pequeña que entiende la expresion.
   *
   * Solo se registra en el proceso que hace de worker. En los demas, este intervalo
   * seria una consulta cada pocos segundos para no reclamar nunca nada.
   */
  onModuleInit(): void {
    if (!this.config.get<boolean>('notificaciones.worker')) {
      return;
    }

    const cada = this.config.get<number>('notificaciones.intervaloMs') ?? 5000;

    // `addInterval` lanza si el nombre ya existe. Un segundo registro solo ocurre si
    // el modulo se reinicializa sin morir el proceso —recarga en caliente, o una
    // prueba que arranca el modulo dos veces—, y ahi conviene reemplazar el anterior
    // antes que tumbar el arranque.
    if (this.agenda.doesExist('interval', NOMBRE_SONDEO)) {
      this.agenda.deleteInterval(NOMBRE_SONDEO);
    }

    this.agenda.addInterval(
      NOMBRE_SONDEO,
      setInterval(() => void this.drenar(), cada),
    );
    this.logger.log(`Outbox: sondeo cada ${cada} ms.`);
  }

  /**
   * Drena ahora mismo, sin esperar al sondeo.
   *
   * Se llama **despues** de que la transaccion de la cita confirme: llamarlo dentro
   * dejaria al worker leyendo una fila que todavia no existe para nadie mas, no
   * encontraria nada, y el aviso volveria a esperar al siguiente tic.
   *
   * No se espera al resultado a proposito: quien reserva no puede quedarse colgado de
   * una llamada a WhatsApp. Si esta pasada falla, la fila sigue PENDIENTE y el sondeo
   * la recoge.
   */
  despertar(): void {
    if (!this.config.get<boolean>('notificaciones.worker') || this.corriendo) {
      return;
    }
    setImmediate(() => void this.drenar());
  }

  async drenar(): Promise<void> {
    if (!this.config.get<boolean>('notificaciones.worker') || this.corriendo) {
      return;
    }

    this.corriendo = true;
    try {
      await this.liberarReclamosVencidos();

      for (const fila of await this.reclamar()) {
        await this.enviarUna(fila);
      }
    } catch (error) {
      this.logger.error(`Fallo la pasada del outbox: ${this.mensaje(error)}`);
    } finally {
      this.corriendo = false;
    }
  }

  /**
   * El reclamo (`PENDIENTE → ENVIANDO`) va en una transaccion corta; el envio ocurre
   * despues, ya fuera. La llamada HTTP nunca entra en una transaccion.
   *
   * Devuelve las filas completas y no sus ids: leerlas una por una despues era una
   * consulta por mensaje, y el lote ya esta identificado aqui.
   */
  private async reclamar(): Promise<NotificacionSalida[]> {
    const lote = this.config.get<number>('notificaciones.lote') ?? 20;

    return this.prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM NotificacionSalida
        WHERE estado = 'PENDIENTE' AND proximoIntentoEn <= NOW(3)
        ORDER BY proximoIntentoEn
        LIMIT ${lote}
        FOR UPDATE SKIP LOCKED
      `;
      const ids = filas.map((fila) => fila.id);
      if (ids.length === 0) {
        return [];
      }

      await tx.notificacionSalida.updateMany({
        where: { id: { in: ids } },
        data: {
          estado: EstadoNotificacion.ENVIANDO,
          intentos: { increment: 1 },
          /**
           * Sella el instante del reclamo. Mientras la fila esta ENVIANDO,
           * `proximoIntentoEn` deja de significar "cuando toca reintentar" y pasa a
           * significar "desde cuando cuenta este reclamo", que es lo que mira
           * `liberarReclamosVencidos`.
           *
           * Sin esto, una fila con retraso —cola acumulada, o un reintento programado
           * hace una hora— se reclama con `proximoIntentoEn` ya vencido, y el barrido
           * de otro worker la devuelve a PENDIENTE mientras el primero todavia la esta
           * enviando: dos mensajes al mismo numero. El `SKIP LOCKED` no cubre eso,
           * porque el lock se suelta al cerrar la transaccion del reclamo.
           */
          proximoIntentoEn: new Date(),
        },
      });

      // Una sola consulta para el lote entero.
      return tx.notificacionSalida.findMany({ where: { id: { in: ids } } });
    });
  }

  private async enviarUna(fila: NotificacionSalida): Promise<void> {
    const id = fila.id;

    try {
      const { idExterno } = await this.gateway.enviar(
        fila.destino,
        fila.tipo,
        (fila.variables ?? {}) as Record<string, unknown>,
      );

      await this.prisma.notificacionSalida.update({
        where: { id },
        data: {
          estado: EstadoNotificacion.ENVIADA,
          enviadaEn: new Date(),
          idExterno,
          ultimoError: null,
          // El token del enlace deja de hacer falta en cuanto el mensaje salio. Se
          // borra para que en la base vuelva a quedar solo su hash, que es todo el
          // punto de guardarlo hasheado.
          variables: this.sinEnlace(fila.variables),
        },
      });
    } catch (error) {
      await this.tratarFallo(fila, error);
    }
  }

  /**
   * Las tres respuestas posibles a un envio fallido. Que sean tres y no una es la
   * diferencia entre una cola que se recupera sola y una que se vacia en FALLIDA cada
   * vez que la sesion de WhatsApp se cae media hora.
   */
  private async tratarFallo(
    fila: NotificacionSalida,
    error: unknown,
  ): Promise<void> {
    const motivo = this.mensaje(error);

    // El canal rechazo este mensaje: reintentar da exactamente lo mismo.
    if (error instanceof EnvioPermanenteError) {
      this.logger.warn(`Notificacion ${fila.id} no entregable: ${motivo}`);
      await this.prisma.notificacionSalida.update({
        where: { id: fila.id },
        data: {
          estado: EstadoNotificacion.FALLIDA,
          ultimoError: motivo,
        },
      });
      return;
    }

    // El canal entero esta caido: el mensaje no tiene la culpa y no paga el intento.
    if (error instanceof CanalNoDisponibleError) {
      await this.esperarAlCanal(fila, motivo);
      return;
    }

    await this.reprogramar(fila.id, fila.intentos, motivo);
  }

  /**
   * Devuelve la fila a la cola **descontando el intento** que el reclamo le sumo, para
   * que una caida del canal no consuma el presupuesto de reintentos del mensaje.
   *
   * El unico limite es la antiguedad: pasado `HORAS_MAX_CANAL_CAIDO` la fila muere,
   * porque un aviso que lleva un dia esperando ya no avisa de nada.
   */
  private async esperarAlCanal(
    fila: NotificacionSalida,
    motivo: string,
  ): Promise<void> {
    const antiguedadHoras =
      (Date.now() - fila.creadaEn.getTime()) / 3_600_000;

    if (antiguedadHoras >= HORAS_MAX_CANAL_CAIDO) {
      this.logger.error(
        `Notificacion ${fila.id} abandonada tras ${HORAS_MAX_CANAL_CAIDO}h sin canal: ${motivo}`,
      );
      await this.prisma.notificacionSalida.update({
        where: { id: fila.id },
        data: { estado: EstadoNotificacion.FALLIDA, ultimoError: motivo },
      });
      return;
    }

    this.logger.warn(`Canal no disponible, se reintenta sin gastar intento: ${motivo}`);
    await this.prisma.notificacionSalida.update({
      where: { id: fila.id },
      data: {
        estado: EstadoNotificacion.PENDIENTE,
        // `reclamar` ya lo incremento y `fila` se leyo despues, asi que este valor
        // viene sumado: hay que restarlo para que el intento no se cuente.
        intentos: Math.max(0, fila.intentos - 1),
        ultimoError: motivo,
        proximoIntentoEn: new Date(Date.now() + ESPERA_CANAL_CAIDO * 60_000),
      },
    });
  }

  /**
   * Retroceso exponencial sobre `proximoIntentoEn`. Al agotar los intentos, FALLIDA
   * — y una fila FALLIDA es visible para el personal, porque un aviso que no salio es
   * informacion operativa: alguien tiene que llamar por telefono.
   */
  private async reprogramar(
    id: string,
    intentos: number,
    error: string,
  ): Promise<void> {
    const maxIntentos =
      this.config.get<number>('notificaciones.maxIntentos') ?? 4;

    if (intentos >= maxIntentos) {
      this.logger.warn(`Notificacion ${id} agotada tras ${intentos}: ${error}`);
      await this.prisma.notificacionSalida.update({
        where: { id },
        data: { estado: EstadoNotificacion.FALLIDA, ultimoError: error },
      });
      return;
    }

    const espera =
      ESPERA_MINUTOS[Math.min(intentos, ESPERA_MINUTOS.length - 1)];
    await this.prisma.notificacionSalida.update({
      where: { id },
      data: {
        estado: EstadoNotificacion.PENDIENTE,
        ultimoError: error,
        proximoIntentoEn: new Date(Date.now() + espera * 60_000),
      },
    });
  }

  /**
   * Un proceso que muere despues de reclamar deja la fila en ENVIANDO para siempre.
   * Se devuelve a la cola: reintentar un mensaje que quiza salio es preferible a no
   * volver a mirarlo nunca, y el intento ya quedo contado.
   *
   * La ventana se mide contra el instante del **reclamo**, que es lo que `reclamar`
   * sella en `proximoIntentoEn`, y no contra la hora a la que el mensaje estaba
   * programado. Medirla contra la programacion soltaba filas que se estaban enviando
   * en ese momento.
   */
  private async liberarReclamosVencidos(): Promise<void> {
    const limite = new Date(Date.now() - MINUTOS_RECLAMO_VENCIDO * 60_000);
    const { count } = await this.prisma.notificacionSalida.updateMany({
      where: {
        estado: EstadoNotificacion.ENVIANDO,
        proximoIntentoEn: { lt: limite },
      },
      data: { estado: EstadoNotificacion.PENDIENTE },
    });
    if (count > 0) {
      this.logger.warn(`${count} envio(s) colgado(s) devuelto(s) a la cola.`);
    }
  }

  private sinEnlace(variables: Prisma.JsonValue): Prisma.InputJsonValue {
    if (
      typeof variables !== 'object' ||
      variables === null ||
      Array.isArray(variables)
    ) {
      return {};
    }
    const { enlace: _enlace, ...resto } = variables as Record<string, unknown>;
    return resto as Prisma.InputJsonValue;
  }

  /** Nunca sale al cliente; es para el log del personal. */
  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
