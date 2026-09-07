import type { Prisma } from '../generated/prisma/client.js';

/**
 * Lo unico que este modulo necesita del dominio de citas: mover una cita a
 * CONFIRMADA, y leer el resumen minimo que la pagina del enlace muestra.
 *
 * Es un puerto y no una llamada directa a `CitasService` por una razon concreta y no
 * estetica: `CitasService` ya depende del outbox para encolar, asi que importarlo de
 * vuelta aqui cierra un ciclo entre los dos archivos. En ESM ese ciclo revienta al
 * arrancar —`Cannot access 'ConfirmacionService' before initialization`— porque el
 * decorador se evalua antes de que la otra mitad exista.
 *
 * La implementacion vive en `citas/citas.confirmador.ts`: el cambio de estado sigue
 * pasando por `CitasService`, que es donde vive el invariante de `slotOcupado`.
 * Ver 09-conexion-whatsapp.md.
 */
export interface ResumenCita {
  servicio: string;
  profesional: string;
  inicio: Date;
  fin: Date;
  estado: string;
  confirmada: boolean;
}

export abstract class ConfirmadorCitas {
  abstract marcarConfirmada(
    tx: Prisma.TransactionClient,
    citaId: string,
  ): Promise<ResumenCita>;

  abstract resumen(
    tx: Prisma.TransactionClient,
    citaId: string,
  ): Promise<ResumenCita>;
}
