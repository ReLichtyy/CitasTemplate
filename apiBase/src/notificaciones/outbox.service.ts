import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  TipoNotificacion,
} from '../generated/prisma/client.js';
import { aE164 } from '../common/telefono.js';
import { ConfirmacionService } from './confirmacion.service.js';

/**
 * Encolar la intencion de enviar. Es lo unico del envio que participa de la
 * transaccion de la cita: un INSERT local y barato.
 *
 * La llamada HTTP al canal **nunca** ocurre aqui. Una transaccion abierta sostiene
 * locks de fila y meterle una llamada de red le regala la latencia de WhatsApp a la
 * tasa de conflictos de reserva; y si el envio falla dentro de la transaccion,
 * revienta una reserva perfectamente valida. La cita es el producto, el aviso es
 * cortesia. Ver 09-conexion-whatsapp.md.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly confirmacion: ConfirmacionService,
  ) {}

  /**
   * Encola la confirmacion de una cita recien reservada.
   *
   * Devuelve `false` cuando no hay nada que mandar —sin opt-in, o sin telefono en
   * forma internacional— y eso no es un error: la reserva sigue siendo valida.
   */
  async encolarConfirmacion(
    tx: Prisma.TransactionClient,
    citaId: string,
  ): Promise<boolean> {
    const cita = await tx.cita.findUnique({
      where: { id: citaId },
      include: {
        cliente: {
          select: {
            nombre: true,
            telefono: true,
            aceptaWhatsapp: true,
          },
        },
        servicio: { select: { nombre: true } },
        empleado: {
          select: { usuario: { select: { nombre: true, apellido: true } } },
        },
      },
    });
    if (!cita) {
      return false;
    }

    // Sin opt-in explicito no sale un solo mensaje: es politica de WhatsApp, y es lo
    // que sostiene la reputacion del numero.
    if (!cita.cliente.aceptaWhatsapp) {
      return false;
    }

    const negocio = await tx.configuracionNegocio.findUnique({
      where: { id: 1 },
      select: {
        nombre: true,
        prefijoPais: true,
        zonaHoraria: true,
        locale: true,
      },
    });

    // El destino se congela en E.164 aqui y no se vuelve a leer del Usuario al enviar:
    // si el cliente cambia de numero, el mensaje ya encolado no debe salir a un destino
    // que nadie eligio.
    const destino = aE164(cita.cliente.telefono, negocio?.prefijoPais);
    if (!destino) {
      this.logger.warn(
        `Cita ${citaId}: telefono sin forma internacional, no se encola aviso.`,
      );
      return false;
    }

    // El token se emite aqui y no en `CitasService`: el dominio de citas encola una
    // intencion de aviso y no tiene por que saber que el aviso lleva un enlace firmado.
    const tokenEnClaro = await this.confirmacion.emitirToken(
      tx,
      citaId,
      cita.inicio,
    );

    const variables = {
      nombre: cita.cliente.nombre,
      negocio: negocio?.nombre ?? '',
      servicio: cita.servicio.nombre,
      profesional: [
        cita.empleado.usuario.nombre,
        cita.empleado.usuario.apellido,
      ]
        .filter(Boolean)
        .join(' '),
      fecha: this.formatearFecha(
        cita.inicio,
        negocio?.zonaHoraria,
        negocio?.locale,
      ),
      enlace: `${this.config.get<string>('notificaciones.urlPublica')}/citas/confirmar/${tokenEnClaro}`,
    };

    // `skipDuplicates` es la idempotencia de @@unique([citaId, tipo]): encolar dos
    // veces es un no-op, no un segundo mensaje al mismo numero.
    const { count } = await tx.notificacionSalida.createMany({
      data: [
        {
          citaId,
          tipo: TipoNotificacion.CONFIRMACION_CITA,
          destino,
          variables,
        },
      ],
      skipDuplicates: true,
    });

    return count > 0;
  }

  private formatearFecha(
    instante: Date,
    zonaHoraria?: string,
    locale?: string,
  ): string {
    return new Intl.DateTimeFormat(locale ?? 'es', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: zonaHoraria ?? 'UTC',
    }).format(instante);
  }
}
