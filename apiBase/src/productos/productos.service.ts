import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearProductoDto } from './dto/crear-producto.dto.js';
import type { ActualizarProductoDto } from './dto/actualizar-producto.dto.js';

const MENSAJE_NO_ENCONTRADO = 'Recurso no encontrado.';

/**
 * Lo que puede ver cualquiera.
 *
 * `activo` **no** sale, igual que en servicios: para un visitante no existe la nocion de un
 * producto despublicado, solo la de un catalogo. `disponible` **si** sale, porque es lo que
 * pinta el chip de agotado — y esa es justamente la diferencia entre los dos indicadores.
 */
const CAMPOS_PUBLICOS = {
  id: true,
  nombre: true,
  descripcion: true,
  precio: true,
  presentacion: true,
  imagenUrl: true,
  disponible: true,
  categoriaId: true,
} satisfies Prisma.ProductoSelect;

/** En gestion se ve todo, incluido lo despublicado: es de lo que trata la pantalla. */
const CAMPOS_GESTION = {
  ...CAMPOS_PUBLICOS,
  activo: true,
  creadoEn: true,
  actualizadoEn: true,
  categoria: { select: { id: true, nombre: true } },
} satisfies Prisma.ProductoSelect;

const CATEGORIA_PUBLICA = {
  id: true,
  nombre: true,
  promesa: true,
  descripcion: true,
} satisfies Prisma.CategoriaProductoSelect;

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sin paginar, como `GET /servicios` y `GET /empleados`.
   *
   * La regla de la pagina acotada existe por `GET /citas`, que crece con cada reserva y sin
   * cota se llevaba anos de historial. Un catalogo no: lo escribe una persona a mano y su
   * tamano es el numero de cosas que el negocio vende. Cuando eso deje de ser cierto, esto
   * se pagina igual que las citas — no antes. Ver `04-contrato-api.md`.
   */
  findAll() {
    return this.prisma.producto.findMany({
      // La categoria tambien tiene que estar publicada: apagar una categoria esconde lo que
      // cuelga de ella, que es lo que uno espera al apagarla.
      where: { activo: true, categoria: { activa: true } },
      select: CAMPOS_PUBLICOS,
      orderBy: [{ categoria: { orden: 'asc' } }, { nombre: 'asc' }],
    });
  }

  /** Las categorias con su texto: es la seccion que ordena el catalogo antes de la rejilla. */
  categorias() {
    return this.prisma.categoriaProducto.findMany({
      where: { activa: true },
      select: CATEGORIA_PUBLICA,
      orderBy: { orden: 'asc' },
    });
  }

  async findOne(id: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, activo: true, categoria: { activa: true } },
      select: CAMPOS_PUBLICOS,
    });
    if (!producto) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return producto;
  }

  /** Todo el catalogo, publicado o no. Solo ADMIN. */
  listarParaGestion() {
    return this.prisma.producto.findMany({
      select: CAMPOS_GESTION,
      orderBy: [{ categoria: { orden: 'asc' } }, { nombre: 'asc' }],
    });
  }

  async create(dto: CrearProductoDto) {
    await this.exigirCategoria(dto.categoriaId);
    return this.prisma.producto.create({
      data: { ...dto, precio: new Prisma.Decimal(dto.precio) },
      select: CAMPOS_GESTION,
    });
  }

  async update(id: string, dto: ActualizarProductoDto) {
    if (dto.categoriaId) {
      await this.exigirCategoria(dto.categoriaId);
    }
    await this.exigirProducto(id);
    return this.prisma.producto.update({
      where: { id },
      data: {
        ...dto,
        // Solo si vino: `undefined` deja el campo como esta, y `new Decimal(undefined)`
        // reventaria antes de llegar a la base.
        ...(dto.precio === undefined ? {} : { precio: new Prisma.Decimal(dto.precio) }),
      },
      select: CAMPOS_GESTION,
    });
  }

  /**
   * Despublica, no borra.
   *
   * Un producto puede estar citado en una recomendacion vieja o en material impreso, y
   * `DELETE` es la unica operacion de esta pantalla que no se deshace. Apagar `activo` lo
   * saca del catalogo publico y lo deja recuperable desde la misma lista de gestion, que es
   * lo que alguien quiere el 100% de las veces que pulsa "eliminar" en un catalogo.
   */
  async remove(id: string) {
    await this.exigirProducto(id);
    return this.prisma.producto.update({
      where: { id },
      data: { activo: false },
      select: CAMPOS_GESTION,
    });
  }

  /**
   * La llave foranea ya lo impediria, pero el error de Prisma sale como 500 generico —el
   * filtro no publica mensajes de la base— y quien esta llenando el formulario se queda sin
   * saber que fue la categoria. Una consulta de mas por alta vale ese 400.
   */
  private async exigirCategoria(id: string) {
    const categoria = await this.prisma.categoriaProducto.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!categoria) {
      throw new BadRequestException('La categoria indicada no existe.');
    }
  }

  private async exigirProducto(id: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!producto) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
  }
}
