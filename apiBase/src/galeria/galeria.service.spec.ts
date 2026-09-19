import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GaleriaService } from './galeria.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ArchivosService } from '../archivos/archivos.service.js';

const FOTO = {
  id: 'fg-1',
  imagenUrl: 'http://localhost:3000/archivos/abc.jpg',
  descripcion: 'El degradado que pidio el cliente',
  servicio: { id: 's-1', nombre: 'Corte y barba' },
};

function crearService() {
  const prisma = {
    servicio: { findUnique: vi.fn().mockResolvedValue({ id: 's-1' }) },
    fotoGaleria: {
      findMany: vi.fn().mockResolvedValue([FOTO]),
      findUnique: vi.fn().mockResolvedValue({ imagenUrl: FOTO.imagenUrl }),
      create: vi.fn().mockResolvedValue(FOTO),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
  const archivos = { eliminar: vi.fn().mockResolvedValue(undefined) };
  return {
    prisma,
    archivos,
    service: new GaleriaService(
      prisma as unknown as PrismaService,
      archivos as unknown as ArchivosService,
    ),
  };
}

describe('GaleriaService', () => {
  it('lista solo fotos de servicios publicados, la mas reciente primero', async () => {
    const { prisma, service } = crearService();

    await service.findAll();

    const llamada = prisma.fotoGaleria.findMany.mock.calls[0][0];
    expect(llamada.where).toEqual({ servicio: { activo: true } });
    expect(llamada.orderBy).toEqual({ creadoEn: 'desc' });
  });

  it('no crea una foto con un servicio que no existe', async () => {
    const { prisma, service } = crearService();
    prisma.servicio.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ imagenUrl: FOTO.imagenUrl, servicioId: 's-otro' }),
    ).rejects.toThrow(new BadRequestException('El servicio indicado no existe.'));
    expect(prisma.fotoGaleria.create).not.toHaveBeenCalled();
  });

  it('al crear persiste la URL y el servicio, y omite la descripcion vacia', async () => {
    const { prisma, service } = crearService();

    // El recorte es del frontend; aqui lo que no debe llegar a la base es una
    // descripcion vacia, ni como cadena de espacios.
    await service.create({ imagenUrl: FOTO.imagenUrl, servicioId: 's-1', descripcion: '' });

    expect(prisma.fotoGaleria.create.mock.calls[0][0].data).toEqual({
      imagenUrl: FOTO.imagenUrl,
      servicioId: 's-1',
    });
  });

  it('persiste la descripcion cuando la trae', async () => {
    const { prisma, service } = crearService();

    await service.create({
      imagenUrl: FOTO.imagenUrl,
      servicioId: 's-1',
      descripcion: 'Un pie de foto',
    });

    const data = prisma.fotoGaleria.create.mock.calls[0][0].data;
    expect(data.descripcion).toBe('Un pie de foto');
  });

  it('no quita una foto que no existe', async () => {
    const { prisma, service } = crearService();
    prisma.fotoGaleria.findUnique.mockResolvedValue(null);

    await expect(service.remove('fg-otro')).rejects.toThrow(NotFoundException);
    expect(prisma.fotoGaleria.delete).not.toHaveBeenCalled();
  });

  it('al quitar borra la fila y el archivo del almacen', async () => {
    const { prisma, archivos, service } = crearService();

    await service.remove('fg-1');

    expect(prisma.fotoGaleria.delete).toHaveBeenCalledWith({ where: { id: 'fg-1' } });
    expect(archivos.eliminar).toHaveBeenCalledWith('abc.jpg');
  });

  it('no toca el almacen si la URL no apunta a /archivos: una URL externa no es nuestra', async () => {
    const { prisma, archivos, service } = crearService();
    prisma.fotoGaleria.findUnique.mockResolvedValue({
      imagenUrl: 'https://cdn-ejemplo.com/foto.jpg',
    });

    await service.remove('fg-1');

    expect(prisma.fotoGaleria.delete).toHaveBeenCalled();
    expect(archivos.eliminar).not.toHaveBeenCalled();
  });

  it('quitar prospera aunque el borrado del archivo falle: la fila ya no esta', async () => {
    const { archivos, service } = crearService();
    archivos.eliminar.mockRejectedValue(new Error('disco caido'));

    await expect(service.remove('fg-1')).resolves.toBeUndefined();
  });
});
