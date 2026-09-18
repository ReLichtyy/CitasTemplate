import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearAdicionalDto } from './dto/crear-adicional.dto.js';
import type { ActualizarAdicionalDto } from './dto/actualizar-adicional.dto.js';

const MENSAJE_NO_ENCONTRADO = 'Recurso no encontrado.';

/**
 * La forma completa, `activo` incluido: las lecturas de `/adicionales` son de gestion
 * (ADMIN/EMPLEADO), no hay catalogo publico que las consuma. Que un adicional este apagado
 * es informacion para quien administra, no algo que esconderle.
 */
const CAMPOS = {
  id: true,
  nombre: true,
  descripcion: true,
  precio: true,
  activo: true,
} satisfies Prisma.ServicioAdicionalSelect;

@Injectable()
export class AdicionalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sin paginar, como `GET /productos/gestion`: un catalogo lo escribe una persona a mano
   * y su tamano es el numero de complementos que el negocio ofrece. Ver 04-contrato-api.md.
   */
  findAll() {
    return this.prisma.servicioAdicional.findMany({
      select: CAMPOS,
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string) {
    const adicional = await this.prisma.servicioAdicional.findUnique({
      where: { id },
      select: CAMPOS,
    });
    if (!adicional) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return adicional;
  }

  create(dto: CrearAdicionalDto) {
    return this.prisma.servicioAdicional.create({
      data: { ...dto, precio: new Prisma.Decimal(dto.precio) },
      select: CAMPOS,
    });
  }

  async update(id: string, dto: ActualizarAdicionalDto) {
    await this.exigir(id);
    return this.prisma.servicioAdicional.update({
      where: { id },
      data: {
        ...dto,
        // Solo si vino: `undefined` deja el campo como esta, y `new Decimal(undefined)`
        // reventaria antes de llegar a la base. Igual que en productos.
        ...(dto.precio === undefined ? {} : { precio: new Prisma.Decimal(dto.precio) }),
      },
      select: CAMPOS,
    });
  }

  /**
   * Despublica, no borra.
   *
   * Un adicional queda congelado en cada `CitaAdicional` que lo cito: el precio de esa
   * fila es historico, pero la llave foranea sigue apuntando aqui, y borrarla reventaria
   * la ficha de una cita pasada. Apagar `activo` lo saca de la reserva (`CitasService`
   * rechaza los inactivos con 409) y lo deja recuperable desde la misma lista.
   */
  async remove(id: string) {
    await this.exigir(id);
    return this.prisma.servicioAdicional.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS,
    });
  }

  private async exigir(id: string) {
    const adicional = await this.prisma.servicioAdicional.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!adicional) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
  }
}
