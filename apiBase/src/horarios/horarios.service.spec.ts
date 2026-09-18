import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { HorariosService } from './horarios.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const MENSAJE_DUPLICADO = 'Ese dia ya tiene una franja que abre a esa hora.';

/** El P2002 que MariaDB devolveria al pisar `@@unique([dia, minutoApertura])`. */
function duplicado() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function crearService() {
  const prisma = {
    horarioAtencion: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
  return { prisma, service: new HorariosService(prisma as unknown as PrismaService) };
}

describe('HorariosService', () => {
  it('rechaza una franja que cierra antes de abrir', async () => {
    const { service } = crearService();

    await expect(
      service.create({
        dia: 'LUNES',
        minutoApertura: 600,
        minutoCierre: 540,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('acepta los extremos que se tocan: los rangos son semiabiertos', async () => {
    const { prisma, service } = crearService();
    prisma.horarioAtencion.create.mockResolvedValue({
      id: 'h-1',
      dia: 'LUNES',
      minutoApertura: 540,
      minutoCierre: 600,
      activo: true,
    });

    const creado = await service.create({
      dia: 'LUNES',
      minutoApertura: 540,
      minutoCierre: 600,
    });

    expect(creado.minutoApertura).toBe(540);
    expect(prisma.horarioAtencion.create).toHaveBeenCalledTimes(1);
  });

  it('traduce el unique de la base al 409 redactado del contrato', async () => {
    const { prisma, service } = crearService();
    prisma.horarioAtencion.create.mockRejectedValue(duplicado());

    await expect(
      service.create({ dia: 'LUNES', minutoApertura: 540, minutoCierre: 600 }),
    ).rejects.toThrow(new ConflictException(MENSAJE_DUPLICADO));
  });

  it('comprueba la coherencia contra el estado que queda, no contra el parche', async () => {
    const { prisma, service } = crearService();
    prisma.horarioAtencion.findUnique.mockResolvedValue({
      minutoApertura: 540,
      minutoCierre: 600,
    });

    // Mover solo el cierre antes de la apertura vigente tiene que reventar.
    await expect(service.update('h-1', { minutoCierre: 500 })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.horarioAtencion.update).not.toHaveBeenCalled();
  });

  it('al actualizar traduce el unique igual que al crear', async () => {
    const { prisma, service } = crearService();
    prisma.horarioAtencion.findUnique.mockResolvedValue({
      minutoApertura: 540,
      minutoCierre: 600,
    });
    prisma.horarioAtencion.update.mockRejectedValue(duplicado());

    await expect(service.update('h-1', { minutoCierre: 700 })).rejects.toThrow(
      new ConflictException(MENSAJE_DUPLICADO),
    );
  });

  it('no borra un horario que no existe', async () => {
    const { prisma, service } = crearService();

    await expect(service.remove('h-1')).rejects.toThrow(NotFoundException);
    expect(prisma.horarioAtencion.delete).not.toHaveBeenCalled();
  });
});
