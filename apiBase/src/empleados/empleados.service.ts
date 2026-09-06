import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
} satisfies Prisma.EmpleadoSelect;

@Injectable()
export class EmpleadosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.empleado.findMany({
      where: { activo: true },
      select: CAMPOS_PUBLICOS,
      orderBy: { usuario: { nombre: 'asc' } },
    });
  }

  async findOne(id: string) {
    const empleado = await this.prisma.empleado.findFirst({
      where: { id, activo: true },
      select: CAMPOS_PUBLICOS,
    });
    if (!empleado) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return empleado;
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
}
