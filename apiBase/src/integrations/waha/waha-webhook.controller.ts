import { createHmac } from 'node:crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { LimiteIntentos } from '../../common/decorators/limite-intentos.decorator.js';
import { LimiteIntentosGuard } from '../../common/guards/limite-intentos.guard.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { firmaCoincide } from '../../notificaciones/confirmacion.service.js';
import { AcusesService } from '../../notificaciones/acuses.service.js';
import { AckWhatsapp, idDeMensaje, type EventoWaha } from './waha.types.js';

/**
 * Webhook de WAHA. Vive en `integrations/waha/` y no en `notificaciones/` porque lo
 * que entra por aqui es vocabulario del canal —`ack`, `@c.us`, la firma HMAC de
 * WAHA— y esa es justamente la frontera que el modulo de notificaciones no debe
 * cruzar. Lo que sale de aqui hacia `AcusesService` ya esta traducido.
 *
 * La ruta es `@Public()` por fuerza: quien la llama es un contenedor, no un usuario
 * con sesion. Lo que la protege es la firma, comparada en tiempo constante.
 * Ver 09-conexion-whatsapp.md.
 */
@Controller('webhooks/whatsapp')
export class WahaWebhookController {
  private readonly logger = new Logger(WahaWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly acuses: AcusesService,
  ) {}

  @Public()
  @UseGuards(LimiteIntentosGuard)
  // Holgado: en local es un contenedor en la red de Docker, no internet abierta. Sirve
  // para que un bucle del proveedor no convierta el webhook en un amplificador.
  @LimiteIntentos({ intentos: 600, ventanaMs: 60_000 })
  @HttpCode(204)
  @Post()
  async recibir(
    @Req() request: Request & { rawBody?: Buffer },
    @Body() evento: EventoWaha,
  ): Promise<void> {
    this.verificarFirma(request);

    // Sin id no hay como descartar un repetido, y WAHA puede entregar el mismo evento
    // dos veces. Se descarta el evento entero antes que arriesgar un doble efecto.
    const idEvento = evento.id;
    const tipo = evento.event ?? 'desconocido';
    if (!idEvento) {
      this.logger.warn(`Evento ${tipo} sin id: se descarta.`);
      return;
    }

    if (!(await this.acuses.esEventoNuevo(idEvento, tipo))) {
      return;
    }

    if (tipo === 'message.ack') {
      await this.procesarAcuse(evento);
      return;
    }

    // `message` entrante: la confirmacion por respuesta de texto es comodidad futura y
    // nunca el unico camino (paso 6 de 09-conexion-whatsapp.md). Adivinar cual de dos
    // citas pendientes se confirma es peor que no responder.
    this.logger.debug(`Evento ${tipo} recibido y descartado.`);
  }

  private async procesarAcuse(evento: EventoWaha): Promise<void> {
    const idExterno = idDeMensaje(evento.payload?.id);
    if (!idExterno) {
      return;
    }

    const ack = evento.payload?.ack;
    if (ack === AckWhatsapp.ERROR) {
      await this.acuses.marcarNoEntregable(
        idExterno,
        'El canal no pudo entregar el mensaje; el numero puede no tener WhatsApp.',
      );
      return;
    }

    // ENTREGADO y LEIDO valen igual: el mensaje llego al telefono. Lo anterior
    // (PENDIENTE, ENVIADO_AL_SERVIDOR) todavia no dice nada.
    if (ack !== undefined && ack >= AckWhatsapp.ENTREGADO) {
      await this.acuses.marcarEntregada(idExterno);
    }
  }

  /**
   * La firma se calcula sobre el cuerpo **crudo**: recalcularla sobre el JSON ya
   * parseado y vuelto a serializar cambia espacios y orden de claves, y entonces
   * ninguna firma legitima coincide.
   *
   * Sin clave configurada la ruta se rechaza entera. Aceptar sin firma dejaria que
   * cualquiera que alcance el puerto se invente acuses de entrega.
   */
  private verificarFirma(request: Request & { rawBody?: Buffer }): void {
    const clave = this.config.get<string>('waha.hookHmacKey');
    if (!clave) {
      throw new ForbiddenException();
    }

    const recibida = request.header('x-webhook-hmac');
    const algoritmo = request.header('x-webhook-hmac-algorithm') ?? 'sha512';
    if (!recibida || !request.rawBody) {
      throw new ForbiddenException();
    }

    let esperada: string;
    try {
      esperada = createHmac(algoritmo, clave)
        .update(request.rawBody)
        .digest('hex');
    } catch {
      throw new ForbiddenException();
    }

    if (!firmaCoincide(esperada, recibida)) {
      throw new ForbiddenException();
    }
  }
}
