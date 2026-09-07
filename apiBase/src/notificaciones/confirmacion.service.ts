import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfirmadorCitas } from './confirmador-citas.port.js';

/**
 * Un token inexistente, uno vencido y uno ya usado responden **igual**.
 * Distinguirlos convierte la ruta en un oraculo de que citas existen, y la ruta es
 * publica. Ver 09-conexion-whatsapp.md.
 */
const MENSAJE_ENLACE_INVALIDO = 'El enlace no es valido o ya vencio.';

export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Tokens del enlace de confirmacion: emitir y canjear.
 *
 * En la base vive **solo el hash**, igual que una contrasena: quien lea la base no
 * puede confirmar citas ajenas. El token en claro existe unicamente dentro del
 * enlace que viaja en el mensaje.
 */
@Injectable()
export class ConfirmacionService {
  constructor(
    private readonly prisma: PrismaService,
    // Un puerto, no `CitasService`: importarlo aqui cerraria un ciclo de archivos con
    // el outbox y el proceso no arranca. El cambio de estado sigue pasando por el
    // servicio de citas —donde vive el invariante de `slotOcupado`— a traves de
    // `citas/citas.confirmador.ts`. Ver confirmador-citas.port.ts.
    private readonly citas: ConfirmadorCitas,
  ) {}

  /**
   * Emite el token de una cita dentro de la transaccion que la crea. Devuelve el
   * token en claro, que es lo unico que el llamador puede meter en el enlace.
   *
   * Vence a la hora de inicio de la cita: confirmar una cita ya empezada no significa
   * nada. Reprogramar reemplaza el token, no acumula.
   */
  async emitirToken(
    tx: Prisma.TransactionClient,
    citaId: string,
    expiraEn: Date,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');

    await tx.tokenConfirmacion.deleteMany({ where: { citaId } });
    await tx.tokenConfirmacion.create({
      data: { hash: hashDeToken(token), citaId, expiraEn },
    });

    return token;
  }

  /**
   * Lo que la pagina del frontend muestra antes de que alguien pulse el boton.
   *
   * Devuelve lo minimo: servicio, profesional y fecha. Nunca el telefono ni el resto
   * de la ficha del cliente — el enlace pudo haberse reenviado.
   */
  async consultar(token: string) {
    const registro = await this.buscarVigente(token);

    return {
      servicio: registro.cita.servicio.nombre,
      profesional: [
        registro.cita.empleado.usuario.nombre,
        registro.cita.empleado.usuario.apellido,
      ]
        .filter(Boolean)
        .join(' '),
      inicio: registro.cita.inicio,
      fin: registro.cita.fin,
      estado: registro.cita.estado.codigo,
      /** Ya confirmada: la pagina muestra el hecho en vez del boton. */
      confirmada: registro.usadoEn !== null,
    };
  }

  /**
   * El canje. `usadoEn` y el cambio de estado van en la **misma** transaccion: un
   * token de un solo uso que se marca aparte no es de un solo uso.
   */
  async confirmar(token: string) {
    const hash = hashDeToken(token);

    return this.prisma.$transaction(async (tx) => {
      const registro = await tx.tokenConfirmacion.findUnique({
        where: { hash },
        select: { citaId: true, expiraEn: true, usadoEn: true },
      });

      if (!registro || registro.expiraEn.getTime() <= Date.now()) {
        throw new NotFoundException(MENSAJE_ENLACE_INVALIDO);
      }

      // Ya usado: confirmar dos veces es un no-op, no un error. Un doble clic no debe
      // asustar a quien ya hizo lo correcto.
      if (registro.usadoEn) {
        return this.citas.resumen(tx, registro.citaId);
      }

      // El WHERE lleva `usadoEn: null`: si dos peticiones llegan a la vez, solo una
      // encuentra fila que actualizar.
      const marcados = await tx.tokenConfirmacion.updateMany({
        where: { hash, usadoEn: null },
        data: { usadoEn: new Date() },
      });
      if (marcados.count === 0) {
        return this.citas.resumen(tx, registro.citaId);
      }

      return this.citas.marcarConfirmada(tx, registro.citaId);
    });
  }

  /** Igual para inexistente, vencido y de una cita borrada. */
  private async buscarVigente(token: string) {
    const registro = await this.prisma.tokenConfirmacion.findUnique({
      where: { hash: hashDeToken(token) },
      include: {
        cita: {
          include: {
            servicio: { select: { nombre: true } },
            estado: { select: { codigo: true } },
            empleado: {
              select: { usuario: { select: { nombre: true, apellido: true } } },
            },
          },
        },
      },
    });

    if (!registro || registro.expiraEn.getTime() <= Date.now()) {
      throw new NotFoundException(MENSAJE_ENLACE_INVALIDO);
    }
    return registro;
  }
}

/**
 * Comparacion de tiempo constante para firmas de webhook. Vive aqui porque es el
 * mismo problema que el token: comparar con `===` filtra por cuanto tarda en fallar.
 */
export function firmaCoincide(esperada: string, recibida: string): boolean {
  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(recibida, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
