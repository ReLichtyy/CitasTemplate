import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Concilia lo que el canal responde con la fila del outbox que lo origino.
 *
 * Habla en vocabulario del negocio —entregado, no entregable— y no en el del canal:
 * el `ack` numerico de WhatsApp se traduce en el adaptador, no aqui. Ver
 * 09-conexion-whatsapp.md.
 */
@Injectable()
export class AcusesService {
  private readonly logger = new Logger(AcusesService.name);

  /**
   * Idempotencia del webhook: el proveedor puede entregar el mismo evento dos veces.
   * Devuelve `false` cuando el evento ya se habia procesado, y entonces el llamador
   * no hace nada mas.
   */
  constructor(private readonly prisma: PrismaService) {}

  async esEventoNuevo(id: string, tipo: string): Promise<boolean> {
    try {
      await this.prisma.eventoWebhook.create({ data: { id, tipo } });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  /** El mensaje llego al telefono del cliente. */
  async marcarEntregada(idExterno: string): Promise<void> {
    const { count } = await this.prisma.notificacionSalida.updateMany({
      where: { idExterno, entregadaEn: null },
      data: { entregadaEn: new Date() },
    });
    if (count === 0) {
      // Un acuse de un mensaje que no salio de aqui: el numero del negocio tambien
      // conversa por su cuenta. No es un error.
      this.logger.debug(`Acuse sin fila propia: ${idExterno}`);
    }
  }

  /**
   * El canal reporta que no pudo entregarlo. No se reintenta —el envio si ocurrio—:
   * se deja anotado, que es lo que el personal necesita para levantar el telefono.
   */
  async marcarNoEntregable(idExterno: string, motivo: string): Promise<void> {
    await this.prisma.notificacionSalida.updateMany({
      where: { idExterno },
      data: { ultimoError: motivo },
    });
  }
}
