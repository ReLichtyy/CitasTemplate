import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ConfirmadorCitas,
  type ResumenCita,
} from '../notificaciones/confirmador-citas.port.js';
import { CitasService } from './citas.service.js';

/**
 * Implementacion del puerto que usa el modulo de notificaciones. Es una linea de
 * pegamento a proposito: el cambio de estado sigue ocurriendo dentro de
 * `CitasService`, en la transaccion que le pasa el llamador, y con el invariante de
 * `slotOcupado` intacto. Ver 02-reservas-concurrencia.md.
 */
@Injectable()
export class CitasConfirmador extends ConfirmadorCitas {
  /**
   * `forwardRef` porque el grafo de proveedores es circular por diseño y en un solo
   * punto: `CitasService` depende del outbox para encolar, y el outbox —via el canje
   * del enlace— vuelve aqui. Sin esta arista perezosa, Nest se queda esperando a que
   * cada mitad exista y el proceso arranca a medias, sin error.
   *
   * Este es el unico lugar donde el ciclo se toca. Ver ../notificaciones/09-conexion-whatsapp.md.
   */
  constructor(
    @Inject(forwardRef(() => CitasService))
    private readonly citas: CitasService,
  ) {
    super();
  }

  marcarConfirmada(
    tx: Prisma.TransactionClient,
    citaId: string,
  ): Promise<ResumenCita> {
    return this.citas.marcarConfirmada(tx, citaId);
  }

  resumen(tx: Prisma.TransactionClient, citaId: string): Promise<ResumenCita> {
    return this.citas.resumenConfirmacion(tx, citaId);
  }
}
