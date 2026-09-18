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
import { EmpleadosService } from './empleados.service.js';
import { CrearEmpleadoDto } from './dto/crear-empleado.dto.js';
import { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto.js';

// Las lecturas son catalogo publico: EquipoPage y la reserva de invitado lo necesitan
// sin sesion. Solo registros activos y solo campos publicos. Ver 03-autorizacion.md.
//
// La gestion es la excepcion: otra ruta que si pide sesion, devuelve tambien lo dado de
// baja y agrega el telefono. Ver ProductosController y EmpleadosService.CAMPOS_GESTION.
@Controller('empleados')
export class EmpleadosController {
  constructor(private readonly service: EmpleadosService) {}

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
  create(@Body() dto: CrearEmpleadoDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEmpleadoDto) {
    return this.service.update(id, dto);
  }

  /** No borra la fila: da de baja la ficha y el acceso. Ver `EmpleadosService.remove`. */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
