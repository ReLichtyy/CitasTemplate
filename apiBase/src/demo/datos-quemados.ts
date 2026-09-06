/**
 * Catalogo quemado para trabajar sin base de datos.
 *
 * Anda detras de `PrismaService`, no dentro de React: asi el que decide sigue siendo
 * `CitasService` con sus cinco reglas, su transaccion y su indice unico, y lo que se
 * comprueba en pantalla es la validacion de verdad. `02-reservas-concurrencia.md` prohibe expresamente que
 * `ReservarPage` simule disponibilidad con mocks locales.
 *
 * Es andamiaje: se borra cuando corran la migracion y la semilla (01-modelo-datos.md).
 *
 * Los ids son UUID validos a proposito — `ReservarCitaDto` los valida con `@IsUUID()`,
 * asi que unos ids legibles tipo "srv-1" harian fallar la reserva con un 400 antes de
 * llegar a la logica que se quiere probar.
 */
import { Prisma } from '../generated/prisma/client.js';
import { instanteDesdeZona, partesEnZona } from '../common/tiempo.js';

export const ZONA_DEMO = 'America/Costa_Rica';

const SRV_CONSULTA = '11111111-1111-4111-8111-111111111111';
const SRV_SESION = '22222222-2222-4222-8222-222222222222';
const SRV_EXTENDIDA = '33333333-3333-4333-8333-333333333333';
const SRV_RETIRADO = '44444444-4444-4444-8444-444444444444';

const EMP_ANA = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const EMP_LUIS = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
const EMP_MARTA = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';

const USR_ANA = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
const USR_LUIS = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const USR_MARTA = 'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb';
const USR_CLIENTA = 'bbbbbbbb-9999-4999-8999-bbbbbbbbbbbb';

const AD_PRIORITARIA = 'cccccccc-1111-4111-8111-cccccccccccc';
const AD_INFORME = 'cccccccc-2222-4222-8222-cccccccccccc';

const EST_PENDIENTE = 'dddddddd-1111-4111-8111-dddddddddddd';
const EST_CONFIRMADA = 'dddddddd-2222-4222-8222-dddddddddddd';
const EST_COMPLETADA = 'dddddddd-3333-4333-8333-dddddddddddd';
const EST_CANCELADA = 'dddddddd-4444-4444-8444-dddddddddddd';

const ESPECIALIDAD = 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee';
const CITA_OCUPADA = 'ffffffff-1111-4111-8111-ffffffffffff';
const RESTRICCION_FERIADO = 'ffffffff-2222-4222-8222-ffffffffffff';
const RESTRICCION_ANA = 'ffffffff-3333-4333-8333-ffffffffffff';

const HORA = 60;

/** Dia N contando desde hoy, a esa hora de pared, en la zona del negocio. */
function dia(desplazamiento: number, minutos: number): Date {
  const hoy = partesEnZona(new Date(), ZONA_DEMO);
  return instanteDesdeZona(hoy.anio, hoy.mes, hoy.dia + desplazamiento, minutos, ZONA_DEMO);
}

const precio = (valor: string) => new Prisma.Decimal(valor);

/**
 * Se construye al arrancar el proceso para que las fechas sigan siendo relativas a
 * hoy: una cita quemada con fecha fija dejaria de estorbar al dia siguiente y el
 * traslape ya no se podria comprobar.
 */
export function crearDatosQuemados() {
  const ahora = new Date();

  return {
    configuracionNegocio: [
      {
        id: 1,
        nombre: 'Estudio Norte',
        eslogan: 'Reserve su espacio en menos de un minuto',
        logoUrl: null,
        colorAcento: '#aa3bff',
        terminoServicio: 'Servicio',
        terminoServicioPlural: 'Servicios',
        terminoEmpleado: 'Profesional',
        terminoEmpleadoPlural: 'Especialistas',
        telefonoContacto: '+50622000000',
        emailContacto: 'hola@ejemplo.test',
        direccion: null,
        moneda: 'CRC',
        locale: 'es-CR',
        zonaHoraria: ZONA_DEMO,
        actualizadoEn: ahora,
      },
    ],

    usuario: [
      { id: USR_ANA, telefono: '+50688880001', email: null, password: null, nombre: 'Ana', apellido: 'Rojas', rol: 'EMPLEADO', activo: true, creadoEn: ahora, actualizadoEn: ahora },
      { id: USR_LUIS, telefono: '+50688880002', email: null, password: null, nombre: 'Luis', apellido: 'Vargas', rol: 'EMPLEADO', activo: true, creadoEn: ahora, actualizadoEn: ahora },
      { id: USR_MARTA, telefono: '+50688880003', email: null, password: null, nombre: 'Marta', apellido: 'Solis', rol: 'EMPLEADO', activo: true, creadoEn: ahora, actualizadoEn: ahora },
      // Clienta ya registrada: reservar como invitado con este telefono debe colgar la
      // cita de esta ficha y no crear otra.
      { id: USR_CLIENTA, telefono: '+50670001234', email: 'clienta@ejemplo.test', password: null, nombre: 'Carmen', apellido: 'Mora', rol: 'CLIENTE', activo: true, creadoEn: ahora, actualizadoEn: ahora },
    ],

    especialidad: [{ id: ESPECIALIDAD, nombre: 'General', descripcion: null }],

    empleado: [
      { id: EMP_ANA, usuarioId: USR_ANA, especialidadId: ESPECIALIDAD, bio: 'Doce anos de oficio.', fotoUrl: null, activo: true },
      { id: EMP_LUIS, usuarioId: USR_LUIS, especialidadId: ESPECIALIDAD, bio: null, fotoUrl: null, activo: true },
      // Inactiva: no debe aparecer en el catalogo publico.
      { id: EMP_MARTA, usuarioId: USR_MARTA, especialidadId: ESPECIALIDAD, bio: null, fotoUrl: null, activo: false },
    ],

    servicio: [
      { id: SRV_CONSULTA, nombre: 'Consulta inicial', descripcion: 'Primera visita, para ver que hace falta.', duracionMinutos: 30, precio: precio('15000.00'), imagenUrl: null, activo: true },
      { id: SRV_SESION, nombre: 'Sesion completa', descripcion: 'La sesion estandar.', duracionMinutos: HORA, precio: precio('28000.00'), imagenUrl: null, activo: true },
      { id: SRV_EXTENDIDA, nombre: 'Sesion extendida', descripcion: 'Hora y media, para casos que lo piden.', duracionMinutos: 90, precio: precio('39000.00'), imagenUrl: null, activo: true },
      // Inactivo: no debe aparecer en el catalogo publico.
      { id: SRV_RETIRADO, nombre: 'Revision rapida', descripcion: null, duracionMinutos: 20, precio: precio('9000.00'), imagenUrl: null, activo: false },
    ],

    // Ana hace de todo; Luis no hace la consulta inicial. Pedirle a Luis una consulta
    // inicial por API debe dar 409 "no realiza ese servicio".
    empleadoServicios: [
      { empleadoId: EMP_ANA, servicioId: SRV_CONSULTA },
      { empleadoId: EMP_ANA, servicioId: SRV_SESION },
      { empleadoId: EMP_ANA, servicioId: SRV_EXTENDIDA },
      { empleadoId: EMP_LUIS, servicioId: SRV_SESION },
      { empleadoId: EMP_LUIS, servicioId: SRV_EXTENDIDA },
      { empleadoId: EMP_MARTA, servicioId: SRV_SESION },
    ],

    servicioAdicional: [
      { id: AD_PRIORITARIA, nombre: 'Atencion prioritaria', descripcion: null, precio: precio('5000.00'), activo: true },
      { id: AD_INFORME, nombre: 'Informe escrito', descripcion: null, precio: precio('7500.00'), activo: true },
    ],

    // Indicadores tomados de la tabla de 01-modelo-datos.md. La fila que importa es CONFIRMADA:
    // el cliente ya no la cancela solo, el personal si.
    estadoCita: [
      { id: EST_PENDIENTE, codigo: 'PENDIENTE', nombre: 'Pendiente', bloqueaDisponibilidad: true, permiteEdicion: true, permiteCancelacionCliente: true, permiteCancelacionPersonal: true, esFinal: false, orden: 1 },
      { id: EST_CONFIRMADA, codigo: 'CONFIRMADA', nombre: 'Confirmada', bloqueaDisponibilidad: true, permiteEdicion: true, permiteCancelacionCliente: false, permiteCancelacionPersonal: true, esFinal: false, orden: 2 },
      { id: EST_COMPLETADA, codigo: 'COMPLETADA', nombre: 'Completada', bloqueaDisponibilidad: false, permiteEdicion: false, permiteCancelacionCliente: false, permiteCancelacionPersonal: false, esFinal: true, orden: 3 },
      { id: EST_CANCELADA, codigo: 'CANCELADA', nombre: 'Cancelada', bloqueaDisponibilidad: false, permiteEdicion: false, permiteCancelacionCliente: false, permiteCancelacionPersonal: false, esFinal: true, orden: 4 },
    ],

    // Turno partido de lunes a viernes y sabado corto. El domingo no tiene ninguna
    // franja: elegir un domingo debe dar 409 "no atiende ese dia".
    horarioAtencion: [
      ...['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'].flatMap((nombreDia) => [
        { id: `hor-${nombreDia}-am`, dia: nombreDia, minutoApertura: 9 * HORA, minutoCierre: 13 * HORA, activo: true },
        { id: `hor-${nombreDia}-pm`, dia: nombreDia, minutoApertura: 14 * HORA, minutoCierre: 18 * HORA, activo: true },
      ]),
      { id: 'hor-SABADO-am', dia: 'SABADO', minutoApertura: 9 * HORA, minutoCierre: 13 * HORA, activo: true },
    ],

    restriccionHorario: [
      // General (empleadoId nulo): cierra el negocio entero pasado manana.
      { id: RESTRICCION_FERIADO, tipo: 'FERIADO', empleadoId: null, inicio: dia(2, 0), fin: dia(3, 0), motivo: 'Feriado' },
      // Solo Ana, manana por la tarde: sus horarios de 15:00 a 17:00 desaparecen y los
      // de Luis siguen ahi.
      { id: RESTRICCION_ANA, tipo: 'BLOQUEO', empleadoId: EMP_ANA, inicio: dia(1, 15 * HORA), fin: dia(1, 17 * HORA), motivo: 'Capacitacion' },
    ],

    // Cita ya tomada manana 10:00-11:00 con Ana: ese horario no debe ofrecerse, y
    // forzarlo por API debe dar 409 de traslape.
    cita: [
      {
        id: CITA_OCUPADA,
        clienteId: USR_CLIENTA,
        registradaPorId: USR_CLIENTA,
        empleadoId: EMP_ANA,
        servicioId: SRV_SESION,
        estadoId: EST_CONFIRMADA,
        inicio: dia(1, 10 * HORA),
        fin: dia(1, 11 * HORA),
        slotOcupado: dia(1, 10 * HORA),
        precioServicio: precio('28000.00'),
        costoAdicionales: precio('0.00'),
        costoTotal: precio('28000.00'),
        motivoCancelacion: null,
        notas: null,
        creadaEn: ahora,
        actualizadaEn: ahora,
      },
    ],

    citaAdicional: [] as { citaId: string; adicionalId: string; precio: Prisma.Decimal }[],
  };
}

export type AlmacenDemo = ReturnType<typeof crearDatosQuemados>;
