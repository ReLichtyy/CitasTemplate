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
import { ServiciosService } from './servicios.service.js';
import { CrearServicioDto } from './dto/crear-servicio.dto.js';
import { ActualizarServicioDto } from './dto/actualizar-servicio.dto.js';

// Las lecturas son catalogo publico: ServiciosPage y la reserva de invitado lo
// necesitan sin sesion. Devuelven solo registros activos y solo campos publicos, que
// es lo que permite abrirlas sin abrir la gestion. Ver 03-autorizacion.md.
//
// La gestion es la excepcion: otra ruta (no la publica con un parametro) que si pide
// sesion y devuelve tambien lo desactivado. Ver ProductosController.
@Controller('servicios')
export class ServiciosController {
  constructor(private readonly service: ServiciosService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Antes de `@Get(':id')`, o 'gestion' se leeria como un id.
  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Get('gestion')
  listarParaGestion() {
    return this.service.listarParaGestion();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CrearServicioDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarServicioDto) {
    return this.service.update(id, dto);
  }

  /** No borra la fila: desactiva. Ver `ServiciosService.remove`. */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
