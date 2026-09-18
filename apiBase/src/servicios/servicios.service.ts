import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearServicioDto } from './dto/crear-servicio.dto.js';
import type { ActualizarServicioDto } from './dto/actualizar-servicio.dto.js';

/**
 * Lo que puede ver cualquiera. `activo` no sale: para un visitante no existe la
 * nocion de un servicio desactivado, solo la de un catalogo. Ver 03-autorizacion.md.
 */
const CAMPOS_PUBLICOS = {
  id: true,
  nombre: true,
  descripcion: true,
  duracionMinutos: true,
  precio: true,
  imagenUrl: true,
  // Quien lo realiza: es lo que permite elegir profesional al reservar.
  empleados: {
    where: { activo: true },
    select: {
      id: true,
      fotoUrl: true,
      usuario: { select: { nombre: true, apellido: true } },
    },
  },
} satisfies Prisma.ServicioSelect;

/**
 * Todo el catalogo para gestion, publicado o no. A diferencia de la proyeccion publica,
 * trae el `activo` de cada servicio y **todos** sus profesionales — tambien los inactivos:
 * quien administra necesita ver la asignacion completa para decidir si la cambia, no la
 * porcion que el catalogo publico esta dispuesto a contar.
 */
const CAMPOS_GESTION = {
  ...CAMPOS_PUBLICOS,
  activo: true,
  empleados: {
    select: {
      id: true,
      fotoUrl: true,
      activo: true,
      usuario: { select: { nombre: true, apellido: true } },
    },
  },
} satisfies Prisma.ServicioSelect;

const MENSAJE_NO_ENCONTRADO = 'Recurso no encontrado.';

@Injectable()
export class ServiciosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.servicio.findMany({
      where: { activo: true },
      select: CAMPOS_PUBLICOS,
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string) {
    const servicio = await this.prisma.servicio.findFirst({
      where: { id, activo: true },
      select: CAMPOS_PUBLICOS,
    });
    if (!servicio) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return servicio;
  }

  /** Todo el catalogo, publicado o no, con la asignacion completa. Solo gestion. */
  listarParaGestion() {
    return this.prisma.servicio.findMany({
      select: CAMPOS_GESTION,
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CrearServicioDto) {
    const { empleadoIds, ...datos } = dto;
    if (empleadoIds) {
      await this.exigirEmpleados(empleadoIds);
    }
    return this.prisma.servicio.create({
      data: {
        ...datos,
        precio: new Prisma.Decimal(dto.precio),
        ...(empleadoIds ? { empleados: { connect: empleadoIds.map((id) => ({ id })) } } : {}),
      },
      select: CAMPOS_GESTION,
    });
  }

  async update(id: string, dto: ActualizarServicioDto) {
    const { empleadoIds, ...datos } = dto;
    if (empleadoIds) {
      await this.exigirEmpleados(empleadoIds);
    }
    await this.exigir(id);
    return this.prisma.servicio.update({
      where: { id },
      data: {
        ...datos,
        ...(dto.precio === undefined ? {} : { precio: new Prisma.Decimal(dto.precio) }),
        // `set` y no `connect`: la lista que trae el parche es la asignacion completa.
        // Con `connect`, dar de baja a uno solo obligaba a mandar la lista de todos los
        // que se querian conservar mas el nuevo — recargarla en memoria desde la base.
        ...(empleadoIds === undefined ? {} : { empleados: { set: empleadoIds.map((id) => ({ id })) } }),
      },
      select: CAMPOS_GESTION,
    });
  }

  /**
   * Desactiva, no borra.
   *
   * Un servicio cuelga de cada `Cita` que lo reservo — con su precio congelado en la
   * propia cita, pero la fila sigue siendo la que nombra que se hizo — y borrarlo
   * reventaria el historial. Apagar `activo` lo saca del catalogo publico y de la
   * reserva, y lo deja recuperable desde la misma lista de gestion.
   */
  async remove(id: string) {
    await this.exigir(id);
    return this.prisma.servicio.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS_GESTION,
    });
  }

  private async exigir(id: string) {
    const servicio = await this.prisma.servicio.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!servicio) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
  }

  /**
   * La llave foranea ya lo impediria, pero como 500 generico. Una consulta de mas por
   * alta vale el 400 con nombre de campo, igual que `ProductosService.exigirCategoria`.
   */
  private async exigirEmpleados(ids: string[]) {
    const empleados = await this.prisma.empleado.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (empleados.length !== new Set(ids).size) {
      throw new BadRequestException('Alguno de los profesionales indicados no existe.');
    }
  }
}
