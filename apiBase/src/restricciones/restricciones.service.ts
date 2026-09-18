import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearRestriccionDto } from './dto/crear-restriccion.dto.js';
import type { ActualizarRestriccionDto } from './dto/actualizar-restriccion.dto.js';

const MENSAJE_NO_ENCONTRADO = 'Recurso no encontrado.';

/**
 * La forma de gestion: el bloqueo con el nombre de quien bloquea, para que la lista se
 * lea sin abrir cada fila. El nombre sale del `Usuario`, no de la ficha de empleado.
 */
const CAMPOS = {
  id: true,
  tipo: true,
  empleadoId: true,
  inicio: true,
  fin: true,
  motivo: true,
  empleado: {
    select: { id: true, usuario: { select: { nombre: true, apellido: true } } },
  },
} satisfies Prisma.RestriccionHorarioSelect;

@Injectable()
export class RestriccionesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Las vigentes primero: la pantalla decide que hacer con las pasadas, pero de la base
   * llega lo mismo. Sin paginar como el resto de los catalogos de gestion. Ver 04-contrato-api.md.
   */
  findAll() {
    return this.prisma.restriccionHorario.findMany({
      select: CAMPOS,
      orderBy: { inicio: 'desc' },
    });
  }

  async findOne(id: string) {
    const restriccion = await this.prisma.restriccionHorario.findUnique({
      where: { id },
      select: CAMPOS,
    });
    if (!restriccion) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return restriccion;
  }

  async create(dto: CrearRestriccionDto) {
    await this.exigirRango(dto.inicio, dto.fin);
    if (dto.empleadoId) {
      await this.exigirEmpleado(dto.empleadoId);
    }
    return this.prisma.restriccionHorario.create({
      data: { ...dto, inicio: new Date(dto.inicio), fin: new Date(dto.fin) },
      select: CAMPOS,
    });
  }

  async update(id: string, dto: ActualizarRestriccionDto) {
    const actual = await this.exigir(id);
    await this.exigirRango(
      dto.inicio ?? actual.inicio.toISOString(),
      dto.fin ?? actual.fin.toISOString(),
    );
    if (dto.empleadoId) {
      await this.exigirEmpleado(dto.empleadoId);
    }
    return this.prisma.restriccionHorario.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.inicio === undefined ? {} : { inicio: new Date(dto.inicio) }),
        ...(dto.fin === undefined ? {} : { fin: new Date(dto.fin) }),
      },
      select: CAMPOS,
    });
  }

  /**
   * Borra de verdad: un bloqueo vencido no sirve de nada y no cuelga de ningun registro
   * historico — las citas de ese rango, si las hubo, ya quedaron tomadas o rechazadas.
   * Volver atras es volver a crearlo.
   */
  async remove(id: string) {
    await this.exigir(id);
    return this.prisma.restriccionHorario.delete({ where: { id }, select: CAMPOS });
  }

  /** El mismo semiabierto que el traslape de citas: un bloqueo que termina cuando empieza otro no choca. */
  private exigirRango(inicio: string, fin: string) {
    if (new Date(inicio).getTime() >= new Date(fin).getTime()) {
      throw new BadRequestException('El inicio debe ser anterior al fin.');
    }
  }

  /**
   * La llave foranea ya lo impediria, pero como 500 generico. Una consulta de mas por
   * alta vale el 400 con nombre de campo, igual que `ProductosService.exigirCategoria`.
   */
  private async exigirEmpleado(id: string) {
    const empleado = await this.prisma.empleado.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!empleado) {
      throw new BadRequestException('El profesional indicado no existe.');
    }
  }

  private async exigir(id: string) {
    const restriccion = await this.prisma.restriccionHorario.findUnique({
      where: { id },
      select: { inicio: true, fin: true },
    });
    if (!restriccion) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return restriccion;
  }
}
