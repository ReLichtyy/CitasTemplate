import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ProductosService } from './productos.service.js';
import { CrearProductoDto } from './dto/crear-producto.dto.js';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto.js';

/**
 * Catalogo de productos.
 *
 * Las lecturas son publicas —`ProductosPage` no pide sesion— y devuelven solo lo publicado
 * y solo campos publicos. Las escrituras son de ADMIN: un EMPLEADO atiende citas, no fija
 * precios. Ver `03-autorizacion.md`.
 */
@Controller('productos')
export class ProductosController {
  constructor(private readonly service: ProductosService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Antes de `@Get(':id')`, o 'categorias' se leeria como un id. Lo mismo que pasa con
  // `/citas/disponibilidad`.
  @Public()
  @Get('categorias')
  categorias() {
    return this.service.categorias();
  }

  /**
   * La lista de gestion es **otra ruta**, no la publica con un parametro.
   *
   * Un `?incluirInactivos=true` sobre la ruta publica deja la visibilidad del catalogo
   * dependiendo de que el guard y el servicio se pongan de acuerdo en cada peticion; una
   * ruta aparte con su propio `@Roles` no puede filtrar de mas ni por descuido.
   */
  @Roles(Role.ADMIN)
  @Get('gestion')
  listarParaGestion() {
    return this.service.listarParaGestion();
  }

  // `ParseUUIDPipe` para que un id con forma invalida sea un 400 aqui y no una consulta a
  // la base que termina en 404.
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CrearProductoDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarProductoDto) {
    return this.service.update(id, dto);
  }

  /** No borra la fila: despublica. Ver `ProductosService.remove`. */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
