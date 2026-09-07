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
  {
    id: '11111111-1111-4111-8111-000000000005',
    telefono: '50600000005',
    nombre: 'Diana',
    apellido: 'Solis',
    rol: 'EMPLEADO' as const,
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    telefono: '50600000006',
    nombre: 'Erik',
    apellido: null,
    rol: 'EMPLEADO' as const,
  },
];

/**
 * Varias especialidades y no una sola: con una, la segunda linea de EspecialistaCard dice
 * lo mismo en todas las cards y no se ve si el componente la usa de verdad.
 */
const ESPECIALIDADES = [
  {
    id: '22222222-2222-4222-8222-000000000001',
    nombre: 'General',
    descripcion: 'Atiende el catalogo completo.',
  },
  {
    id: '22222222-2222-4222-8222-000000000002',
    nombre: 'Diagnostico',
    descripcion: 'Primera valoracion y plan de trabajo.',
  },
  {
    id: '22222222-2222-4222-8222-000000000003',
    nombre: 'Seguimiento',
    descripcion: 'Acompanamiento en sesiones sucesivas.',
  },
];

/**
 * Los ids son UUID fijos y escritos a mano, no generados: los DTOs de citas validan
 * IsUUID, y fijarlos es lo que hace que la semilla sea idempotente y que estos ids se
 * puedan pegar en una prueba manual.
 *
 * Las fotos salen de picsum.photos con una semilla estable, asi que la misma persona
 * conserva su cara entre siembras. Es una dependencia de red: sin internet no cargan y se
 * ve el reemplazo por iniciales, que tambien es un camino que conviene ver.
 *
 * Erik va sin foto y sin especialidad a proposito. Un catalogo de ejemplo donde todo esta
 * completo esconde justamente los casos que rompen una rejilla.
 */
const EMPLEADOS = [
  {
    id: '33333333-3333-4333-8333-000000000001',
    usuarioId: '11111111-1111-4111-8111-000000000002',
    especialidadId: '22222222-2222-4222-8222-000000000002',
    fotoUrl: 'https://picsum.photos/seed/ana-rojas/320/320',
    bio: 'Doce anios atendiendo primeras visitas. Empieza por escuchar el caso completo antes de proponer un plan, y deja por escrito lo acordado.',
  },
  {
    id: '33333333-3333-4333-8333-000000000002',
    usuarioId: '11111111-1111-4111-8111-000000000003',
    especialidadId: '22222222-2222-4222-8222-000000000003',
    fotoUrl: 'https://picsum.photos/seed/bruno-mora/320/320',
    bio: 'Trabaja sobre todo con clientes que ya vienen en seguimiento. Prefiere sesiones largas y espaciadas antes que muchas sesiones cortas.',
  },
  {
    id: '33333333-3333-4333-8333-000000000003',
    usuarioId: '11111111-1111-4111-8111-000000000005',
    especialidadId: '22222222-2222-4222-8222-000000000001',
    fotoUrl: 'https://picsum.photos/seed/diana-solis/320/320',
    bio: 'Atiende todo el catalogo. Disponible sabados, que es cuando se llena la agenda entre semana.',
  },
  {
    id: '33333333-3333-4333-8333-000000000004',
    usuarioId: '11111111-1111-4111-8111-000000000006',
    especialidadId: null,
    fotoUrl: null,
    bio: null,
  },
];

/**
 * Catalogo de ejemplo. Deliberadamente disparejo:
 *
 * - Ningun servicio lo realizan todos: es lo que hace visible el filtro por profesional al
 *   reservar, y la regla "ese profesional no realiza ese servicio".
 * - Dos servicios van sin imagen, para ver como se comporta la card sin ella.
 * - Las duraciones no son todas multiplos redondos del paso de 15 minutos, para que la
 *   grilla de horarios no salga siempre alineada por casualidad.
 */
const SERVICIOS = [
  {
    id: '44444444-4444-4444-8444-000000000001',
    nombre: 'Consulta inicial',
    descripcion:
      'Primera visita. Se revisa el caso, se aclaran dudas y se sale con un plan de trabajo escrito.',
    duracionMinutos: 30,
    precio: '25.00',
    imagenUrl: 'https://picsum.photos/seed/consulta-inicial/640/360',
    empleados: [
      '33333333-3333-4333-8333-000000000001',
      '33333333-3333-4333-8333-000000000003',
      '33333333-3333-4333-8333-000000000004',
    ],
  },
  {
    id: '44444444-4444-4444-8444-000000000002',
    nombre: 'Sesion estandar',
    descripcion: 'Sesion de seguimiento sobre un plan ya definido.',
    duracionMinutos: 60,
    precio: '45.00',
    imagenUrl: 'https://picsum.photos/seed/sesion-estandar/640/360',
    empleados: [
      '33333333-3333-4333-8333-000000000001',
      '33333333-3333-4333-8333-000000000002',
      '33333333-3333-4333-8333-000000000003',
    ],
  },
  {
    id: '44444444-4444-4444-8444-000000000003',
    nombre: 'Sesion extendida',
    descripcion:
      'Sesion larga para casos que no entran en una hora. Requiere disponibilidad especial.',
    duracionMinutos: 90,
    precio: '80.00',
    imagenUrl: 'https://picsum.photos/seed/sesion-extendida/640/360',
    empleados: ['33333333-3333-4333-8333-000000000002'],
  },
  {
    id: '44444444-4444-4444-8444-000000000004',
    nombre: 'Revision rapida',
    descripcion: 'Veinte minutos para resolver un punto puntual, sin abrir el caso completo.',
    duracionMinutos: 20,
    precio: '15.00',
    imagenUrl: null,
    empleados: ['33333333-3333-4333-8333-000000000003', '33333333-3333-4333-8333-000000000004'],
  },
  {
    id: '44444444-4444-4444-8444-000000000005',
    nombre: 'Valoracion a distancia',
    descripcion: 'Misma valoracion inicial, por videollamada. El enlace llega al confirmar.',
    duracionMinutos: 45,
    precio: '30.00',
    imagenUrl: 'https://picsum.photos/seed/valoracion-distancia/640/360',
    empleados: ['33333333-3333-4333-8333-000000000001', '33333333-3333-4333-8333-000000000002'],
  },
  {
    id: '44444444-4444-4444-8444-000000000006',
    nombre: 'Sesion de cierre',
    descripcion: 'Ultima sesion del plan: se repasa lo hecho y se entrega el resumen final.',
    duracionMinutos: 45,
    precio: '40.00',
    imagenUrl: null,
    empleados: ['33333333-3333-4333-8333-000000000002', '33333333-3333-4333-8333-000000000003'],
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
  {
    id: '55555555-5555-4555-8555-000000000003',
    nombre: 'Sesion grabada',
    descripcion: 'Grabacion de la sesion, disponible durante treinta dias.',
    precio: '8.00',
  },
];

/**
 * Resenas de ejemplo, todas publicadas: el catalogo publico solo muestra las moderadas y
 * sin eso no se veria ninguna.
 *
 * Erik queda sin resenas a proposito: es el caso que distingue "sin opiniones" de "mal
 * calificado", y la card tiene que resolverlo sin pintar un cero.
 */
const RESENAS = [
  {
    id: '66666666-6666-4666-8666-000000000001',
    empleadoId: '33333333-3333-4333-8333-000000000001',
    autor: 'Marcela V.',
    puntuacion: 5,
    comentario: 'Puntual y muy clara. Explico las opciones antes de decidir nada.',
    fecha: '2026-08-28',
  },
  {
    id: '66666666-6666-4666-8666-000000000002',
    empleadoId: '33333333-3333-4333-8333-000000000001',
    autor: 'Diego S.',
    puntuacion: 5,
    comentario: 'Sali con el plan por escrito el mismo dia. Es la tercera vez que vuelvo.',
    fecha: '2026-08-14',
  },
  {
    id: '66666666-6666-4666-8666-000000000003',
    empleadoId: '33333333-3333-4333-8333-000000000001',
    autor: 'Karla M.',
    puntuacion: 4,
    comentario: 'Muy buen resultado, aunque la cita arranco unos minutos tarde.',
    fecha: '2026-07-30',
  },
  {
    id: '66666666-6666-4666-8666-000000000004',
    empleadoId: '33333333-3333-4333-8333-000000000001',
    autor: 'Ivan P.',
    puntuacion: 5,
    comentario: 'Se tomo el tiempo de responder todo. No senti que me apuraran.',
    fecha: '2026-06-19',
  },
  {
    id: '66666666-6666-4666-8666-000000000005',
    empleadoId: '33333333-3333-4333-8333-000000000002',
    autor: 'Lucia R.',
    puntuacion: 5,
    comentario: 'Prefiere sesiones largas y se nota: no queda nada a medias.',
    fecha: '2026-09-01',
  },
  {
    id: '66666666-6666-4666-8666-000000000006',
    empleadoId: '33333333-3333-4333-8333-000000000002',
    autor: 'Pablo N.',
    puntuacion: 4,
    comentario: 'Buen seguimiento entre sesiones. La agenda cuesta un poco.',
    fecha: '2026-08-22',
  },
  {
    id: '66666666-6666-4666-8666-000000000007',
    empleadoId: '33333333-3333-4333-8333-000000000003',
    autor: 'Sofia T.',
    puntuacion: 3,
    comentario: 'Resolvio lo que necesitaba, pero la sesion se sintio corta.',
    fecha: '2026-08-05',
  },
  {
    id: '66666666-6666-4666-8666-000000000008',
    empleadoId: '33333333-3333-4333-8333-000000000003',
    autor: 'Hector L.',
    puntuacion: 5,
    comentario: 'Atiende sabados, que para mi es la unica opcion. Muy recomendable.',
    fecha: '2026-07-11',
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
      // CAMBIAR POR DESPLIEGUE: sin prefijo, un telefono guardado en forma local
      // ('88887777') no se entrega a ningun canal externo. Ver 09-conexion-whatsapp.md.
      prefijoPais: '+506',
      moneda: 'USD',
      locale: 'es',
    },
    update: {},
  });

  // Relleno, no reescritura: la identidad del negocio no se pisa, pero una fila que
  // viene de antes de que `prefijoPais` existiera se queda en NULL, y sin prefijo el
  // modulo de notificaciones no entrega un solo mensaje. Ver 09-conexion-whatsapp.md.
  await prisma.configuracionNegocio.updateMany({
    where: { id: 1, prefijoPais: null },
    data: { prefijoPais: '+506' },
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

  for (const especialidad of ESPECIALIDADES) {
    await prisma.especialidad.upsert({
      where: { nombre: especialidad.nombre },
      create: especialidad,
      update: { descripcion: especialidad.descripcion },
    });
  }

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

  for (const empleado of EMPLEADOS) {
    await prisma.empleado.upsert({
      where: { id: empleado.id },
      create: empleado,
      // La ficha se reescribe entera: la semilla es la fuente de verdad del catalogo de
      // ejemplo, incluidas la foto y la bio que alguien haya tocado a mano probando.
      update: { ...empleado, activo: true },
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

  for (const resena of RESENAS) {
    const fila = { ...resena, fecha: new Date(resena.fecha), publicada: true };
    await prisma.resena.upsert({
      where: { id: resena.id },
      create: fila,
      update: fila,
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
