import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { TipoNotificacion } from '../../generated/prisma/client.js';
import { renderizar } from '../../notificaciones/plantillas.js';
import {
  WhatsappGateway,
  type ResultadoEnvio,
} from '../../notificaciones/whatsapp.gateway.js';
import {
  aChatId,
  idDeMensaje,
  type RespuestaEnvioWaha,
} from './waha.types.js';

/**
 * Adaptador de WAHA sobre el puerto `WhatsappGateway`. Es la unica clase del backend
 * que sabe que del otro lado hay WhatsApp Web manejado por ingenieria inversa.
 *
 * El dia que el numero caiga y haya que migrar a la Cloud API de Meta, aparece un
 * `integrations/meta/` al lado de este archivo y no se toca ni el outbox, ni el
 * worker, ni el dominio de citas. Ver 09-conexion-whatsapp.md.
 */
@Injectable()
export class WahaClient extends WhatsappGateway {
  private readonly logger = new Logger(WahaClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async enviar(
    destino: string,
    plantilla: TipoNotificacion,
    variables: Record<string, unknown>,
  ): Promise<ResultadoEnvio> {
    const url = this.config.get<string>('waha.url');
    const apiKey = this.config.get<string>('waha.apiKey');
    if (!url || !apiKey) {
      // Se lanza, no se devuelve: el worker lo cuenta como intento fallido y lo
      // reprograma. Un envio que se pierde en silencio es peor que uno que reintenta.
      throw new Error('WAHA no esta configurado (WAHA_URL / WAHA_API_KEY).');
    }

    const respuesta = await firstValueFrom(
      this.http.post<RespuestaEnvioWaha>(
        `${url}/api/sendText`,
        {
          session: this.config.get<string>('waha.session'),
          chatId: aChatId(destino),
          text: renderizar(plantilla, variables),
        },
        {
          headers: { 'X-Api-Key': apiKey },
          timeout: this.config.get<number>('waha.timeoutMs'),
        },
      ),
    );

    const idExterno = idDeMensaje(respuesta.data?.id);
    if (!idExterno) {
      // No es un fallo de envio: el mensaje salio. Pero sin id no hay con que conciliar
      // el acuse de entrega despues, y eso conviene verlo en el log.
      this.logger.warn('WAHA acepto el mensaje sin devolver id.');
    }
    return { idExterno };
  }
}
