import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
      throw new NotFoundException('Recurso no encontrado.');
    }
    return servicio;
  }

  create(_dto: unknown) {
    throw new NotImplementedException('Servicio creation not implemented');
  }

  update(id: string, _dto: unknown) {
    throw new NotImplementedException(`Servicio ${id} update not implemented`);
  }

  remove(id: string) {
    throw new NotImplementedException(`Servicio ${id} removal not implemented`);
  }
}
