import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * La diferencia entre las dos sondas es la razon de que existan las dos, asi que es lo
 * que se prueba: `/health` no puede depender de la base, y `/health/listo` no puede dar
 * verde sin ella.
 */
const prismaFalso = (consulta: () => Promise<unknown>) =>
  ({ $queryRaw: vi.fn(consulta) }) as unknown as PrismaService;

describe('HealthController', () => {
  it('/health responde sin tocar la base', async () => {
    const prisma = prismaFalso(() => Promise.reject(new Error('base caida')));
    const controlador = new HealthController(prisma);

    expect(controlador.check().status).toBe('ok');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('/health/listo responde ok con la base viva', async () => {
    const controlador = new HealthController(
      prismaFalso(() => Promise.resolve([{ 1: 1 }])),
    );

    await expect(controlador.listo()).resolves.toEqual({
      status: 'ok',
      base: 'ok',
    });
  });

  it('/health/listo devuelve 503 con la base caida', async () => {
    const controlador = new HealthController(
      prismaFalso(() => Promise.reject(new Error('ECONNREFUSED'))),
    );

    await expect(controlador.listo()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('/health/listo no se queda colgada si la base no contesta', async () => {
    vi.useFakeTimers();
    try {
      const controlador = new HealthController(
        prismaFalso(() => new Promise(() => {})),
      );

      const promesa = controlador.listo();
      // El rechazo tiene que salir del temporizador, no de la consulta.
      const esperado = expect(promesa).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await vi.advanceTimersByTimeAsync(3000);
      await esperado;
    } finally {
      vi.useRealTimers();
    }
  });
});
