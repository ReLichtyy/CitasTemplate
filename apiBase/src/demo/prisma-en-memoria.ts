/**
 * Doble de `PrismaService` en memoria, para trabajar sin base de datos.
 *
 * No reimplementa las reglas de negocio: las sirve. `CitasService`, `ServiciosService`
 * y los guards siguen siendo los de produccion, con sus cinco reglas, su transaccion y
 * su traduccion del P2002 — solo cambia de donde salen las filas. Por eso el `@@unique`
 * de `Cita` se respeta aqui: sin el, la carrera que cubre 02-reservas-concurrencia.md no se podria ver.
 *
 * Solo entiende las consultas que este proyecto hace hoy. No es un motor de Prisma: si
 * alguien escribe una consulta con una forma nueva, fallara de manera ruidosa, que es
 * lo correcto para andamiaje que se borra al correr la migracion.
 */
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { crearDatosQuemados, type AlmacenDemo } from './datos-quemados.js';

type Registro = Record<string, any>;

const OPERADORES = new Set([
  'equals',
  'not',
  'in',
  'notIn',
  'lt',
  'lte',
  'gt',
  'gte',
]);

function valorIgual(valor: unknown, esperado: unknown): boolean {
  if (valor instanceof Date) {
    const otro =
      esperado instanceof Date ? esperado : new Date(esperado as string);
    return valor.getTime() === otro.getTime();
  }
  return valor === esperado;
}

function comparable(valor: unknown): number {
  return valor instanceof Date ? valor.getTime() : Number(valor);
}

function cumpleCampo(valor: unknown, condicion: unknown): boolean {
  if (condicion === null) {
    return valor === null || valor === undefined;
  }
  if (condicion instanceof Date || typeof condicion !== 'object') {
    return valorIgual(valor, condicion);
  }

  const claves = Object.keys(condicion as object);
  const esOperador =
    claves.length > 0 && claves.every((clave) => OPERADORES.has(clave));

  // Filtro sobre una relacion ya hidratada: { estado: { bloqueaDisponibilidad: true } }
  if (!esOperador) {
    return (
      typeof valor === 'object' &&
      valor !== null &&
      cumple(valor as Registro, condicion)
    );
  }

  return claves.every((clave) => {
    const esperado = (condicion as Registro)[clave];
    switch (clave) {
      case 'equals':
        return valorIgual(valor, esperado);
      case 'not':
        return !cumpleCampo(valor, esperado);
      case 'in':
        return (esperado as unknown[]).some((opcion) =>
          valorIgual(valor, opcion),
        );
      case 'notIn':
        return !(esperado as unknown[]).some((opcion) =>
          valorIgual(valor, opcion),
        );
      case 'lt':
        return comparable(valor) < comparable(esperado);
      case 'lte':
        return comparable(valor) <= comparable(esperado);
      case 'gt':
        return comparable(valor) > comparable(esperado);
      case 'gte':
        return comparable(valor) >= comparable(esperado);
      default:
        return false;
    }
  });
}

function cumple(registro: Registro, where: Registro | undefined): boolean {
  if (!where) {
    return true;
  }
  return Object.entries(where).every(([campo, condicion]) => {
    // Prisma ignora las claves con undefined, y el `id: excluir ? { not } : undefined`
    // de CitasService depende de eso.
    if (condicion === undefined) return true;
    if (campo === 'OR')
      return (condicion as Registro[]).some((rama) => cumple(registro, rama));
    if (campo === 'AND')
      return (condicion as Registro[]).every((rama) => cumple(registro, rama));
    if (campo === 'NOT') return !cumple(registro, condicion as Registro);
    return cumpleCampo(registro[campo], condicion);
  });
}

function ordenar(filas: Registro[], orderBy: Registro | undefined): Registro[] {
  if (!orderBy) return filas;
  const [campo, direccion] = Object.entries(orderBy)[0];

  // orderBy anidado, como { usuario: { nombre: 'asc' } }.
  if (typeof direccion === 'object' && direccion !== null) {
    const [subcampo, subdireccion] = Object.entries(direccion)[0];
    const sentido = subdireccion === 'desc' ? -1 : 1;
    return [...filas].sort(
      (a, b) =>
        String(a[campo]?.[subcampo] ?? '').localeCompare(
          String(b[campo]?.[subcampo] ?? ''),
        ) * sentido,
    );
  }

  const sentido = direccion === 'desc' ? -1 : 1;
  return [...filas].sort((a, b) => {
    const izquierda = a[campo];
    const derecha = b[campo];
    if (typeof izquierda === 'string' || typeof derecha === 'string') {
      return String(izquierda).localeCompare(String(derecha)) * sentido;
    }
    return (comparable(izquierda) - comparable(derecha)) * sentido;
  });
}

function esRelacion(valor: unknown): boolean {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    !(valor instanceof Date) &&
    !Prisma.Decimal.isDecimal(valor)
  );
}

/**
 * Lo que devuelve Prisma cuando una relacion se pide con `true`: sus columnas, sin
 * arrastrar lo que cuelgue de ella. Sin esto, un `include: { servicio: true }` sacaria
 * tambien los empleados del servicio y, con ellos, `Usuario.password`.
 */
function soloEscalares(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(soloEscalares);
  if (!esRelacion(valor)) return valor;
  return Object.fromEntries(
    Object.entries(valor as Registro).filter(([, campo]) => !esRelacion(campo)),
  );
}

/**
 * Aplica `select` / `include`, incluidos el `where` y el `orderBy` que puedan llevar
 * las relaciones anidadas.
 *
 * No es cosmetica: sin esto la demo devolveria la fila entera y `GET /servicios`
 * publicaria `Usuario.password`, `telefono` y `rol`, que es justo lo que prohiben
 * 03-autorizacion.md y 04-contrato-api.md. Un doble que filtra menos que la base
 * enseñaria una estructura que en produccion no existe.
 */
function proyectar(
  fila: Registro | null,
  opciones: Registro | undefined,
): Registro | null {
  if (!fila || !opciones) return fila;

  const seleccion = (opciones.select ?? opciones.include) as
    Registro | undefined;
  if (!seleccion) return fila;

  const salida: Registro = {};

  // `include` conserva todos los escalares; `select` no conserva nada que no pida.
  if (opciones.include) {
    for (const [clave, valor] of Object.entries(fila)) {
      if (!esRelacion(valor)) salida[clave] = valor;
    }
  }

  for (const [clave, config] of Object.entries(seleccion)) {
    if (config === false || config === undefined) continue;

    const valor = fila[clave];
    if (config === true) {
      salida[clave] = soloEscalares(valor);
      continue;
    }

    const anidado = config as Registro;
    if (Array.isArray(valor)) {
      const filtradas = ordenar(
        valor.filter((elemento) => cumple(elemento, anidado.where)),
        anidado.orderBy,
      );
      salida[clave] = filtradas.map((elemento) => proyectar(elemento, anidado));
    } else {
      salida[clave] = proyectar(valor as Registro, anidado);
    }
  }

  return salida;
}

export function crearPrismaEnMemoria() {
  const almacen: AlmacenDemo = crearDatosQuemados();

  const porId = (modelo: keyof AlmacenDemo, id: unknown): Registro | null =>
    (almacen[modelo] as Registro[]).find((fila) => fila.id === id) ?? null;

  // Las relaciones se resuelven un nivel a cada lado. Mas profundidad haria un ciclo
  // servicio -> empleados -> servicios, y ninguna consulta del proyecto lo necesita.
  const hidratarUsuario = (usuario: Registro | null) =>
    usuario ? { ...usuario } : null;

  const hidratarEmpleado = (empleado: Registro): Registro => ({
    ...empleado,
    usuario: hidratarUsuario(porId('usuario', empleado.usuarioId)),
    especialidad: porId('especialidad', empleado.especialidadId),
    servicios: almacen.empleadoServicios
      .filter((union) => union.empleadoId === empleado.id)
      .map((union) => porId('servicio', union.servicioId))
      .filter((servicio): servicio is Registro => servicio !== null),
  });

  const hidratarServicio = (servicio: Registro): Registro => ({
    ...servicio,
    empleados: almacen.empleadoServicios
      .filter((union) => union.servicioId === servicio.id)
      .map((union) => porId('empleado', union.empleadoId))
      .filter((empleado): empleado is Registro => empleado !== null)
      .map((empleado) => ({
        ...empleado,
        usuario: hidratarUsuario(porId('usuario', empleado.usuarioId)),
      })),
  });

  const hidratarCita = (cita: Registro): Registro => ({
    ...cita,
    cliente: hidratarUsuario(porId('usuario', cita.clienteId)),
    registradaPor: hidratarUsuario(porId('usuario', cita.registradaPorId)),
    empleado: hidratarEmpleado(porId('empleado', cita.empleadoId) as Registro),
    servicio: hidratarServicio(porId('servicio', cita.servicioId) as Registro),
    estado: porId('estadoCita', cita.estadoId),
    adicionales: almacen.citaAdicional
      .filter((union) => union.citaId === cita.id)
      .map((union) => ({
        ...union,
        adicional: porId('servicioAdicional', union.adicionalId),
      })),
  });

  const sinHidratar = (fila: Registro) => ({ ...fila });

  function delegado(
    modelo: keyof AlmacenDemo,
    hidratar: (fila: Registro) => Registro,
  ) {
    const filas = () => (almacen[modelo] as Registro[]).map(hidratar);
    const buscar = (args: Registro) =>
      ordenar(
        filas().filter((fila) => cumple(fila, args.where)),
        args.orderBy,
      );

    return {
      findMany: async (args: Registro = {}) =>
        buscar(args).map((fila) => proyectar(fila, args)),
      findFirst: async (args: Registro = {}) =>
        proyectar(buscar(args)[0] ?? null, args),
      findUnique: async (args: Registro = {}) =>
        proyectar(buscar(args)[0] ?? null, args),
    };
  }

  /**
   * El indice unico `(empleadoId, slotOcupado)` del esquema. Es lo que atrapa a dos
   * clientes sobre el mismo horario, asi que sin el la demo no probaria la carrera.
   */
  function comprobarSlotLibre(
    empleadoId: string,
    slotOcupado: Date | null,
    excluirId?: string,
  ): void {
    if (slotOcupado === null) return;
    const chocado = almacen.cita.some(
      (cita) =>
        cita.id !== excluirId &&
        cita.empleadoId === empleadoId &&
        cita.slotOcupado !== null &&
        (cita.slotOcupado as Date).getTime() === slotOcupado.getTime(),
    );
    if (chocado) {
      throw new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'demo',
          meta: { target: ['empleadoId', 'slotOcupado'] },
        },
      );
    }
  }

  const cliente = {
    configuracionNegocio: delegado('configuracionNegocio', sinHidratar),
    especialidad: delegado('especialidad', sinHidratar),
    estadoCita: delegado('estadoCita', sinHidratar),
    horarioAtencion: delegado('horarioAtencion', sinHidratar),
    restriccionHorario: delegado('restriccionHorario', sinHidratar),
    servicioAdicional: delegado('servicioAdicional', sinHidratar),
    servicio: delegado('servicio', hidratarServicio),
    empleado: delegado('empleado', hidratarEmpleado),

    usuario: {
      ...delegado('usuario', sinHidratar),
      create: async (args: Registro) => {
        const { data } = args;
        const ahora = new Date();
        const usuario: Registro = {
          id: randomUUID(),
          email: null,
          password: null,
          apellido: null,
          rol: 'CLIENTE',
          activo: true,
          creadoEn: ahora,
          actualizadoEn: ahora,
          ...data,
        };
        almacen.usuario.push(usuario as never);
        return proyectar({ ...usuario }, args);
      },
    },

    cita: {
      ...delegado('cita', hidratarCita),
      create: async (args: Registro) => {
        const { adicionales, ...campos } = args.data as Registro;
        const ahora = new Date();
        const cita: Registro = {
          id: randomUUID(),
          motivoCancelacion: null,
          notas: null,
          creadaEn: ahora,
          actualizadaEn: ahora,
          ...campos,
        };

        comprobarSlotLibre(cita.empleadoId, cita.slotOcupado ?? null);
        almacen.cita.push(cita as never);

        for (const nuevo of adicionales?.create ?? []) {
          almacen.citaAdicional.push({ citaId: cita.id, ...nuevo } as never);
        }
        return proyectar(hidratarCita(cita), args);
      },
      update: async (args: Registro) => {
        const { where, data } = args;
        const cita = porId('cita', where.id);
        if (!cita) {
          throw new Error(`Demo: no existe la cita ${where.id}`);
        }

        const { adicionales, ...campos } = data as Registro;
        const actualizada: Registro = {
          ...cita,
          ...campos,
          actualizadaEn: new Date(),
        };
        comprobarSlotLibre(
          actualizada.empleadoId,
          actualizada.slotOcupado ?? null,
          cita.id,
        );
        Object.assign(cita, actualizada);

        if (adicionales) {
          const otros = almacen.citaAdicional.filter(
            (union) => union.citaId !== cita.id,
          );
          almacen.citaAdicional.length = 0;
          almacen.citaAdicional.push(...otros);
          for (const nuevo of adicionales.create ?? []) {
            almacen.citaAdicional.push({ citaId: cita.id, ...nuevo } as never);
          }
        }
        return proyectar(hidratarCita(cita), args);
      },
    },

    // Sin reversion: si algo falla despues de escribir, lo escrito se queda. La unica
    // escritura que precede a otra en este codigo es la ficha del invitado, asi que el
    // peor caso de la demo es un usuario sin cita. Con MariaDB esto si revierte.
    // El parametro va sin tipar porque `cliente` se referencia a si mismo aqui.
    $transaction: async <T>(
      operacion: (tx: Registro) => Promise<T>,
    ): Promise<T> => operacion(cliente),

    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };

  return cliente;
}
