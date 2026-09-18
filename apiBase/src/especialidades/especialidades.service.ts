import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Lo que necesita la gestion para armar el formulario de un empleado: elegir una
 * especialidad es elegir de una lista corta con nombre y descripcion, nada mas. El
 * catalogo publico no la consulta — la especialidad viaja dentro de cada empleado.
 */
const CAMPOS = {
  id: true,
  nombre: true,
  descripcion: true,
} satisfies Prisma.EspecialidadSelect;

@Injectable()
export class EspecialidadesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Todo lo que hay: las especialidades no se moderan ni se ocultan, se usan o se
   * dejan de usar. Es la lista mas corta del sistema y la escribe el negocio a mano.
   */
  findAll() {
    return this.prisma.especialidad.findMany({
      select: CAMPOS,
      orderBy: { nombre: 'asc' },
    });
  }
}
