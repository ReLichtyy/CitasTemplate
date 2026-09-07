/**
 * Semilla de catalogos. Ver 01-modelo-datos.md.
 *
 * Es idempotente: cada fila lleva un id fijo y se escribe con `upsert`, asi que
 * correrla dos veces no duplica nada y sirve para reparar un catalogo tocado a mano.
 *
 * Siembra lo que el producto necesita para funcionar (estados, horario de atencion,
 * identidad del negocio) mas un catalogo de ejemplo con el que recorrer la reserva de
 * punta a punta. Los servicios y las personas de ejemplo son datos, no estructura: se
 * borran cuando el negocio carga los suyos.
 */
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('Falta DATABASE_URL. Ver apiBase/.env.example.');
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

/**
 * Catalogo de estados. Es configuracion critica, no datos de referencia: los
 * indicadores deciden que se puede hacer con una cita. `PENDIENTE` y `CANCELADA` son
 * los dos codigos que CitasService busca por nombre — renombrarlos rompe la reserva.
 *
 * `bloqueaDisponibilidad` es lo que sostiene el invariante de `slotOcupado`: un estado
 * que no bloquea suelta el espacio del empleado aunque la fila siga viva.
 */
const ESTADOS = [
  {
    codigo: 'PENDIENTE',
    nombre: 'Pendiente',
    bloqueaDisponibilidad: true,
    permiteEdicion: true,
    permiteCancelacionCliente: true,
    permiteCancelacionPersonal: true,
    esFinal: false,
    orden: 1,
  },
  {
    // Confirmada la cancela el personal, no el cliente. Los dos indicadores estan
    // separados justamente por esto (deuda ESC-03 del sistema anterior).
    codigo: 'CONFIRMADA',
    nombre: 'Confirmada',
    bloqueaDisponibilidad: true,
    permiteEdicion: true,
    permiteCancelacionCliente: false,
    permiteCancelacionPersonal: true,
    esFinal: false,
    orden: 2,
  },
  {
    codigo: 'ATENDIDA',
    nombre: 'Atendida',
    bloqueaDisponibilidad: false,
    permiteEdicion: false,
    permiteCancelacionCliente: false,
    permiteCancelacionPersonal: false,
    esFinal: true,
    orden: 3,
  },
  {
    codigo: 'CANCELADA',
    nombre: 'Cancelada',
    bloqueaDisponibilidad: false,
    permiteEdicion: false,
    permiteCancelacionCliente: false,
    permiteCancelacionPersonal: false,
    esFinal: true,
    orden: 4,
  },
  {
    codigo: 'NO_ASISTIO',
    nombre: 'No asistio',
    bloqueaDisponibilidad: false,
    permiteEdicion: false,
    permiteCancelacionCliente: false,
    permiteCancelacionPersonal: false,
    esFinal: true,
    orden: 5,
  },
];

/** Minutos desde medianoche. Dos franjas en un mismo dia = turno partido. */
const H = (hora: number, minuto = 0) => hora * 60 + minuto;

const DIAS_HABILES = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
] as const;

const USUARIOS = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    telefono: '50600000001',
    nombre: 'Admin',
    apellido: 'Del Negocio',
    rol: 'ADMIN' as const,
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    telefono: '50600000002',
    nombre: 'Ana',
    apellido: 'Rojas',
    rol: 'EMPLEADO' as const,
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    telefono: '50600000003',
    nombre: 'Bruno',
    apellido: 'Mora',
    rol: 'EMPLEADO' as const,
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    telefono: '50600000004',
    nombre: 'Carla',
    apellido: 'Vega',
    rol: 'CLIENTE' as const,
  },
];

/**
 * Los ids son UUID fijos y escritos a mano, no generados: los DTOs de citas validan
 * `@IsUUID`, y fijarlos es lo que hace que la semilla sea idempotente y que estos ids
 * se puedan pegar en una prueba manual.
 */
const EMPLEADOS = [
  {
    id: '33333333-3333-4333-8333-000000000001',
    usuarioId: '11111111-1111-4111-8111-000000000002',
  },
  {
    id: '33333333-3333-4333-8333-000000000002',
    usuarioId: '11111111-1111-4111-8111-000000000003',
  },
];

const SERVICIOS = [
  {
    id: '44444444-4444-4444-8444-000000000001',
    nombre: 'Consulta inicial',
    descripcion: 'Primera visita: diagnostico y plan de trabajo.',
    duracionMinutos: 30,
    precio: '25.00',
    empleados: ['33333333-3333-4333-8333-000000000001', '33333333-3333-4333-8333-000000000002'],
  },
  {
    id: '44444444-4444-4444-8444-000000000002',
    nombre: 'Sesion estandar',
    descripcion: 'Sesion de seguimiento.',
    duracionMinutos: 60,
    precio: '45.00',
    empleados: ['33333333-3333-4333-8333-000000000001', '33333333-3333-4333-8333-000000000002'],
  },
  {
    id: '44444444-4444-4444-8444-000000000003',
    nombre: 'Sesion extendida',
    descripcion: 'Sesion larga, requiere disponibilidad especial.',
    duracionMinutos: 90,
    // Un servicio que no todos realizan: sin esto no hay como probar la regla
    // "el profesional seleccionado no realiza ese servicio".
    precio: '80.00',
    empleados: ['33333333-3333-4333-8333-000000000001'],
  },
];

const ADICIONALES = [
  {
    id: '55555555-5555-4555-8555-000000000001',
    nombre: 'Informe escrito',
    descripcion: 'Resumen de la sesion enviado por correo.',
    precio: '10.00',
  },
  {
    id: '55555555-5555-4555-8555-000000000002',
    nombre: 'Atencion prioritaria',
    descripcion: 'Contacto directo entre sesiones.',
    precio: '15.00',
  },
];

async function main() {
  // Identidad del negocio. Fila unica, id = 1. Es el unico lugar donde el producto
  // deja de ser generico.
  await prisma.configuracionNegocio.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      nombre: 'Negocio Demo',
      eslogan: 'Agenda tu cita en linea',
      // CAMBIAR POR DESPLIEGUE: toda hora se interpreta en esta zona, incluidas las
      // franjas de atencion de abajo.
      zonaHoraria: 'America/Costa_Rica',
      moneda: 'USD',
      locale: 'es',
    },
    update: {},
  });

  for (const estado of ESTADOS) {
    await prisma.estadoCita.upsert({
      where: { codigo: estado.codigo },
      create: { id: `est-${estado.codigo.toLowerCase()}`, ...estado },
      // Los indicadores si se reescriben: son configuracion, y la semilla es la
      // fuente de verdad de como se comporta cada estado.
      update: estado,
    });
  }

  for (const dia of DIAS_HABILES) {
    for (const [apertura, cierre] of [
      [H(8), H(12)],
      [H(13), H(18)],
    ]) {
      await prisma.horarioAtencion.upsert({
        where: { dia_minutoApertura: { dia, minutoApertura: apertura } },
        create: { dia, minutoApertura: apertura, minutoCierre: cierre },
        update: { minutoCierre: cierre, activo: true },
      });
    }
  }
  await prisma.horarioAtencion.upsert({
    where: { dia_minutoApertura: { dia: 'SABADO', minutoApertura: H(9) } },
    create: { dia: 'SABADO', minutoApertura: H(9), minutoCierre: H(13) },
    update: { minutoCierre: H(13), activo: true },
  });

  await prisma.especialidad.upsert({
    where: { nombre: 'General' },
    create: { id: '22222222-2222-4222-8222-000000000001', nombre: 'General' },
    update: {},
  });

  /**
   * Contrasena de las fichas de ejemplo. **Solo** si `SEED_PASSWORD` esta puesta: una
   * contrasena por defecto en la semilla es una cuenta de administrador conocida en toda
   * base que se siembre, incluida la del VPS. Sin la variable, las fichas quedan sin
   * contrasena y el login las rechaza, que es exactamente lo que debe pasar.
   */
  const passwordSemilla = process.env.SEED_PASSWORD;
  const passwordHash = passwordSemilla ? await hash(passwordSemilla, 12) : null;
  if (!passwordHash) {
    console.log(
      'Sin SEED_PASSWORD: las fichas de ejemplo quedan sin contrasena y no pueden iniciar sesion.',
    );
  }

  for (const usuario of USUARIOS) {
    await prisma.usuario.upsert({
      where: { telefono: usuario.telefono },
      create: { ...usuario, password: passwordHash },
      update: {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        // Una ficha que ya tiene contrasena no se pisa al resembrar salvo que se pida
        // explicitamente con la variable.
        ...(passwordHash ? { password: passwordHash } : {}),
      },
    });
  }

  for (const { id, usuarioId } of EMPLEADOS) {
    await prisma.empleado.upsert({
      where: { id },
      create: {
        id,
        usuarioId,
        especialidadId: '22222222-2222-4222-8222-000000000001',
        bio: 'Profesional del equipo.',
      },
      update: { activo: true },
    });
  }

  for (const { empleados, ...servicio } of SERVICIOS) {
    await prisma.servicio.upsert({
      where: { id: servicio.id },
      create: { ...servicio, empleados: { connect: empleados.map((id) => ({ id })) } },
      // `set` y no `connect`: la semilla define la asignacion completa, asi que
      // volver a correrla tambien quita lo que ya no corresponde.
      update: { ...servicio, empleados: { set: empleados.map((id) => ({ id })) } },
    });
  }

  for (const adicional of ADICIONALES) {
    await prisma.servicioAdicional.upsert({
      where: { id: adicional.id },
      create: adicional,
      update: adicional,
    });
  }

  console.log('Semilla aplicada.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
