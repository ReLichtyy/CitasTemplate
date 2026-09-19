import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ArchivosService } from '../archivos/archivos.service.js';
import type { CrearFotoGaleriaDto } from './dto/crear-foto-galeria.dto.js';

/**
 * Lo que puede ver cualquiera. El servicio llega con su nombre: es el subtitulo de la
 * foto en la galeria y la respuesta a "con que servicio se logro este resultado".
 */
const CAMPOS_PUBLICOS = {
  id: true,
  imagenUrl: true,
  descripcion: true,
  servicio: { select: { id: true, nombre: true } },
} satisfies Prisma.FotoGaleriaSelect;

const MENSAJE_NO_ENCONTRADO = 'Recurso no encontrado.';

@Injectable()
export class GaleriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly archivos: ArchivosService,
  ) {}

  /** Fotos de resultados, la mas reciente primero y solo de servicios publicados. */
  findAll() {
    return this.prisma.fotoGaleria.findMany({
      where: { servicio: { activo: true } },
      select: CAMPOS_PUBLICOS,
      orderBy: { creadoEn: 'desc' },
    });
  }

  async create(dto: CrearFotoGaleriaDto) {
    const servicio = await this.prisma.servicio.findUnique({
      where: { id: dto.servicioId },
      select: { id: true },
    });
    if (!servicio) {
      // La llave foranea ya lo impediria, pero como 500 generico. Una consulta de mas
      // por alta vale el 400 con nombre de campo, igual que `ServiciosService.exigirEmpleados`.
      throw new BadRequestException('El servicio indicado no existe.');
    }
    return this.prisma.fotoGaleria.create({
      data: {
        imagenUrl: dto.imagenUrl,
        servicioId: dto.servicioId,
        ...(dto.descripcion ? { descripcion: dto.descripcion } : {}),
      },
      select: CAMPOS_PUBLICOS,
    });
  }

  /**
   * Borra la fila y el archivo que la sirve. La foto no la cita nadie mas, y la URL que
   * quedo en la fila era la unica referencia al archivo en disco. Ver el modelo en
   * `prisma/schema.prisma`: aqui el borrado es de verdad y no una despublicacion.
   */
  async remove(id: string): Promise<void> {
    const foto = await this.prisma.fotoGaleria.findUnique({
      where: { id },
      select: { imagenUrl: true },
    });
    if (!foto) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    await this.prisma.fotoGaleria.delete({ where: { id } });
    const nombre = this.nombreDeArchivo(foto.imagenUrl);
    if (nombre) {
      try {
        await this.archivos.eliminar(nombre);
      } catch {
        // Mejor esfuerzo: la fila ya se borro, y lo que quede es un huerfano de disco,
        // no un enlace roto.
      }
    }
  }

  /**
   * Nombre del archivo dentro de la URL que devolvio `POST /archivos`, o nulo si la URL
   * no apunta al almacen propio. Solo lo que subio este API se puede borrar de su disco:
   * una URL externa no es nuestra para tocarla.
   */
  private nombreDeArchivo(url: string): string | null {
    try {
      const { pathname } = new URL(url);
      if (!pathname.startsWith('/archivos/')) {
        return null;
      }
      return pathname.split('/').pop() ?? null;
    } catch {
      return null;
    }
  }
}
