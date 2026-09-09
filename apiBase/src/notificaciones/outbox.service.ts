import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  TipoNotificacion,
} from '../generated/prisma/client.js';
import { CatalogoService } from '../catalogo/catalogo.service.js';
import { aE164 } from '../common/telefono.js';
import { ConfirmacionService } from './confirmacion.service.js';
import { NotificacionesWorker } from './notificaciones.worker.js';

/**
 * Lo que el outbox necesita saber de una cita recien creada.
 *
 * Lo arma el llamador con datos que ya tiene en la mano. Releerlos aqui con un
 * `findUnique` mas sus relaciones costaba cuatro consultas adicionales **dentro** de la
 * transaccion de la reserva, para recuperar exactamente lo que el `include` del INSERT
 * acababa de devolver.
 */
export interface DatosAviso {
  id: string;
  inicio: Date;
  cliente: { nombre: string; telefono: string; aceptaWhatsapp: boolean };
  servicio: { nombre: string };
  empleado: { usuario: { nombre: string; apellido: string | null } };
}

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
    private readonly catalogo: CatalogoService,
    private readonly worker: NotificacionesWorker,
  ) {}

  /**
   * Avisa al worker de que hay trabajo, para que no espere al sondeo.
   *
   * Se expone aqui y no se llama solo desde `encolarConfirmacion` porque tiene que
   * ocurrir **fuera** de la transaccion: la fila recien insertada no existe para otra
   * consulta hasta que la transaccion confirma, y un worker despertado antes de tiempo
   * no encuentra nada y se vuelve a dormir. Lo llama quien cierra la transaccion.
   *
   * Es una optimizacion, no un mecanismo: si el worker corre en otro proceso —el
   * despliegue del VPS— esta llamada no hace nada y el sondeo sigue siendo quien
   * entrega. Por eso el intervalo es corto.
   */
  despertarAlWorker(): void {
    this.worker.despertar();
  }

  /**
   * Encola la confirmacion de una cita recien reservada.
   *
   * Devuelve `false` cuando no hay nada que mandar —sin opt-in, o sin telefono en
   * forma internacional— y eso no es un error: la reserva sigue siendo valida.
   */
  async encolarConfirmacion(
    tx: Prisma.TransactionClient,
    cita: DatosAviso,
  ): Promise<boolean> {
    const citaId = cita.id;

    // Sin opt-in explicito no sale un solo mensaje: es politica de WhatsApp, y es lo
    // que sostiene la reputacion del numero.
    if (!cita.cliente.aceptaWhatsapp) {
      return false;
    }

    // Cacheada: es la fila de configuracion, y esta llamada ocurre dentro de la
    // transaccion de la reserva. Ver catalogo.service.ts.
    const negocio = await this.catalogo.negocio();

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
