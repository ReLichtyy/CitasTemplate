import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Prisma, Rol } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizarTelefono } from '../common/telefono.js';
import type { CrearEmpleadoDto } from './dto/crear-empleado.dto.js';
import type { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto.js';

/** Cuantas resenas acompañan a cada empleado en el catalogo. Ver 08-pagina-especialistas.md. */
const RESENAS_VISIBLES = 3;

/** Mismo coste que `AuthService`: cambiarlo aqui y no alla daria hash de dos fuerzas. */
const BCRYPT_ROUNDS = 12;

const MENSAJE_TELEFONO_TOMADO = 'Ese telefono ya pertenece a otra persona.';
const MENSAJE_NO_ENCONTRADO = 'Recurso no encontrado.';

/**
 * Del `Usuario` detras del empleado solo sale el nombre: el telefono es la credencial
 * de login en este producto y el correo es dato de contacto, ninguno de los dos es
 * catalogo publico. Ver 03-autorizacion.md.
 */
const CAMPOS_PUBLICOS = {
  id: true,
  bio: true,
  fotoUrl: true,
  usuario: { select: { nombre: true, apellido: true } },
  especialidad: { select: { id: true, nombre: true } },
  servicios: {
    where: { activo: true },
    select: { id: true, nombre: true, duracionMinutos: true, precio: true },
  },
  // Solo las moderadas, y solo las ultimas: la card muestra tres y pedir mas seria
  // traer texto que nadie va a leer.
  resenas: {
    where: { publicada: true },
    orderBy: { fecha: 'desc' },
    take: RESENAS_VISIBLES,
    select: { id: true, autor: true, puntuacion: true, comentario: true, fecha: true },
  },
} satisfies Prisma.EmpleadoSelect;

/**
 * La ficha completa para gestion. A diferencia del catalogo publico trae el `activo`, el
 * telefono (aqui si: quien administra tiene que poder llamar a su personal) y **todos**
 * los servicios asignados, tambien los desactivados — la gestion decide sobre la
 * asignacion, no la mira.
 */
const CAMPOS_GESTION = {
  id: true,
  bio: true,
  fotoUrl: true,
  activo: true,
  usuario: {
    select: { telefono: true, nombre: true, apellido: true, email: true },
  },
  especialidad: { select: { id: true, nombre: true } },
  servicios: { select: { id: true, nombre: true } },
} satisfies Prisma.EmpleadoSelect;

type EmpleadoFila = Prisma.EmpleadoGetPayload<{ select: typeof CAMPOS_PUBLICOS }>;

/** Promedio y total por empleado, calculados en la base y no sumando en memoria. */
type Agregado = { promedio: number; total: number };

@Injectable()
export class EmpleadosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const empleados = await this.prisma.empleado.findMany({
      where: { activo: true },
      select: CAMPOS_PUBLICOS,
      orderBy: { usuario: { nombre: 'asc' } },
    });
    const agregados = await this.agregados(empleados.map((e) => e.id));
    return empleados.map((empleado) => this.publico(empleado, agregados));
  }

  async findOne(id: string) {
    const empleado = await this.prisma.empleado.findFirst({
      where: { id, activo: true },
      select: CAMPOS_PUBLICOS,
    });
    if (!empleado) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return this.publico(empleado, await this.agregados([id]));
  }

  /**
   * Todo el equipo, activo o no, con la ficha completa. Sin paginar como el resto de los
   * catalogos de gestion: el tamano de esta lista es el numero de personas del negocio.
   */
  listarParaGestion() {
    return this.prisma.empleado.findMany({
      select: CAMPOS_GESTION,
      orderBy: { usuario: { nombre: 'asc' } },
    });
  }

  /**
   * Alta de un profesional: la ficha laboral y su cuenta, o nada.
   *
   * Un telefono que ya tenga contrasena es de otra persona y se rechaza con 409; uno con
   * ficha de invitado sin contrasena se reclama — mismo telefono, mismo nombre de pila en
   * la agenda de ese cliente — y se promueve a EMPLEADO. La promocion y el alta viven en
   * una `$transaction`: un `Usuario` EMPLEADO sin ficha seria alguien que entra a la
   * gestion sin existir en el catalogo.
   */
  async create(dto: CrearEmpleadoDto) {
    const telefono = normalizarTelefono(dto.telefono);
    const passwordHash = await this.hashear(dto.password);

    await this.exigirEspecialidad(dto.especialidadId);
    await this.exigirServicios(dto.servicioIds);

    const existente = await this.prisma.usuario.findUnique({
      where: { telefono },
      select: { id: true, password: true, empleado: { select: { id: true } } },
    });
    if (existente?.password) {
      throw new ConflictException(MENSAJE_TELEFONO_TOMADO);
    }
    if (existente?.empleado) {
      throw new ConflictException('Ese telefono ya tiene ficha de profesional.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const usuario = existente
          ? await tx.usuario.update({
              where: { id: existente.id },
              data: {
                rol: Rol.EMPLEADO,
                nombre: dto.nombre,
                apellido: dto.apellido ?? null,
                ...(passwordHash ? { password: passwordHash } : {}),
                ...(dto.email === undefined ? {} : { email: dto.email }),
              },
              select: { id: true },
            })
          : await tx.usuario.create({
              data: {
                telefono,
                nombre: dto.nombre,
                apellido: dto.apellido ?? null,
                email: dto.email,
                rol: Rol.EMPLEADO,
                ...(passwordHash ? { password: passwordHash } : {}),
              },
              select: { id: true },
            });

        return tx.empleado.create({
          data: {
            usuarioId: usuario.id,
            bio: dto.bio,
            fotoUrl: dto.fotoUrl,
            ...(dto.especialidadId === undefined
              ? {}
              : { especialidadId: dto.especialidadId }),
            ...(dto.servicioIds
              ? { servicios: { connect: dto.servicioIds.map((id) => ({ id })) } }
              : {}),
          },
          select: CAMPOS_GESTION,
        });
      });
    } catch (error) {
      // Dos altas con el mismo telefono a la vez: el unique decide, la consulta de arriba
      // no alcanza. Ver `AuthService.registro`, que traduce el mismo caso.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(MENSAJE_TELEFONO_TOMADO);
      }
      throw error;
    }
  }

  /**
   * Edicion de la ficha. El telefono y la contrasena tocan el `Usuario`; lo demas, la
   * ficha. La contrasena que viene es un reinicio del ADMIN, no la rotacion del propio
   * usuario (esa es `POST /auth/password`, que exige la actual).
   */
  async update(id: string, dto: ActualizarEmpleadoDto) {
    const empleado = await this.exigir(id);

    if (dto.especialidadId) {
      await this.exigirEspecialidad(dto.especialidadId);
    }
    await this.exigirServicios(dto.servicioIds);

    const passwordHash = await this.hashear(dto.password);
    const telefono =
      dto.telefono === undefined ? undefined : normalizarTelefono(dto.telefono);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.usuario.update({
          where: { id: empleado.usuarioId },
          data: {
            ...(telefono === undefined ? {} : { telefono }),
            ...(dto.nombre === undefined ? {} : { nombre: dto.nombre }),
            ...(dto.apellido === undefined ? {} : { apellido: dto.apellido }),
            ...(dto.email === undefined ? {} : { email: dto.email }),
            ...(passwordHash ? { password: passwordHash } : {}),
            // El mismo interruptor de la ficha: la baja tambien corta el acceso. Ver el DTO.
            ...(dto.activo === undefined ? {} : { activo: dto.activo }),
          },
          select: { id: true },
        });
        return tx.empleado.update({
          where: { id },
          data: {
            ...(dto.bio === undefined ? {} : { bio: dto.bio }),
            ...(dto.fotoUrl === undefined ? {} : { fotoUrl: dto.fotoUrl }),
            ...(dto.especialidadId === undefined
              ? {}
              : { especialidadId: dto.especialidadId }),
            ...(dto.activo === undefined ? {} : { activo: dto.activo }),
            // `set` y no `connect`: la lista que trae el parche es la asignacion completa.
            ...(dto.servicioIds === undefined
              ? {}
              : { servicios: { set: dto.servicioIds.map((sid) => ({ id: sid })) } }),
          },
          select: CAMPOS_GESTION,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(MENSAJE_TELEFONO_TOMADO);
      }
      throw error;
    }
  }

  /**
   * La baja, no el borrado.
   *
   * Un empleado cuelga de cada `Cita` que atendio, y borrar la ficha reventaria el
   * historial de la agenda. Apagar `activo` lo saca del catalogo publico — y con el, de
   * la reserva — sin perder nada. El `Usuario` se desactiva en la misma transaccion: una
   * persona dada de baja no queda dentro de la gestion con su sesion viva.
   */
  async remove(id: string) {
    const empleado = await this.exigir(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: empleado.usuarioId },
        data: { activo: false },
        select: { id: true },
      });
      return tx.empleado.update({
        where: { id },
        data: { activo: false },
        select: CAMPOS_GESTION,
      });
    });
  }

  /** `null` limpia la especialidad; para limpiar no hay nada que comprobar. */
  private async exigirEspecialidad(id?: string | null) {
    if (!id) {
      return;
    }
    const especialidad = await this.prisma.especialidad.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!especialidad) {
      throw new BadRequestException('La especialidad indicada no existe.');
    }
  }

  /** La llave foranea ya lo impediria, pero como 500 generico. Ver `ProductosService`. */
  private async exigirServicios(ids?: string[]) {
    if (!ids || ids.length === 0) {
      return;
    }
    const servicios = await this.prisma.servicio.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (servicios.length !== new Set(ids).size) {
      throw new BadRequestException('Alguno de los servicios indicados no existe.');
    }
  }

  private async hashear(password?: string) {
    return password ? hash(password, BCRYPT_ROUNDS) : undefined;
  }

  private async exigir(id: string) {
    const empleado = await this.prisma.empleado.findUnique({
      where: { id },
      select: { id: true, usuarioId: true },
    });
    if (!empleado) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return empleado;
  }

  /**
   * Una sola consulta para todos los empleados de la pagina. La alternativa —un
   * `aggregate` por empleado— multiplica las idas a la base por el largo del catalogo.
   */
  private async agregados(empleadoIds: string[]): Promise<Map<string, Agregado>> {
    if (empleadoIds.length === 0) {
      return new Map();
    }
    const filas = await this.prisma.resena.groupBy({
      by: ['empleadoId'],
      where: { publicada: true, empleadoId: { in: empleadoIds } },
      _avg: { puntuacion: true },
      _count: { _all: true },
    });
    return new Map(
      filas.map((fila) => [
        fila.empleadoId,
        { promedio: fila._avg.puntuacion ?? 0, total: fila._count._all },
      ]),
    );
  }

  /**
   * Arma la forma que consume el catalogo. El `rating` es **nulo** mientras no haya
   * resenas publicadas: la card lo distingue de un cero, que se leeria como una mala
   * calificacion en vez de como ausencia de opiniones.
   */
  private publico(empleado: EmpleadoFila, agregados: Map<string, Agregado>) {
    const agregado = agregados.get(empleado.id);
    const { resenas, ...resto } = empleado;
    return {
      ...resto,
      rating:
        agregado && agregado.total > 0
          ? {
              // Un decimal: la card muestra "4.8" y guardar mas precision solo invita a
              // que el frontend la redondee de otra forma.
              promedio: Math.round(agregado.promedio * 10) / 10,
              total: agregado.total,
              ultimasResenas: resenas.map((resena) => ({
                ...resena,
                // Fecha sin hora: es el dia de la experiencia, no un instante. Mandar el
                // ISO completo obligaria al navegador a decidir zona horaria para algo
                // que no la tiene.
                fecha: resena.fecha.toISOString().slice(0, 10),
              })),
            }
          : null,
    };
  }
}
