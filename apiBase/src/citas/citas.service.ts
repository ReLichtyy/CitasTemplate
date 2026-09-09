import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogoService } from '../catalogo/catalogo.service.js';
import { Role } from '../common/enums/role.enum.js';
import {
  diaEnZona,
  partesEnZona,
  seTraslapan,
  sumarMinutos,
} from '../common/tiempo.js';
import { normalizarTelefono } from '../common/telefono.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface.js';
import type { ActualizarCitaDto } from './dto/actualizar-cita.dto.js';
import type { CancelarCitaDto } from './dto/cancelar-cita.dto.js';
import {
  LIMITE_POR_DEFECTO,
  type ConsultarCitasDto,
} from './dto/consultar-citas.dto.js';
import type { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto.js';
import type { ReservarCitaDto } from './dto/reservar-cita.dto.js';
import { OutboxService } from '../notificaciones/outbox.service.js';

const CODIGO_ESTADO_INICIAL = 'PENDIENTE';
const CODIGO_ESTADO_CONFIRMADA = 'CONFIRMADA';
const CODIGO_ESTADO_CANCELADA = 'CANCELADA';

/** Granularidad con la que se ofrecen horarios libres en /citas/disponibilidad. */
const PASO_MINUTOS = 15;

/**
 * El 409 es el unico error que el usuario final lee tal cual, asi que se redacta
 * para el. Ver 04-contrato-api.md.
 */
const MENSAJE_TRASLAPE = 'Ese horario ya esta tomado. Elija otro.';
/** Mismo texto para "no existe" y "no es suya": un 404 aqui confirmaria ids ajenos. */
const MENSAJE_NO_ENCONTRADO = 'Recurso no encontrado.';

/** Usuario.password nunca sale de la capa de servicios. Ver 04-contrato-api.md. */
const USUARIO_PUBLICO = {
  id: true,
  nombre: true,
  apellido: true,
  telefono: true,
  email: true,
} satisfies Prisma.UsuarioSelect;

/**
 * Lo que hace falta del cliente para encolar el aviso. `aceptaWhatsapp` no esta en
 * `USUARIO_PUBLICO` y no debe estarlo: eso es la proyeccion que sale al cliente HTTP.
 * Se lee aqui, en la consulta que `resolverCliente` ya hacia de todos modos.
 */
const CLIENTE_AVISO = {
  id: true,
  nombre: true,
  telefono: true,
  aceptaWhatsapp: true,
} satisfies Prisma.UsuarioSelect;

type ClienteAviso = Prisma.UsuarioGetPayload<{ select: typeof CLIENTE_AVISO }>;

const INCLUIR_CITA = {
  cliente: { select: USUARIO_PUBLICO },
  registradaPor: { select: USUARIO_PUBLICO },
  empleado: { include: { usuario: { select: USUARIO_PUBLICO } } },
  servicio: true,
  estado: true,
  adicionales: { include: { adicional: true } },
} satisfies Prisma.CitaInclude;

/** Lo minimo que la verificacion necesita saber del servicio y del empleado. */
interface ServicioVerificable {
  id: string;
  activo: boolean;
  duracionMinutos: number;
  empleados: { id: string }[];
}

interface EmpleadoVerificable {
  id: string;
  activo: boolean;
}

interface ContextoDisponibilidad {
  servicio: ServicioVerificable;
  empleado: EmpleadoVerificable;
  inicio: Date;
  fin: Date;
  /** La cita que se esta reprogramando no compite consigo misma. */
  excluirCitaId?: string;
}

@Injectable()
export class CitasService {
  private readonly logger = new Logger(CitasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly catalogo: CatalogoService,
  ) {}

  /**
   * El filtrado por propiedad de una lista no lo puede hacer el guard, que solo ve
   * un id de ruta: aqui va en la consulta. Ver 03-autorizacion.md.
   *
   * La lista siempre viene acotada. Sin cota, un ADMIN se llevaba todas las citas
   * historicas del negocio con las seis relaciones de `INCLUIR_CITA` colgando de cada
   * una. El total viaja aparte para que el frontend sepa que hay mas, y la paginacion
   * va **dentro** de `data`, no como hermano del sobre. Ver 04-contrato-api.md.
   */
  async findAll(user: AuthenticatedUser, query: ConsultarCitasDto = {}) {
    const limite = query.limite ?? LIMITE_POR_DEFECTO;
    const pagina = query.pagina ?? 0;

    const where: Prisma.CitaWhereInput = {
      ...(await this.filtroPorPropiedad(user)),
      ...this.rangoDeFechas(query),
    };

    // Las dos consultas comparten `where` a proposito: un total que no case con la
    // pagina es peor que no tener total.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cita.findMany({
        where,
        include: INCLUIR_CITA,
        orderBy: { inicio: 'asc' },
        skip: pagina * limite,
        take: limite,
      }),
      this.prisma.cita.count({ where }),
    ]);

    return { items, total, pagina, limite };
  }

  /**
   * `desde` es inclusive y `hasta` exclusive, la misma convencion semiabierta que usa
   * el traslape de horarios. Se filtra por `inicio`, que es lo que los dos indices de
   * `Cita` llevan como segunda columna.
   */
  private rangoDeFechas(query: ConsultarCitasDto): Prisma.CitaWhereInput {
    if (!query.desde && !query.hasta) {
      return {};
    }
    return {
      inicio: {
        ...(query.desde ? { gte: new Date(query.desde) } : {}),
        ...(query.hasta ? { lt: new Date(query.hasta) } : {}),
      },
    };
  }

  /** La propiedad de esta cita ya la comprobo PropiedadCitaGuard. */
  async findOne(id: string, _user: AuthenticatedUser) {
    const cita = await this.prisma.cita.findUnique({
      where: { id },
      include: INCLUIR_CITA,
    });
    if (!cita) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return cita;
  }

  /**
   * La operacion con la carrera. Verificacion e insercion van dentro de la misma
   * `$transaction`, que es lo que cubre el traslape parcial; el unique
   * `(empleadoId, slotOcupado)` cubre el choque exacto de hora. Los dos hacen falta,
   * y la violacion de unicidad se traduce al mismo error de negocio. Ver 02-reservas-concurrencia.md.
   */
  async reservar(dto: ReservarCitaDto, user?: AuthenticatedUser) {
    const inicio = new Date(dto.inicio);

    try {
      const cita = await this.prisma.$transaction(async (tx) => {
        const { servicio, empleado, fin } = await this.cargarContexto(
          tx,
          dto.servicioId,
          dto.empleadoId,
          inicio,
        );

        await this.verificarDisponibilidad(tx, {
          servicio,
          empleado,
          inicio,
          fin,
        });

        const cliente = await this.resolverCliente(tx, dto, user);
        const adicionales = await this.cargarAdicionales(tx, dto.adicionalIds);
        const estado = await this.estadoDeCatalogo(CODIGO_ESTADO_INICIAL);

        // Importes recalculados desde la base; el cuerpo nunca los aporta. Ver 02-reservas-concurrencia.md.
        const precioServicio = servicio.precio;
        const costoAdicionales = this.sumarPrecios(adicionales);
        const costoTotal = new Prisma.Decimal(precioServicio).add(
          costoAdicionales,
        );

        const creada = await tx.cita.create({
          data: {
            clienteId: cliente.id,
            // Quien digito. Con sesion es siempre el del token, mande lo que mande el
            // cuerpo; sin ella, el invitado se registra a si mismo.
            registradaPorId: user?.userId ?? cliente.id,
            empleadoId: empleado.id,
            servicioId: servicio.id,
            estadoId: estado.id,
            inicio,
            fin,
            slotOcupado: estado.bloqueaDisponibilidad ? inicio : null,
            precioServicio,
            costoAdicionales,
            costoTotal,
            notas: dto.notas,
            adicionales: {
              create: adicionales.map((adicional) => ({
                adicionalId: adicional.id,
                precio: adicional.precio,
              })),
            },
          },
          include: INCLUIR_CITA,
        });

        // Lo unico que este servicio sabe de las notificaciones: deja la intencion de
        // enviar dentro de la transaccion que ya tenia. El envio ocurre despues, en
        // otro proceso, y puede reintentar. Ver 09-conexion-whatsapp.md.
        //
        // Se le pasan los datos, no el id: todo lo que el aviso necesita acaba de
        // volver del INSERT o de `resolverCliente`, y releerlo eran cuatro consultas
        // mas con la transaccion abierta.
        await this.outbox.encolarConfirmacion(tx, {
          id: creada.id,
          inicio: creada.inicio,
          cliente,
          servicio: creada.servicio,
          empleado: creada.empleado,
        });

        return creada;
      });

      // Un invitado se lleva su comprobante, no la ficha del titular del telefono.
      return user ? cita : this.comprobanteDeInvitado(cita);
    } catch (error) {
      throw this.traducirChoqueDeUnicidad(error);
    }
  }

  /**
   * Reprogramar y cambiar de estado son la misma operacion porque comparten el
   * invariante: si el estado resultante bloquea disponibilidad, `slotOcupado` vale
   * `inicio`, y si no, `NULL`. Se actualiza en la misma transaccion que el estado;
   * olvidarlo deja horarios ocupados para siempre. Ver 02-reservas-concurrencia.md.
   */
  async update(id: string, dto: ActualizarCitaDto, _user: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const cita = await tx.cita.findUnique({
          where: { id },
          include: { estado: true },
        });
        if (!cita) {
          throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
        }

        const reprograma =
          dto.inicio !== undefined ||
          dto.empleadoId !== undefined ||
          dto.servicioId !== undefined ||
          dto.adicionalIds !== undefined;

        if (reprograma && !cita.estado.permiteEdicion) {
          throw new ConflictException(
            `Una cita ${cita.estado.nombre} ya no se puede modificar.`,
          );
        }

        const estadoDestino = dto.estadoCodigo
          ? await this.estadoSolicitado(dto.estadoCodigo)
          : cita.estado;

        const inicio = dto.inicio ? new Date(dto.inicio) : cita.inicio;
        const { servicio, empleado, fin } = await this.cargarContexto(
          tx,
          dto.servicioId ?? cita.servicioId,
          dto.empleadoId ?? cita.empleadoId,
          inicio,
        );

        // Solo compite por el espacio lo que va a ocuparlo: pasar a un estado que no
        // bloquea es siempre valido, aunque el horario ya no estuviera disponible.
        if (estadoDestino.bloqueaDisponibilidad) {
          await this.verificarDisponibilidad(tx, {
            servicio,
            empleado,
            inicio,
            fin,
            excluirCitaId: id,
          });
        }

        // Los importes son copias congeladas del dia de la reserva: solo se vuelven a
        // leer las partes que el cliente cambia. Ver 01-modelo-datos.md.
        const precioServicio =
          dto.servicioId && dto.servicioId !== cita.servicioId
            ? servicio.precio
            : cita.precioServicio;

        let costoAdicionales = cita.costoAdicionales;
        let adicionales: Prisma.CitaUpdateInput['adicionales'];
        if (dto.adicionalIds) {
          const elegidos = await this.cargarAdicionales(tx, dto.adicionalIds);
          costoAdicionales = this.sumarPrecios(elegidos);
          adicionales = {
            deleteMany: {},
            create: elegidos.map((adicional) => ({
              adicionalId: adicional.id,
              precio: adicional.precio,
            })),
          };
        }

        return await tx.cita.update({
          where: { id },
          data: {
            empleadoId: empleado.id,
            servicioId: servicio.id,
            estadoId: estadoDestino.id,
            inicio,
            fin,
            slotOcupado: estadoDestino.bloqueaDisponibilidad ? inicio : null,
            precioServicio,
            costoAdicionales,
            costoTotal: new Prisma.Decimal(precioServicio).add(
              costoAdicionales,
            ),
            notas: dto.notas ?? cita.notas,
            adicionales,
          },
          include: INCLUIR_CITA,
        });
      });
    } catch (error) {
      throw this.traducirChoqueDeUnicidad(error);
    }
  }

  /**
   * Cancelar no borra la fila: cambia el estado y suelta `slotOcupado`. MySQL admite
   * NULLs repetidos en un indice unico, asi que el espacio queda libre aunque la cita
   * siga existiendo. Ver 02-reservas-concurrencia.md.
   */
  async cancelar(id: string, dto: CancelarCitaDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const cita = await tx.cita.findUnique({
        where: { id },
        include: { estado: true },
      });
      if (!cita) {
        throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
      }

      // Los dos indicadores estan separados justamente para este caso: una cita
      // Confirmada no la cancela el cliente, pero el personal si. Ver 01-modelo-datos.md.
      const esPersonal =
        user.rol === Role.ADMIN || user.rol === Role.EMPLEADO;
      const permitido = esPersonal
        ? cita.estado.permiteCancelacionPersonal
        : cita.estado.permiteCancelacionCliente;

      if (!permitido) {
        throw new ConflictException(
          esPersonal
            ? `Una cita ${cita.estado.nombre} ya no se puede cancelar.`
            : `Una cita ${cita.estado.nombre} ya no la puede cancelar usted; comuniquese con el negocio.`,
        );
      }

      const cancelada = await this.estadoDeCatalogo(CODIGO_ESTADO_CANCELADA);

      return await tx.cita.update({
        where: { id },
        data: {
          estadoId: cancelada.id,
          slotOcupado: cancelada.bloqueaDisponibilidad ? cita.inicio : null,
          motivoCancelacion: dto?.motivo,
        },
        include: INCLUIR_CITA,
      });
    });
  }

  /**
   * Horarios libres de un empleado en un dia. Es la respuesta a "que le muestro al
   * usuario": la autoridad sigue siendo la verificacion transaccional de `reservar`,
   * porque entre esta consulta y la confirmacion alguien mas puede tomar el espacio.
   */
  async disponibilidad(query: ConsultarDisponibilidadDto) {
    const zona = await this.catalogo.zonaHoraria();
    const [anio, mes, dia] = query.fecha.slice(0, 10).split('-').map(Number);

    const [servicio, empleado] = await Promise.all([
      this.prisma.servicio.findUnique({
        where: { id: query.servicioId },
        include: { empleados: { select: { id: true } } },
      }),
      this.prisma.empleado.findUnique({ where: { id: query.empleadoId } }),
    ]);
    if (!servicio || !empleado) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    this.verificarServicioYEmpleado(servicio, empleado);

    // Resuelve la zona una vez para todo el dia en vez de una vez por hueco: la version
    // anterior llamaba a `Intl` dos veces por hueco ofrecido. Los dias con cambio de
    // horario caen solos al camino exacto. Ver `diaEnZona`.
    const {
      medianoche: inicioDia,
      finDelDia: finDia,
      hora,
    } = diaEnZona(anio, mes, dia, zona);
    const { diaSemana } = partesEnZona(inicioDia, zona);

    const [franjas, restricciones, ocupadas] = await Promise.all([
      this.prisma.horarioAtencion.findMany({
        where: { dia: diaSemana, activo: true },
        orderBy: { minutoApertura: 'asc' },
      }),
      this.prisma.restriccionHorario.findMany({
        where: {
          OR: [{ empleadoId: null }, { empleadoId: empleado.id }],
          inicio: { lt: finDia },
          fin: { gt: inicioDia },
        },
        select: { inicio: true, fin: true },
      }),
      this.prisma.cita.findMany({
        where: {
          empleadoId: empleado.id,
          estado: { bloqueaDisponibilidad: true },
          inicio: { lt: finDia },
          fin: { gt: inicioDia },
        },
        select: { inicio: true, fin: true },
      }),
    ]);

    const ahora = Date.now();
    const slots: { inicio: string; fin: string }[] = [];
    for (const franja of franjas) {
      for (
        let minuto = franja.minutoApertura;
        minuto + servicio.duracionMinutos <= franja.minutoCierre;
        minuto += PASO_MINUTOS
      ) {
        const inicio = hora(minuto);
        const fin = sumarMinutos(inicio, servicio.duracionMinutos);

        // Filtro de listado, no una sexta regla: ofrecer un horario ya pasado no es
        // util. La verificacion de `reservar` sigue siendo la de 02-reservas-concurrencia.md.
        if (inicio.getTime() <= ahora) {
          continue;
        }

        const chocaConRestriccion = restricciones.some((restriccion) =>
          seTraslapan(inicio, fin, restriccion.inicio, restriccion.fin),
        );
        const chocaConCita = ocupadas.some((cita) =>
          seTraslapan(inicio, fin, cita.inicio, cita.fin),
        );

        if (!chocaConRestriccion && !chocaConCita) {
          slots.push({ inicio: inicio.toISOString(), fin: fin.toISOString() });
        }
      }
    }

    return {
      fecha: query.fecha.slice(0, 10),
      zonaHoraria: zona,
      duracionMinutos: servicio.duracionMinutos,
      slots,
    };
  }

  /**
   * Confirmar una cita desde el enlace firmado. La llama ConfirmacionService dentro
   * de su transaccion, que es la misma donde se marca el token como usado.
   *
   * Escribir el estado a mano desde el modulo de notificaciones seria saltarse el
   * invariante de `slotOcupado`: CONFIRMADA bloquea disponibilidad, asi que
   * `slotOcupado` sigue valiendo `inicio`. Ver 02-reservas-concurrencia.md.
   */
  async marcarConfirmada(tx: Prisma.TransactionClient, citaId: string) {
    const cita = await tx.cita.findUnique({
      where: { id: citaId },
      include: { estado: true },
    });
    if (!cita) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }

    if (cita.estado.codigo === CODIGO_ESTADO_CONFIRMADA) {
      return this.resumenConfirmacion(tx, citaId);
    }

    // Una cita cancelada, atendida o no asistida ya no se confirma: el enlace pudo
    // haber quedado dando vueltas en el telefono del cliente.
    if (cita.estado.esFinal) {
      throw new ConflictException(
        `Esta cita esta ${cita.estado.nombre.toLowerCase()} y ya no se puede confirmar.`,
      );
    }

    const confirmada = await this.estadoDeCatalogo(CODIGO_ESTADO_CONFIRMADA);

    await tx.cita.update({
      where: { id: citaId },
      data: {
        estadoId: confirmada.id,
        slotOcupado: confirmada.bloqueaDisponibilidad ? cita.inicio : null,
      },
    });

    return this.resumenConfirmacion(tx, citaId);
  }

  /**
   * Lo que ve quien llega por el enlace. Es lo minimo —servicio, profesional,
   * fecha—: el enlace pudo haberse reenviado, asi que nunca sale el telefono ni el
   * resto de la ficha del cliente.
   */
  async resumenConfirmacion(tx: Prisma.TransactionClient, citaId: string) {
    const cita = await tx.cita.findUnique({
      where: { id: citaId },
      include: {
        servicio: { select: { nombre: true } },
        estado: { select: { codigo: true, nombre: true } },
        empleado: {
          select: { usuario: { select: { nombre: true, apellido: true } } },
        },
      },
    });
    if (!cita) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }

    return {
      servicio: cita.servicio.nombre,
      profesional: [cita.empleado.usuario.nombre, cita.empleado.usuario.apellido]
        .filter(Boolean)
        .join(' '),
      inicio: cita.inicio,
      fin: cita.fin,
      estado: cita.estado.codigo,
      confirmada: cita.estado.codigo === CODIGO_ESTADO_CONFIRMADA,
    };
  }

  /**
   * Crear y modificar pasan por aqui, en este orden. Cinco reglas, ver 02-reservas-concurrencia.md.
   * Cada rechazo lleva su propio mensaje porque es lo que el usuario va a leer.
   */
  private async verificarDisponibilidad(
    tx: Prisma.TransactionClient,
    { servicio, empleado, inicio, fin, excluirCitaId }: ContextoDisponibilidad,
  ): Promise<void> {
    const zona = await this.catalogo.zonaHoraria();
    const { diaSemana, minutos: minutoInicio } = partesEnZona(inicio, zona);

    // 1 · el dia tiene al menos una franja activa.
    const franjas = await tx.horarioAtencion.findMany({
      where: { dia: diaSemana, activo: true },
    });
    if (franjas.length === 0) {
      throw new ConflictException('El negocio no atiende ese dia.');
    }

    // 2 · [inicio, fin) cae completo dentro de una de esas franjas.
    // El fin se mide sumando la duracion a los minutos de pared, no releyendo la hora
    // de `fin`: una cita que cruza medianoche daria un minuto menor y pareceria caber.
    const minutoFin = minutoInicio + servicio.duracionMinutos;
    const cabe = franjas.some(
      (franja) =>
        franja.minutoApertura <= minutoInicio &&
        minutoFin <= franja.minutoCierre,
    );
    if (!cabe) {
      throw new ConflictException(
        'Ese horario esta fuera del horario de atencion.',
      );
    }

    // 3 · ninguna restriccion traslapa, ni general (empleadoId nulo) ni de ese empleado.
    const restriccion = await tx.restriccionHorario.findFirst({
      where: {
        OR: [{ empleadoId: null }, { empleadoId: empleado.id }],
        inicio: { lt: fin },
        fin: { gt: inicio },
      },
      select: { id: true },
    });
    if (restriccion) {
      throw new ConflictException('Ese horario esta bloqueado en la agenda.');
    }

    // 4 · ninguna otra cita del mismo empleado en un estado que bloquea.
    const choque = await tx.cita.findFirst({
      where: {
        empleadoId: empleado.id,
        id: excluirCitaId ? { not: excluirCitaId } : undefined,
        estado: { bloqueaDisponibilidad: true },
        inicio: { lt: fin },
        fin: { gt: inicio },
      },
      select: { id: true },
    });
    if (choque) {
      throw new ConflictException(MENSAJE_TRASLAPE);
    }

    // 5 · servicio y empleado activos, y el servicio asignado a ese empleado.
    this.verificarServicioYEmpleado(servicio, empleado);
  }

  private verificarServicioYEmpleado(
    servicio: ServicioVerificable,
    empleado: EmpleadoVerificable,
  ): void {
    if (!servicio.activo) {
      throw new ConflictException(
        'El servicio seleccionado ya no esta disponible.',
      );
    }
    if (!empleado.activo) {
      throw new ConflictException(
        'El profesional seleccionado ya no esta disponible.',
      );
    }
    if (!servicio.empleados.some((asignado) => asignado.id === empleado.id)) {
      throw new ConflictException(
        'El profesional seleccionado no realiza ese servicio.',
      );
    }
  }

  private async cargarContexto(
    tx: Prisma.TransactionClient,
    servicioId: string,
    empleadoId: string,
    inicio: Date,
  ) {
    const [servicio, empleado] = await Promise.all([
      tx.servicio.findUnique({
        where: { id: servicioId },
        include: { empleados: { select: { id: true } } },
      }),
      tx.empleado.findUnique({ where: { id: empleadoId } }),
    ]);
    if (!servicio || !empleado) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }

    // El servidor calcula `fin`. Los adicionales suman costo y nunca duracion.
    return {
      servicio,
      empleado,
      fin: sumarMinutos(inicio, servicio.duracionMinutos),
    };
  }

  private async cargarAdicionales(
    tx: Prisma.TransactionClient,
    ids?: string[],
  ) {
    const unicos = [...new Set(ids ?? [])];
    if (unicos.length === 0) {
      return [];
    }

    const adicionales = await tx.servicioAdicional.findMany({
      where: { id: { in: unicos } },
    });
    if (adicionales.length !== unicos.length) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    if (adicionales.some((adicional) => !adicional.activo)) {
      throw new ConflictException(
        'Alguno de los adicionales elegidos ya no esta disponible.',
      );
    }
    return adicionales;
  }

  private sumarPrecios(
    adicionales: { precio: Prisma.Decimal }[],
  ): Prisma.Decimal {
    return adicionales.reduce(
      (total, adicional) => total.add(adicional.precio),
      new Prisma.Decimal(0),
    );
  }

  /**
   * De quien es la cita. Con sesion sale del token; sin ella, del telefono, que es
   * la identidad del cliente en este producto (SPEC.md).
   *
   * Un invitado cuyo telefono ya existe cuelga la cita de esa ficha, pero **no** la
   * reescribe: nadie puede cambiarle el nombre o el correo a un cliente registrado
   * escribiendo su numero. Queda en pie que reservar a nombre de un telefono ajeno es
   * posible; sin verificacion del numero no hay forma de impedirlo, y lo que si se
   * impide es que la respuesta revele algo de la ficha — ver `comprobanteDeInvitado`.
   */
  private async resolverCliente(
    tx: Prisma.TransactionClient,
    dto: ReservarCitaDto,
    user?: AuthenticatedUser,
  ): Promise<ClienteAviso> {
    if (user) {
      const esPersonal =
        user.rol === Role.ADMIN || user.rol === Role.EMPLEADO;
      const id = esPersonal && dto.clienteId ? dto.clienteId : user.userId;
      const cliente = await tx.usuario.findUnique({
        where: { id },
        select: { ...CLIENTE_AVISO, activo: true },
      });
      if (!cliente || !cliente.activo) {
        throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
      }
      return cliente;
    }

    if (!dto.cliente) {
      throw new BadRequestException(
        'Hacen falta sus datos de contacto para reservar.',
      );
    }

    const telefono = normalizarTelefono(dto.cliente.telefono);
    const existente = await tx.usuario.findUnique({
      where: { telefono },
      select: { ...CLIENTE_AVISO, activo: true },
    });
    if (existente) {
      if (!existente.activo) {
        throw new ConflictException(
          'Ese telefono no puede reservar; comuniquese con el negocio.',
        );
      }
      return existente;
    }

    // Ficha sin contrasena: existe para colgar la cita de un telefono, no para
    // iniciar sesion. Ver el comentario de `Usuario.password` en el esquema.
    // El opt-in solo se fija al **crear** la ficha. Sobre una ficha que ya existe no
    // se toca: reservar con el telefono de otra persona no puede darle consentimiento
    // en su nombre. Quien ya tiene cuenta lo cambia desde su perfil.
    const creado = await tx.usuario.create({
      data: {
        telefono,
        nombre: dto.cliente.nombre.trim(),
        apellido: dto.cliente.apellido?.trim(),
        email: dto.cliente.email?.trim(),
        aceptaWhatsapp: dto.aceptaWhatsapp === true,
        aceptaWhatsappEn: dto.aceptaWhatsapp === true ? new Date() : null,
      },
      select: CLIENTE_AVISO,
    });
    return creado;
  }

  /**
   * Lo que ve quien reserva sin sesion. Omite `cliente` y `registradaPor` a
   * proposito: si el telefono ya pertenecia a un cliente registrado, devolver su
   * ficha convertiria la reserva de invitado en una consulta de datos ajenos.
   */
  private comprobanteDeInvitado(cita: {
    id: string;
    inicio: Date;
    fin: Date;
    precioServicio: Prisma.Decimal;
    costoAdicionales: Prisma.Decimal;
    costoTotal: Prisma.Decimal;
    estado: unknown;
    servicio: unknown;
    empleado: {
      id: string;
      usuario: { nombre: string; apellido: string | null };
    };
  }) {
    return {
      id: cita.id,
      inicio: cita.inicio,
      fin: cita.fin,
      precioServicio: cita.precioServicio,
      costoAdicionales: cita.costoAdicionales,
      costoTotal: cita.costoTotal,
      estado: cita.estado,
      servicio: cita.servicio,
      empleado: {
        id: cita.empleado.id,
        usuario: {
          nombre: cita.empleado.usuario.nombre,
          apellido: cita.empleado.usuario.apellido,
        },
      },
    };
  }

  private async filtroPorPropiedad(
    user: AuthenticatedUser,
  ): Promise<Prisma.CitaWhereInput> {
    if (user.rol === Role.ADMIN) {
      return {};
    }

    if (user.rol === Role.EMPLEADO) {
      const empleado = await this.prisma.empleado.findUnique({
        where: { usuarioId: user.userId },
        select: { id: true },
      });
      // Un usuario EMPLEADO sin ficha de Empleado no tiene agenda. Devolver un filtro
      // vacio aqui le mostraria las citas de todo el mundo.
      return empleado ? { empleadoId: empleado.id } : { id: { in: [] } };
    }

    return { clienteId: user.userId };
  }

  /** Estado que pide el cliente: si no existe, el cuerpo es invalido. */
  private async estadoSolicitado(codigo: string) {
    const estado = await this.catalogo.estado(codigo);
    if (!estado) {
      throw new BadRequestException('El estado indicado no existe.');
    }
    return estado;
  }

  /** Estado que el sistema da por sentado: si falta, la semilla no corrio. */
  private async estadoDeCatalogo(codigo: string) {
    const estado = await this.catalogo.estado(codigo);
    if (!estado) {
      throw new InternalServerErrorException(
        `Falta el estado "${codigo}" en el catalogo de EstadoCita.`,
      );
    }
    return estado;
  }

  /**
   * El unique `(empleadoId, slotOcupado)` es el que atrapa a dos clientes que pulsan
   * el mismo horario a la vez. Para quien reserva es el mismo hecho que un traslape
   * detectado, asi que es el mismo error. Ver 02-reservas-concurrencia.md.
   */
  private traducirChoqueDeUnicidad(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(MENSAJE_TRASLAPE);
    }
    return error;
  }
}
