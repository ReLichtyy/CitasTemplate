import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Cuantas resenas acompañan a cada empleado en el catalogo. Ver 08-pagina-especialistas.md. */
const RESENAS_VISIBLES = 3;

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

  create(_dto: unknown) {
    throw new NotImplementedException('Empleado creation not implemented');
  }

  update(id: string, _dto: unknown) {
    throw new NotImplementedException(`Empleado ${id} update not implemented`);
  }

  remove(id: string) {
    throw new NotImplementedException(`Empleado ${id} removal not implemented`);
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
