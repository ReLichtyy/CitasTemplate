import { CatalogoService } from './catalogo.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const NEGOCIO = {
  nombre: 'Estudio',
  zonaHoraria: 'America/Costa_Rica',
  locale: 'es',
  prefijoPais: '+506',
};

const ESTADOS = [
  { id: 'est-pen', codigo: 'PENDIENTE', bloqueaDisponibilidad: true },
  { id: 'est-can', codigo: 'CANCELADA', bloqueaDisponibilidad: false },
];

function crearPrisma() {
  const prisma = {
    configuracionNegocio: { findUnique: vi.fn().mockResolvedValue(NEGOCIO) },
    estadoCita: { findMany: vi.fn().mockResolvedValue(ESTADOS) },
  };
  return {
    prisma,
    catalogo: new CatalogoService(prisma as unknown as PrismaService),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CatalogoService', () => {
  it('consulta una sola vez y sirve el resto desde la cache', async () => {
    const { prisma, catalogo } = crearPrisma();

    expect(await catalogo.zonaHoraria()).toBe('America/Costa_Rica');
    await catalogo.negocio();
    await catalogo.zonaHoraria();

    expect(prisma.configuracionNegocio.findUnique).toHaveBeenCalledTimes(1);
  });

  it('trae el catalogo de estados entero, no uno por codigo', async () => {
    const { prisma, catalogo } = crearPrisma();

    expect((await catalogo.estado('PENDIENTE'))?.id).toBe('est-pen');
    expect((await catalogo.estado('CANCELADA'))?.id).toBe('est-can');
    expect(await catalogo.estado('NO_EXISTE')).toBeUndefined();

    expect(prisma.estadoCita.findMany).toHaveBeenCalledTimes(1);
  });

  /**
   * El punto de guardar la promesa y no el valor: dos reservas simultaneas que fallan
   * la cache comparten una consulta. Si se guardara el valor, las dos consultarian.
   */
  it('comparte una sola consulta entre llamadas concurrentes', async () => {
    const { prisma, catalogo } = crearPrisma();

    await Promise.all([catalogo.negocio(), catalogo.negocio(), catalogo.negocio()]);

    expect(prisma.configuracionNegocio.findUnique).toHaveBeenCalledTimes(1);
  });

  it('vuelve a la base cuando vence el TTL', async () => {
    const { prisma, catalogo } = crearPrisma();

    await catalogo.negocio();
    vi.advanceTimersByTime(60_001);
    await catalogo.negocio();

    expect(prisma.configuracionNegocio.findUnique).toHaveBeenCalledTimes(2);
  });

  /** Un fallo puntual de la base no puede quedar cacheado un minuto entero. */
  it('no cachea un fallo: el siguiente llamador reintenta', async () => {
    const { prisma, catalogo } = crearPrisma();
    prisma.configuracionNegocio.findUnique.mockRejectedValueOnce(
      new Error('sin conexion'),
    );

    await expect(catalogo.negocio()).rejects.toThrow('sin conexion');
    expect(await catalogo.negocio()).toEqual(NEGOCIO);
    expect(prisma.configuracionNegocio.findUnique).toHaveBeenCalledTimes(2);
  });

  it('invalidar fuerza la relectura sin esperar al TTL', async () => {
    const { prisma, catalogo } = crearPrisma();

    await catalogo.negocio();
    await catalogo.estado('PENDIENTE');
    catalogo.invalidar();
    await catalogo.negocio();
    await catalogo.estado('PENDIENTE');

    expect(prisma.configuracionNegocio.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.estadoCita.findMany).toHaveBeenCalledTimes(2);
  });

  it('cae a UTC si nadie configuro la fila del negocio', async () => {
    const { prisma, catalogo } = crearPrisma();
    prisma.configuracionNegocio.findUnique.mockResolvedValue(null);

    expect(await catalogo.zonaHoraria()).toBe('UTC');
  });
});
