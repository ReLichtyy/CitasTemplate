import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AdicionalesService } from './adicionales.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const ADICIONAL = {
  id: 'a-1',
  nombre: 'Aromaterapia',
  descripcion: null,
  precio: '10.00',
  activo: true,
};

function crearService() {
  const prisma = {
    servicioAdicional: {
      findMany: vi.fn().mockResolvedValue([ADICIONAL]),
      findUnique: vi.fn().mockResolvedValue(ADICIONAL),
      create: vi.fn().mockResolvedValue(ADICIONAL),
      update: vi.fn().mockResolvedValue(ADICIONAL),
    },
  };
  return { prisma, service: new AdicionalesService(prisma as unknown as PrismaService) };
}

describe('AdicionalesService', () => {
  it('devuelve tambien los despublicados: la lectura es de gestion', async () => {
    const { prisma, service } = crearService();
    prisma.servicioAdicional.findMany.mockResolvedValue([
      { ...ADICIONAL, activo: false },
    ]);

    const lista = await service.findAll();

    expect(lista[0].activo).toBe(false);
    // Sin filtro `where`: el `activo` apagado no se esconde de quien lo tiene que volver
    // a encender.
    expect(prisma.servicioAdicional.findMany.mock.calls[0][0]).not.toHaveProperty('where');
  });

  it('al crear convierte el precio a Decimal y respeta el activo ausente', async () => {
    const { prisma, service } = crearService();

    await service.create({ nombre: 'Aromaterapia', precio: '10.00' });

    const data = prisma.servicioAdicional.create.mock.calls[0][0].data;
    expect(data.precio.toFixed(2)).toBe('10.00');
    // El `activo` no se fuerza: el modelo ya lo trae en `true` por defecto.
    expect(data.activo).toBeUndefined();
  });

  it('no toca un precio que el parche no trae', async () => {
    const { prisma, service } = crearService();

    await service.update('a-1', { nombre: 'Otro nombre' });

    const data = prisma.servicioAdicional.update.mock.calls[0][0].data;
    expect(data.precio).toBeUndefined();
  });

  it('remove despublica en vez de borrar: la fila sigue citada en citas pasadas', async () => {
    const { prisma, service } = crearService();
    prisma.servicioAdicional.update.mockResolvedValue({ ...ADICIONAL, activo: false });

    const resultado = await service.remove('a-1');

    expect(resultado.activo).toBe(false);
    expect(prisma.servicioAdicional.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a-1' }, data: { activo: false } }),
    );
  });

  it('no despublica lo que no existe', async () => {
    const { prisma, service } = crearService();
    prisma.servicioAdicional.findUnique.mockResolvedValue(null);

    await expect(service.remove('a-otro')).rejects.toThrow(NotFoundException);
    expect(prisma.servicioAdicional.update).not.toHaveBeenCalled();
  });
});
