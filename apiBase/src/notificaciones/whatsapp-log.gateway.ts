import { Injectable, Logger } from '@nestjs/common';
import type { TipoNotificacion } from '../generated/prisma/client.js';
import { WhatsappGateway, type ResultadoEnvio } from './whatsapp.gateway.js';
import { renderizar } from './plantillas.js';

/**
 * Implementacion de mentira: escribe el mensaje al log en vez de mandarlo.
 *
 * No es un juguete. Es contra esto que se verifican los reintentos, el reclamo con
 * `SKIP LOCKED` y la idempotencia —que es donde estan los errores dificiles— sin
 * gastar una sesion de WhatsApp ni arriesgar el numero. Se usa cuando `WAHA_URL` no
 * esta configurada. Ver 09-conexion-whatsapp.md.
 */
@Injectable()
export class WhatsappLogGateway extends WhatsappGateway {
  private readonly logger = new Logger(WhatsappLogGateway.name);

  async enviar(
    destino: string,
    plantilla: TipoNotificacion,
    variables: Record<string, unknown>,
  ): Promise<ResultadoEnvio> {
    this.logger.log(
      `[sin canal] ${plantilla} -> ${destino}\n${renderizar(plantilla, variables)}`,
    );
    return { idExterno: `log-${Date.now()}` };
  }
}
