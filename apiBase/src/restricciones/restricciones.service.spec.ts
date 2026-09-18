import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RestriccionesService } from './restricciones.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const RESTRICCION = {
  id: 'r-1',
  tipo: 'VACACIONES',
  empleadoId: null,
  inicio: new Date('2026-09-20T00:00:00.000Z'),
  fin: new Date('2026-09-27T00:00:00.000Z'),
  motivo: null,
  empleado: null,
};

function crearService() {
  const prisma = {
    restriccionHorario: {
      findMany: vi.fn().mockResolvedValue([RESTRICCION]),
      findUnique: vi.fn().mockResolvedValue(RESTRICCION),
      create: vi.fn().mockResolvedValue(RESTRICCION),
      update: vi.fn().mockResolvedValue(RESTRICCION),
      delete: vi.fn().mockResolvedValue(RESTRICCION),
    },
    empleado: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  return { prisma, service: new RestriccionesService(prisma as unknown as PrismaService) };
}

describe('RestriccionesService', () => {
  it('rechaza un rango que termina antes de empezar', async () => {
    const { service } = crearService();

    await expect(
      service.create({
        tipo: 'FERIADO',
        inicio: '2026-09-20T00:00:00.000Z',
        fin: '2026-09-19T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('convierte las fechas ISO a Date antes de tocar la base', async () => {
    const { prisma, service } = crearService();

    await service.create({
      tipo: 'FERIADO',
      inicio: '2026-09-20T00:00:00.000Z',
      fin: '2026-09-21T00:00:00.000Z',
    });

    const data = prisma.restriccionHorario.create.mock.calls[0][0].data;
    expect(data.inicio).toBeInstanceOf(Date);
    expect(data.fin).toBeInstanceOf(Date);
  });

  it('exige que el profesional indicado exista, con nombre de campo y no un 500', async () => {
    const { prisma, service } = crearService();

    await expect(
      service.create({
        tipo: 'BLOQUEO',
        empleadoId: 'e-inexistente',
        inicio: '2026-09-20T00:00:00.000Z',
        fin: '2026-09-21T00:00:00.000Z',
      }),
    ).rejects.toThrow('El profesional indicado no existe.');

    expect(prisma.restriccionHorario.create).not.toHaveBeenCalled();
  });

  it('borra de verdad: un bloqueo no cuelga de ningun historico', async () => {
    const { prisma, service } = crearService();

    await service.remove('r-1');

    expect(prisma.restriccionHorario.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r-1' } }),
    );
  });

  it('no borra lo que no existe', async () => {
    const { prisma, service } = crearService();
    prisma.restriccionHorario.findUnique.mockResolvedValue(null);

    await expect(service.remove('r-otro')).rejects.toThrow(NotFoundException);
    expect(prisma.restriccionHorario.delete).not.toHaveBeenCalled();
  });
});
