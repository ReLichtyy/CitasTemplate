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
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { LimiteIntentos } from '../../common/decorators/limite-intentos.decorator.js';
import { LimiteIntentosGuard } from '../../common/guards/limite-intentos.guard.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { firmaCoincide } from '../../notificaciones/confirmacion.service.js';
import { AcusesService } from '../../notificaciones/acuses.service.js';
import { EventoWahaDto } from './dto/evento-waha.dto.js';
import { AckWhatsapp, idDeMensaje } from './waha.types.js';

/**
 * El pipe global corre con `forbidNonWhitelisted`, y el evento real de WAHA trae
 * decenas de campos que aqui no se leen: con el, **todo** webhook legitimo es un 400.
 * Se comprobo en caliente —WAHA reintentando 15 veces contra
 * "La peticion tiene campos que no se admiten."—.
 *
 * Anotar el parametro con el DTO no basta: los pipes globales se aplican igual que los
 * de parametro. Por eso `@Body()` se recibe sin metatipo —el pipe global no valida un
 * `Record`— y la validacion se hace aqui a mano, con las reglas que esta ruta necesita:
 * validar lo declarado y descartar el resto en silencio. Ver dto/evento-waha.dto.ts.
 */
const VALIDAR_EVENTO = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
});

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
    @Body() cuerpo: Record<string, unknown>,
  ): Promise<void> {
    this.verificarFirma(request);

    const evento = await this.validar(cuerpo);
    if (!evento) {
      return;
    }

    // Sin id no hay como descartar un repetido, y WAHA puede entregar el mismo evento
    // dos veces. Se descarta el evento entero antes que arriesgar un doble efecto.
    const idEvento = evento.id;
    const tipo = evento.event ?? 'desconocido';
    if (!idEvento) {
      this.logger.warn(`Evento ${tipo} sin id: se descarta.`);
      return;
    }

    /**
     * Un evento de otra sesion no habla de nuestras filas. El contenedor puede
     * sostener varias, y una sesion vieja que revive con `WHATSAPP_RESTART_ALL_SESSIONS`
     * seguiria mandando acuses de mensajes que este API nunca envio.
     */
    const sesionPropia = this.config.get<string>('waha.session');
    if (evento.session && sesionPropia && evento.session !== sesionPropia) {
      this.logger.warn(`Evento ${tipo} de sesion ajena (${evento.session}).`);
      return;
    }

    if (!(await this.acuses.esEventoNuevo(idEvento, tipo))) {
      return;
    }

    if (tipo === 'session.status') {
      this.registrarEstadoDeSesion(evento);
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

  /**
   * La firma prueba que el cuerpo lo mando WAHA; no prueba que traiga lo que este
   * codigo espera. Un cuerpo que no valida es una version de WAHA distinta de la
   * probada, y reintentarlo da lo mismo: se responde 204 y se deja dicho en el log.
   * Devolver 400 solo consigue que WAHA lo reintente quince veces.
   */
  private async validar(
    cuerpo: Record<string, unknown>,
  ): Promise<EventoWahaDto | null> {
    try {
      return (await VALIDAR_EVENTO.transform(cuerpo, {
        type: 'body',
        metatype: EventoWahaDto,
      })) as EventoWahaDto;
    } catch (error) {
      this.logger.error(
        `Evento de WAHA con forma inesperada, se descarta: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * La sesion de WhatsApp se cae sola: la desvincula el telefono, o WhatsApp la cierra.
   * Sin esto, una sesion muerta solo se nota cuando los avisos empiezan a fallar, que
   * es varias citas mas tarde. No se intenta reparar desde aqui —revivir una sesion es
   * escanear un QR, y eso lo hace una persona—: se deja dicho en el log, fuerte.
   */
  private registrarEstadoDeSesion(evento: EventoWahaDto): void {
    const estado = evento.payload?.status;
    if (estado === 'WORKING') {
      this.logger.log('La sesion de WhatsApp esta activa.');
      return;
    }
    this.logger.error(
      `La sesion de WhatsApp paso a ${estado ?? 'desconocido'}: los avisos no van a salir hasta que se vuelva a parear.`,
    );
  }

  private async procesarAcuse(evento: EventoWahaDto): Promise<void> {
    // Mismo reparto que al enviar: NOWEB lo pone en `key`, WEBJS en `id`.
    const idExterno = idDeMensaje(evento.payload?.id ?? evento.payload?.key);
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
