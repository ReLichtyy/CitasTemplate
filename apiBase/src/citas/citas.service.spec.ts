import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Role } from '../common/enums/role.enum.js';
import { CitasService } from './citas.service.js';
import type { CatalogoService } from '../catalogo/catalogo.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface.js';
import type { ReservarCitaDto } from './dto/reservar-cita.dto.js';
import type { OutboxService } from '../notificaciones/outbox.service.js';

// 2026-09-07 es lunes. 10:00 UTC = minuto 600, dentro de la franja 09:00-18:00.
const INICIO = '2026-09-07T10:00:00.000Z';

const SERVICIO = {
  id: 'srv-1',
  nombre: 'Corte',
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
  telefono: '88880001',
  rol: Role.CLIENTE,
};

const ADMIN: AuthenticatedUser = {
  userId: 'usr-adm',
  telefono: '88880002',
  rol: Role.ADMIN,
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
    usuario: {
      // Por id siempre existe; por telefono, no, que es el caso del invitado nuevo.
      findUnique: vi.fn(
        async ({ where }: { where: { id?: string; telefono?: string } }) =>
          where.id ? { id: where.id, activo: true } : null,
      ),
      create: vi.fn(async ({ data }: { data: object }) => ({
        id: 'usr-nuevo',
        ...data,
      })),
    },
    configuracionNegocio: {
      findUnique: vi.fn().mockResolvedValue({ zonaHoraria: 'UTC' }),
    },
    horarioAtencion: { findMany: vi.fn().mockResolvedValue([FRANJA_LUNES]) },
    restriccionHorario: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    servicioAdicional: { findMany: vi.fn().mockResolvedValue([]) },
    estadoCita: {
      findUnique: vi.fn(
        async ({ where }: { where: { codigo: string } }) =>
          ESTADOS[where.codigo],
      ),
    },
    cita: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      // Devuelve tambien lo que traeria el `include`, que es lo que lee el
      // comprobante de invitado.
      create: vi.fn(async ({ data }: { data: object }) => ({
        id: 'cita-1',
        ...data,
        estado: PENDIENTE,
        servicio: SERVICIO,
        empleado: {
          id: 'emp-1',
          usuario: { nombre: 'Ana', apellido: 'Rojas' },
        },
      })),
      update: vi.fn(async ({ data }: { data: object }) => ({
        id: 'cita-1',
        ...data,
      })),
    },
  };

  const prisma = {
    ...tx,
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };

  return { prisma: prisma as unknown as PrismaService, tx };
}

/**
 * Notificaciones falsas. La reserva las llama dentro de su transaccion, y lo unico
 * que estas pruebas quieren saber de ellas es eso: que reciben el mismo `tx`. Lo que
 * hagan de verdad es asunto de 09-conexion-whatsapp.md.
 */
function crearServicio(prisma: PrismaService) {
  const outbox = { encolarConfirmacion: vi.fn().mockResolvedValue(true) };
  // La zona y el catalogo de estados ya no se leen dentro de la transaccion: los sirve
  // `CatalogoService`, que cachea las dos tablas de configuracion.
  const catalogo = {
    zonaHoraria: vi.fn().mockResolvedValue('UTC'),
    estado: vi.fn(async (codigo: string) => ESTADOS[codigo]),
  };
  const servicio = new CitasService(
    prisma,
    outbox as unknown as OutboxService,
    catalogo as unknown as CatalogoService,
  );
  return { servicio, outbox, catalogo };
}

describe('CitasService.reservar', () => {
  it('calcula el fin con la duracion del servicio y ocupa el slot', async () => {
    const { prisma, tx } = crearPrisma();

    await crearServicio(prisma).servicio.reservar(dtoBase, CLIENTE);

    const { data } = tx.cita.create.mock.calls[0][0];
    expect(data.fin.toISOString()).toBe('2026-09-07T11:00:00.000Z');
    // El estado inicial bloquea, asi que slotOcupado es espejo de inicio. Ver 02-reservas-concurrencia.md.
    expect(data.slotOcupado).toEqual(data.inicio);
    expect(data.estadoId).toBe(PENDIENTE.id);
  });

  /**
   * Lo que esta prueba protege no es un resultado sino el **tamaño** de la
   * transaccion. `ConfiguracionNegocio` y `EstadoCita` son configuracion, no datos de
   * la carrera: leerlas con el `tx` sostenia locks durante dos viajes a la base que no
   * hacian falta. Las sirve `CatalogoService` desde su cache. Ver
   * 02-reservas-concurrencia.md y catalogo.service.ts.
   */
  it('no lee configuracion ni catalogo de estados dentro de la transaccion', async () => {
    const { prisma, tx } = crearPrisma();

    await crearServicio(prisma).servicio.reservar(dtoBase, CLIENTE);

    expect(tx.configuracionNegocio.findUnique).not.toHaveBeenCalled();
    expect(tx.estadoCita.findUnique).not.toHaveBeenCalled();
  });

  it('recalcula los importes desde la base: los adicionales suman costo y no duracion', async () => {
    const { prisma, tx } = crearPrisma();
    tx.servicioAdicional.findMany.mockResolvedValue([
      { id: 'ad-1', precio: new Prisma.Decimal('10.50'), activo: true },
      { id: 'ad-2', precio: new Prisma.Decimal('4.50'), activo: true },
    ]);

    await crearServicio(prisma).servicio.reservar(
      { ...dtoBase, adicionalIds: ['ad-1', 'ad-2'] },
      CLIENTE,
    );

    const { data } = tx.cita.create.mock.calls[0][0];
    expect(data.precioServicio.toString()).toBe('50');
    expect(data.costoAdicionales.toString()).toBe('15');
    expect(data.costoTotal.toString()).toBe('65');
    // La duracion no se mueve.
    expect(data.fin.toISOString()).toBe('2026-09-07T11:00:00.000Z');
  });

  it('rechaza un horario fuera de la franja de atencion', async () => {
    const { prisma } = crearPrisma();
    const { servicio } = crearServicio(prisma);

    // 17:30 + 60 min = 18:30, pasado el cierre.
    await expect(
      servicio.reservar(
        { ...dtoBase, inicio: '2026-09-07T17:30:00.000Z' },
        CLIENTE,
      ),
    ).rejects.toThrow('fuera del horario de atencion');
  });

  it('rechaza un dia sin franjas activas', async () => {
    const { prisma, tx } = crearPrisma();
    tx.horarioAtencion.findMany.mockResolvedValue([]);

    await expect(
      crearServicio(prisma).servicio.reservar(dtoBase, CLIENTE),
    ).rejects.toThrow('no atiende ese dia');
  });

  it('rechaza el traslape con otra cita del mismo empleado', async () => {
    const { prisma, tx } = crearPrisma();
    tx.cita.findFirst.mockResolvedValue({ id: 'cita-existente' });

    await expect(
      crearServicio(prisma).servicio.reservar(dtoBase, CLIENTE),
    ).rejects.toThrow('Ese horario ya esta tomado');

    // Solo cuentan los estados que bloquean disponibilidad, y solo ese empleado.
    expect(tx.cita.findFirst.mock.calls[0][0].where).toMatchObject({
      empleadoId: 'emp-1',
      estado: { bloqueaDisponibilidad: true },
    });
  });

  it('rechaza un bloqueo de agenda que traslapa', async () => {
    const { prisma, tx } = crearPrisma();
    tx.restriccionHorario.findFirst.mockResolvedValue({ id: 'res-1' });

    await expect(
      crearServicio(prisma).servicio.reservar(dtoBase, CLIENTE),
    ).rejects.toThrow('bloqueado en la agenda');

    // Cuenta la restriccion general (empleadoId nulo) tanto como la del empleado.
    expect(tx.restriccionHorario.findFirst.mock.calls[0][0].where.OR).toEqual([
      { empleadoId: null },
      { empleadoId: 'emp-1' },
    ]);
  });

  it('rechaza un servicio que ese empleado no realiza', async () => {
    const { prisma, tx } = crearPrisma();
    tx.servicio.findUnique.mockResolvedValue({
      ...SERVICIO,
      empleados: [{ id: 'emp-otro' }],
    });

    await expect(
      crearServicio(prisma).servicio.reservar(dtoBase, CLIENTE),
    ).rejects.toThrow('no realiza ese servicio');
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

    const promesa = crearServicio(prisma).servicio.reservar(dtoBase, CLIENTE);
    await expect(promesa).rejects.toBeInstanceOf(ConflictException);
    await expect(promesa).rejects.toThrow('Ese horario ya esta tomado');
  });

  it('ignora el clienteId que manda un CLIENTE y reserva a su nombre', async () => {
    const { prisma, tx } = crearPrisma();

    await crearServicio(prisma).servicio.reservar(
      { ...dtoBase, clienteId: 'usr-ajeno' },
      CLIENTE,
    );

    const { data } = tx.cita.create.mock.calls[0][0];
    expect(data.clienteId).toBe(CLIENTE.userId);
    expect(data.registradaPorId).toBe(CLIENTE.userId);
  });

  it('deja que el personal reserve a nombre de otro sin perder quien digito', async () => {
    const { prisma, tx } = crearPrisma();

    await crearServicio(prisma).servicio.reservar(
      { ...dtoBase, clienteId: 'usr-cli' },
      ADMIN,
    );

    const { data } = tx.cita.create.mock.calls[0][0];
    expect(data.clienteId).toBe('usr-cli');
    expect(data.registradaPorId).toBe(ADMIN.userId);
  });
});

describe('CitasService.reservar sin sesion', () => {
  const datosInvitado = {
    cliente: { telefono: '+506 8888-8888', nombre: 'Ana', apellido: 'Rojas' },
  };

  it('exige los datos de contacto cuando no hay token', async () => {
    const { prisma } = crearPrisma();

    await expect(crearServicio(prisma).servicio.reservar(dtoBase)).rejects.toThrow(
      'datos de contacto',
    );
  });

  it('crea la ficha del invitado con el telefono normalizado y sin contrasena', async () => {
    const { prisma, tx } = crearPrisma();

    await crearServicio(prisma).servicio.reservar({ ...dtoBase, ...datosInvitado });

    const { data } = tx.usuario.create.mock.calls[0][0];
    // Sin normalizar, el mismo numero escrito de otra forma crearia un cliente nuevo.
    expect(data.telefono).toBe('+50688888888');
    expect(data.nombre).toBe('Ana');
    expect(data.password).toBeUndefined();

    // El invitado se registra a si mismo: no hay nadie mas que digite.
    const cita = tx.cita.create.mock.calls[0][0].data;
    expect(cita.clienteId).toBe('usr-nuevo');
    expect(cita.registradaPorId).toBe('usr-nuevo');
  });

  it('cuelga la cita de la ficha existente sin reescribirla', async () => {
    const { prisma, tx } = crearPrisma();
    tx.usuario.findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; telefono?: string } }) =>
        where.telefono
          ? { id: 'usr-registrado', activo: true }
          : { id: where.id, activo: true },
    );

    await crearServicio(prisma).servicio.reservar({ ...dtoBase, ...datosInvitado });

    expect(tx.usuario.create).not.toHaveBeenCalled();
    expect(tx.cita.create.mock.calls[0][0].data.clienteId).toBe(
      'usr-registrado',
    );
  });

  it('no devuelve la ficha del titular del telefono en el comprobante', async () => {
    const { prisma, tx } = crearPrisma();
    tx.usuario.findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; telefono?: string } }) =>
        where.telefono
          ? { id: 'usr-registrado', activo: true }
          : { id: where.id, activo: true },
    );

    const comprobante = await crearServicio(prisma).servicio.reservar({
      ...dtoBase,
      ...datosInvitado,
    });

    // Si el telefono ya era de un cliente registrado, devolver su `cliente` haria de
    // la reserva de invitado una consulta de datos ajenos.
    expect(comprobante).not.toHaveProperty('cliente');
    expect(comprobante).not.toHaveProperty('registradaPor');
    expect(comprobante).toHaveProperty('id', 'cita-1');
  });
});

describe('CitasService.update', () => {
  it('no hace competir a la cita consigo misma al reprogramar', async () => {
    const { prisma, tx } = crearPrisma();
    tx.cita.findUnique.mockResolvedValue(CITA_GUARDADA);

    await crearServicio(prisma).servicio.update(
      'cita-1',
      { inicio: '2026-09-07T12:00:00.000Z' },
      ADMIN,
    );

    expect(tx.cita.findFirst.mock.calls[0][0].where.id).toEqual({
      not: 'cita-1',
    });
    expect(tx.cita.update.mock.calls[0][0].data.slotOcupado.toISOString()).toBe(
      '2026-09-07T12:00:00.000Z',
    );
  });

  it('libera el slot al pasar a un estado que no bloquea, y no revalida el horario', async () => {
    const { prisma, tx } = crearPrisma();
    tx.cita.findUnique.mockResolvedValue(CITA_GUARDADA);

    await crearServicio(prisma).servicio.update(
      'cita-1',
      { estadoCodigo: 'CANCELADA' },
      ADMIN,
    );

    expect(tx.cita.update.mock.calls[0][0].data.slotOcupado).toBeNull();
    expect(tx.cita.findFirst).not.toHaveBeenCalled();
  });
});

describe('CitasService.cancelar', () => {
  const citaConfirmada = {
    id: 'cita-1',
    inicio: new Date(INICIO),
    estado: CONFIRMADA,
  };

  it('suelta slotOcupado, que es lo que devuelve el espacio a la agenda', async () => {
    const { prisma, tx } = crearPrisma();
    tx.cita.findUnique.mockResolvedValue({
      ...citaConfirmada,
      estado: PENDIENTE,
    });

    await crearServicio(prisma).servicio.cancelar(
      'cita-1',
      { motivo: 'imprevisto' },
      CLIENTE,
    );

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
      crearServicio(cliente.prisma).servicio.cancelar('cita-1', {}, CLIENTE),
    ).rejects.toBeInstanceOf(ConflictException);

    // ...pero el personal si, que es justo lo que el sistema anterior no cubria.
    const admin = crearPrisma();
    admin.tx.cita.findUnique.mockResolvedValue(citaConfirmada);
    await expect(
      crearServicio(admin.prisma).servicio.cancelar('cita-1', {}, ADMIN),
    ).resolves.toBeDefined();
  });
});

describe('CitasService.findAll', () => {
  it('acota la lista al dueño segun el rol', async () => {
    const admin = crearPrisma();
    await crearServicio(admin.prisma).servicio.findAll(ADMIN);
    expect(admin.tx.cita.findMany.mock.calls[0][0].where).toEqual({});

    const cliente = crearPrisma();
    await crearServicio(cliente.prisma).servicio.findAll(CLIENTE);
    expect(cliente.tx.cita.findMany.mock.calls[0][0].where).toEqual({
      clienteId: 'usr-cli',
    });
  });

  it('no muestra nada a un EMPLEADO sin ficha de empleado', async () => {
    const { prisma, tx } = crearPrisma();
    tx.empleado.findUnique.mockResolvedValue(null);

    await crearServicio(prisma).servicio.findAll({
      userId: 'usr-emp',
      telefono: '88880003',
      rol: Role.EMPLEADO,
    });

    // Un `where` vacio aqui le enseñaria la agenda de todo el mundo.
    expect(tx.cita.findMany.mock.calls[0][0].where).toEqual({ id: { in: [] } });
  });
});

describe('CitasService.reservar · outbox', () => {
  it('encola el aviso dentro de la misma transaccion que crea la cita', async () => {
    const { prisma, tx } = crearPrisma();
    const { servicio, outbox } = crearServicio(prisma);

    await servicio.reservar(dtoBase, CLIENTE);

    // El mismo cliente transaccional: si aqui llegara `prisma`, el INSERT del outbox
    // quedaria fuera de la transaccion y una reserva revertida dejaria un aviso vivo.
    const [clienteTx, aviso] = outbox.encolarConfirmacion.mock.calls[0];
    expect(clienteTx).toBe(tx);
    expect(aviso.id).toBe('cita-1');
  });

  /**
   * El aviso viaja armado, no como un id: releer la cita desde el outbox eran cuatro
   * consultas mas con la transaccion abierta. `aceptaWhatsapp` es el unico dato que no
   * vuelve del INSERT, y sale de la consulta que `resolverCliente` ya hacia.
   */
  it('le pasa al outbox los datos del aviso, sin releer la cita', async () => {
    const { prisma, tx } = crearPrisma();
    tx.usuario.findUnique.mockResolvedValue({
      id: 'usr-cli',
      activo: true,
      nombre: 'Marta',
      telefono: '88880001',
      aceptaWhatsapp: true,
    });
    const { servicio, outbox } = crearServicio(prisma);

    await servicio.reservar(dtoBase, CLIENTE);

    const [, aviso] = outbox.encolarConfirmacion.mock.calls[0];
    expect(aviso.cliente).toMatchObject({
      nombre: 'Marta',
      telefono: '88880001',
      aceptaWhatsapp: true,
    });
    expect(aviso.servicio.nombre).toBe(SERVICIO.nombre);
    expect(aviso.empleado.usuario.nombre).toBe('Ana');
    // La cita no se vuelve a leer: el INSERT ya la devolvio con su `include`.
    expect(tx.cita.findUnique).not.toHaveBeenCalled();
  });
});
