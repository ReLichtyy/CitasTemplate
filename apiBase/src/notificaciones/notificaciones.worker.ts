import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EstadoNotificacion, type Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESPERA_MINUTOS } from './notificaciones.config.js';
import { WhatsappGateway } from './whatsapp.gateway.js';

/** Una fila ENVIANDO mas vieja que esto es un proceso que murio a mitad de envio. */
const MINUTOS_RECLAMO_VENCIDO = 10;

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
export class NotificacionesWorker {
  private readonly logger = new Logger(NotificacionesWorker.name);
  /** Una pasada a la vez por proceso: el cron no espera a la anterior. */
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: WhatsappGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'notificaciones-outbox' })
  async drenar(): Promise<void> {
    if (!this.config.get<boolean>('notificaciones.worker') || this.corriendo) {
      return;
    }

    this.corriendo = true;
    try {
      await this.liberarReclamosVencidos();

      const ids = await this.reclamar();
      for (const id of ids) {
        await this.enviarUna(id);
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
   */
  private async reclamar(): Promise<string[]> {
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
        },
      });
      return ids;
    });
  }

  private async enviarUna(id: string): Promise<void> {
    const fila = await this.prisma.notificacionSalida.findUnique({
      where: { id },
    });
    if (!fila) {
      return;
    }

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
      await this.reprogramar(id, fila.intentos, this.mensaje(error));
    }
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
