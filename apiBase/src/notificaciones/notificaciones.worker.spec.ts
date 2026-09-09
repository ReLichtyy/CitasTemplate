import { EstadoNotificacion } from '../generated/prisma/client.js';
import { NotificacionesWorker } from './notificaciones.worker.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { WhatsappGateway } from './whatsapp.gateway.js';
import type { ConfigService } from '@nestjs/config';

const FILA = {
  id: 'not-1',
  citaId: 'cita-1',
  tipo: 'CONFIRMACION_CITA',
  destino: '+50688880001',
  variables: { nombre: 'Marta', enlace: 'https://app/citas/confirmar/abc' },
  estado: EstadoNotificacion.ENVIANDO,
  intentos: 1,
};

function crearWorker(
  opciones: { intentos?: number; maxIntentos?: number; esWorker?: boolean } = {},
) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'not-1' }]),
    notificacionSalida: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi
        .fn()
        .mockResolvedValue([{ ...FILA, intentos: opciones.intentos ?? 1 }]),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    notificacionSalida: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const valores: Record<string, unknown> = {
    'notificaciones.worker': opciones.esWorker ?? true,
    'notificaciones.lote': 20,
    'notificaciones.maxIntentos': opciones.maxIntentos ?? 4,
  };
  const config = { get: (clave: string) => valores[clave] };
  const gateway = { enviar: vi.fn().mockResolvedValue({ idExterno: 'wa-1' }) };

  const worker = new NotificacionesWorker(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    gateway as unknown as WhatsappGateway,
  );
  return { worker, prisma, tx, gateway };
}

describe('NotificacionesWorker', () => {
  /**
   * El arreglo del duplicado. Una fila con retraso se reclama con `proximoIntentoEn`
   * ya vencido; si el reclamo no lo resella, el barrido de otro worker la devuelve a
   * PENDIENTE mientras el primero la esta enviando, y el numero recibe dos mensajes.
   */
  it('sella el instante del reclamo en proximoIntentoEn', async () => {
    const { worker, tx } = crearWorker();

    await worker.drenar();

    const { data } = tx.notificacionSalida.updateMany.mock.calls[0][0];
    expect(data.estado).toBe(EstadoNotificacion.ENVIANDO);
    expect(data.intentos).toEqual({ increment: 1 });
    expect(data.proximoIntentoEn).toBeInstanceOf(Date);
  });

  /** El lote se lee de una vez, no una consulta por mensaje. */
  it('no relee las filas una por una', async () => {
    const { worker, prisma, tx } = crearWorker();

    await worker.drenar();

    expect(tx.notificacionSalida.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.notificacionSalida.findUnique).not.toHaveBeenCalled();
  });

  it('marca ENVIADA y borra el enlace del token tras un envio bueno', async () => {
    const { worker, prisma, gateway } = crearWorker();

    await worker.drenar();

    expect(gateway.enviar).toHaveBeenCalledWith(
      FILA.destino,
      FILA.tipo,
      FILA.variables,
    );
    const { data } = prisma.notificacionSalida.update.mock.calls[0][0];
    expect(data.estado).toBe(EstadoNotificacion.ENVIADA);
    expect(data.idExterno).toBe('wa-1');
    // El token ya no hace falta: en la base debe quedar solo su hash.
    expect(data.variables).not.toHaveProperty('enlace');
    expect(data.variables).toHaveProperty('nombre', 'Marta');
  });

  it('reprograma con retroceso cuando el canal falla', async () => {
    const { worker, prisma, gateway } = crearWorker();
    gateway.enviar.mockRejectedValue(new Error('canal caido'));

    await worker.drenar();

    const { data } = prisma.notificacionSalida.update.mock.calls[0][0];
    expect(data.estado).toBe(EstadoNotificacion.PENDIENTE);
    expect(data.ultimoError).toBe('canal caido');
    // Primer intento fallido: espera de 5 min (ESPERA_MINUTOS[1]).
    const espera = data.proximoIntentoEn.getTime() - Date.now();
    expect(espera).toBeGreaterThan(4 * 60_000);
    expect(espera).toBeLessThanOrEqual(5 * 60_000);
  });

  it('da la fila por FALLIDA al agotar los intentos', async () => {
    const { worker, prisma, gateway } = crearWorker({ intentos: 4, maxIntentos: 4 });
    gateway.enviar.mockRejectedValue(new Error('numero sin whatsapp'));

    await worker.drenar();

    const { data } = prisma.notificacionSalida.update.mock.calls[0][0];
    expect(data.estado).toBe(EstadoNotificacion.FALLIDA);
    expect(data).not.toHaveProperty('proximoIntentoEn');
  });

  /** Es la misma imagen desplegada dos veces: el API no debe drenar el outbox. */
  it('no drena nada si este proceso no es el worker', async () => {
    const { worker, prisma } = crearWorker({ esWorker: false });

    await worker.drenar();

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
