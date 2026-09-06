import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Role } from '../common/enums/role.enum.js';
import { CitasService } from './citas.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface.js';
import type { ReservarCitaDto } from './dto/reservar-cita.dto.js';

// 2026-09-07 es lunes. 10:00 UTC = minuto 600, dentro de la franja 09:00-18:00.
const INICIO = '2026-09-07T10:00:00.000Z';

const SERVICIO = {
  id: 'srv-1',
  activo: true,
  duracionMinutos: 60,
  precio: new Prisma.Decimal('50.00'),
  empleados: [{ id: 'emp-1' }],
};

const EMPLEADO = { id: 'emp-1', activo: true, usuarioId: 'usr-emp' };

const FRANJA_LUNES = {
  id: 'hor-1',
  dia: 'LUNES',
  minutoApertura: 9 * 60,
  minutoCierre: 18 * 60,
  activo: true,
};

const PENDIENTE = {
  id: 'est-pen',
  codigo: 'PENDIENTE',
  nombre: 'Pendiente',
  bloqueaDisponibilidad: true,
  permiteEdicion: true,
  permiteCancelacionCliente: true,
  permiteCancelacionPersonal: true,
  esFinal: false,
};

const CONFIRMADA = {
  ...PENDIENTE,
  id: 'est-con',
  codigo: 'CONFIRMADA',
  nombre: 'Confirmada',
  permiteCancelacionCliente: false,
};

const CANCELADA = {
  id: 'est-can',
  codigo: 'CANCELADA',
  nombre: 'Cancelada',
  bloqueaDisponibilidad: false,
  permiteEdicion: false,
  permiteCancelacionCliente: false,
  permiteCancelacionPersonal: false,
  esFinal: true,
};

const ESTADOS: Record<string, unknown> = { PENDIENTE, CONFIRMADA, CANCELADA };

const CLIENTE: AuthenticatedUser = {
  userId: 'usr-cli',
  email: 'cliente@ejemplo.test',
  role: Role.CLIENTE,
};

const ADMIN: AuthenticatedUser = {
  userId: 'usr-adm',
  email: 'admin@ejemplo.test',
  role: Role.ADMIN,
};

const dtoBase: ReservarCitaDto = {
  servicioId: 'srv-1',
  empleadoId: 'emp-1',
  inicio: INICIO,
};

const CITA_GUARDADA = {
  id: 'cita-1',
  servicioId: 'srv-1',
  empleadoId: 'emp-1',
  inicio: new Date(INICIO),
  precioServicio: new Prisma.Decimal('50.00'),
  costoAdicionales: new Prisma.Decimal('0'),
  notas: null,
  estado: PENDIENTE,
};

/**
 * Doble de Prisma. `$transaction` ejecuta la retrollamada con el mismo objeto, que
 * es lo que permite comprobar que verificacion e insercion ocurren en la misma
 * unidad de trabajo sin levantar una base.
 */
function crearPrisma() {
  const tx = {
    servicio: { findUnique: vi.fn().mockResolvedValue(SERVICIO) },
    empleado: { findUnique: vi.fn().mockResolvedValue(EMPLEADO) },
    usuario: { findUnique: vi.fn().mockResolvedValue({ id: 'usr-cli', activo: true }) },
    configuracionNegocio: { findUnique: vi.fn().mockResolvedValue({ zonaHoraria: 'UTC' }) },
    horarioAtencion: { findMany: vi.fn().mockResolvedValue([FRANJA_LUNES]) },
    restriccionHorario: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    servicioAdicional: { findMany: vi.fn().mockResolvedValue([]) },
    estadoCita: {
      findUnique: vi.fn(async ({ where }: { where: { codigo: string } }) => ESTADOS[where.codigo]),
    },
    cita: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: 'cita-1', ...data })),
      update: vi.fn(async ({ data }: { data: object }) => ({ id: 'cita-1', ...data })),
    },
  };

  const prisma = {
    ...tx,
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };

  return { prisma: prisma as unknown as PrismaService, tx };
}

describe('CitasService.reservar', () => {
  it('calcula el fin con la duracion del servicio y ocupa el slot', async () => {
    const { prisma, tx } = crearPrisma();

    await new CitasService(prisma).reservar(dtoBase, CLIENTE);

    const { data } = tx.cita.create.mock.calls[0][0];
    expect(data.fin.toISOString()).toBe('2026-09-07T11:00:00.000Z');
    // El estado inicial bloquea, asi que slotOcupado es espejo de inicio. Ver spec/02.
    expect(data.slotOcupado).toEqual(data.inicio);
    expect(data.estadoId).toBe(PENDIENTE.id);
  });

  it('recalcula los importes desde la base: los adicionales suman costo y no duracion', async () => {
    const { prisma, tx } = crearPrisma();
    tx.servicioAdicional.findMany.mockResolvedValue([
      { id: 'ad-1', precio: new Prisma.Decimal('10.50'), activo: true },
      { id: 'ad-2', precio: new Prisma.Decimal('4.50'), activo: true },
    ]);

    await new CitasService(prisma).reservar({ ...dtoBase, adicionalIds: ['ad-1', 'ad-2'] }, CLIENTE);

    const { data } = tx.cita.create.mock.calls[0][0];
    expect(data.precioServicio.toString()).toBe('50');
    expect(data.costoAdicionales.toString()).toBe('15');
    expect(data.costoTotal.toString()).toBe('65');
    // La duracion no se mueve.
    expect(data.fin.toISOString()).toBe('2026-09-07T11:00:00.000Z');
  });

  it('rechaza un horario fuera de la franja de atencion', async () => {
    const { prisma } = crearPrisma();
    const servicio = new CitasService(prisma);

    // 17:30 + 60 min = 18:30, pasado el cierre.
    await expect(
      servicio.reservar({ ...dtoBase, inicio: '2026-09-07T17:30:00.000Z' }, CLIENTE),
    ).rejects.toThrow('fuera del horario de atencion');
  });

  it('rechaza un dia sin franjas activas', async () => {
    const { prisma, tx } = crearPrisma();
    tx.horarioAtencion.findMany.mockResolvedValue([]);

    await expect(new CitasService(prisma).reservar(dtoBase, CLIENTE)).rejects.toThrow(
      'no atiende ese dia',
    );
  });

  it('rechaza el traslape con otra cita del mismo empleado', async () => {
    const { prisma, tx } = crearPrisma();
    tx.cita.findFirst.mockResolvedValue({ id: 'cita-existente' });

    await expect(new CitasService(prisma).reservar(dtoBase, CLIENTE)).rejects.toThrow(
      'Ese horario ya esta tomado',
    );

    // Solo cuentan los estados que bloquean disponibilidad, y solo ese empleado.
    expect(tx.cita.findFirst.mock.calls[0][0].where).toMatchObject({
      empleadoId: 'emp-1',
      estado: { bloqueaDisponibilidad: true },
    });
  });

  it('rechaza un bloqueo de agenda que traslapa', async () => {
    const { prisma, tx } = crearPrisma();
    tx.restriccionHorario.findFirst.mockResolvedValue({ id: 'res-1' });

    await expect(new CitasService(prisma).reservar(dtoBase, CLIENTE)).rejects.toThrow(
      'bloqueado en la agenda',
    );

    // Cuenta la restriccion general (empleadoId nulo) tanto como la del empleado.
    expect(tx.restriccionHorario.findFirst.mock.calls[0][0].where.OR).toEqual([
      { empleadoId: null },
      { empleadoId: 'emp-1' },
    ]);
  });

  it('rechaza un servicio que ese empleado no realiza', async () => {
    const { prisma, tx } = crearPrisma();
    tx.servicio.findUnique.mockResolvedValue({ ...SERVICIO, empleados: [{ id: 'emp-otro' }] });

    await expect(new CitasService(prisma).reservar(dtoBase, CLIENTE)).rejects.toThrow(
      'no realiza ese servicio',
    );
  });

  it('traduce la violacion de unicidad al mismo error que un traslape', async () => {
    const { prisma, tx } = crearPrisma();
    // Lo que ocurre cuando dos clientes confirman el mismo horario a la vez y la
    // verificacion de los dos paso: lo atrapa @@unique([empleadoId, slotOcupado]).
    tx.cita.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.0.0',
      }),
    );

    const promesa = new CitasService(prisma).reservar(dtoBase, CLIENTE);
    await expect(promesa).rejects.toBeInstanceOf(ConflictException);
    await expect(promesa).rejects.toThrow('Ese horario ya esta tomado');
  });

  it('ignora el clienteId que manda un CLIENTE y reserva a su nombre', async () => {
    const { prisma, tx } = crearPrisma();

    await new CitasService(prisma).reservar({ ...dtoBase, clienteId: 'usr-ajeno' }, CLIENTE);

    const { data } = tx.cita.create.mock.calls[0][0];
    expect(data.clienteId).toBe(CLIENTE.userId);
    expect(data.registradaPorId).toBe(CLIENTE.userId);
  });

  it('deja que el personal reserve a nombre de otro sin perder quien digito', async () => {
    const { prisma, tx } = crearPrisma();

    await new CitasService(prisma).reservar({ ...dtoBase, clienteId: 'usr-cli' }, ADMIN);

    const { data } = tx.cita.create.mock.calls[0][0];
    expect(data.clienteId).toBe('usr-cli');
    expect(data.registradaPorId).toBe(ADMIN.userId);
  });
});

describe('CitasService.update', () => {
  it('no hace competir a la cita consigo misma al reprogramar', async () => {
    const { prisma, tx } = crearPrisma();
    tx.cita.findUnique.mockResolvedValue(CITA_GUARDADA);

    await new CitasService(prisma).update('cita-1', { inicio: '2026-09-07T12:00:00.000Z' }, ADMIN);

    expect(tx.cita.findFirst.mock.calls[0][0].where.id).toEqual({ not: 'cita-1' });
    expect(tx.cita.update.mock.calls[0][0].data.slotOcupado.toISOString()).toBe(
      '2026-09-07T12:00:00.000Z',
    );
  });

  it('libera el slot al pasar a un estado que no bloquea, y no revalida el horario', async () => {
    const { prisma, tx } = crearPrisma();
    tx.cita.findUnique.mockResolvedValue(CITA_GUARDADA);

    await new CitasService(prisma).update('cita-1', { estadoCodigo: 'CANCELADA' }, ADMIN);

    expect(tx.cita.update.mock.calls[0][0].data.slotOcupado).toBeNull();
    expect(tx.cita.findFirst).not.toHaveBeenCalled();
  });
});

describe('CitasService.cancelar', () => {
  const citaConfirmada = { id: 'cita-1', inicio: new Date(INICIO), estado: CONFIRMADA };

  it('suelta slotOcupado, que es lo que devuelve el espacio a la agenda', async () => {
    const { prisma, tx } = crearPrisma();
    tx.cita.findUnique.mockResolvedValue({ ...citaConfirmada, estado: PENDIENTE });

    await new CitasService(prisma).cancelar('cita-1', { motivo: 'imprevisto' }, CLIENTE);

    const { data } = tx.cita.update.mock.calls[0][0];
    expect(data.estadoId).toBe(CANCELADA.id);
    expect(data.slotOcupado).toBeNull();
    expect(data.motivoCancelacion).toBe('imprevisto');
  });

  it('separa la cancelacion del cliente de la del personal (deuda ESC-03)', async () => {
    const cliente = crearPrisma();
    cliente.tx.cita.findUnique.mockResolvedValue(citaConfirmada);

    // Una cita Confirmada ya no la cancela el cliente...
    await expect(
      new CitasService(cliente.prisma).cancelar('cita-1', {}, CLIENTE),
    ).rejects.toBeInstanceOf(ConflictException);

    // ...pero el personal si, que es justo lo que el sistema anterior no cubria.
    const admin = crearPrisma();
    admin.tx.cita.findUnique.mockResolvedValue(citaConfirmada);
    await expect(
      new CitasService(admin.prisma).cancelar('cita-1', {}, ADMIN),
    ).resolves.toBeDefined();
  });
});

describe('CitasService.findAll', () => {
  it('acota la lista al dueño segun el rol', async () => {
    const admin = crearPrisma();
    await new CitasService(admin.prisma).findAll(ADMIN);
    expect(admin.tx.cita.findMany.mock.calls[0][0].where).toEqual({});

    const cliente = crearPrisma();
    await new CitasService(cliente.prisma).findAll(CLIENTE);
    expect(cliente.tx.cita.findMany.mock.calls[0][0].where).toEqual({ clienteId: 'usr-cli' });
  });

  it('no muestra nada a un EMPLEADO sin ficha de empleado', async () => {
    const { prisma, tx } = crearPrisma();
    tx.empleado.findUnique.mockResolvedValue(null);

    await new CitasService(prisma).findAll({
      userId: 'usr-emp',
      email: 'emp@ejemplo.test',
      role: Role.EMPLEADO,
    });

    // Un `where` vacio aqui le enseñaria la agenda de todo el mundo.
    expect(tx.cita.findMany.mock.calls[0][0].where).toEqual({ id: { in: [] } });
  });
});
