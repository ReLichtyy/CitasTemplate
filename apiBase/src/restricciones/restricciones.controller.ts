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
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { RestriccionesService } from './restricciones.service.js';
import { CrearRestriccionDto } from './dto/crear-restriccion.dto.js';
import { ActualizarRestriccionDto } from './dto/actualizar-restriccion.dto.js';

/**
 * Bloqueos puntuales: feriados, vacaciones, cierres.
 *
 * Las lecturas alcanzan a EMPLEADO porque su agenda depende de ellos; los bloqueos los
 * decide ADMIN, porque un cierre del negocio entero no es decision de quien atiende.
 * Ver 03-autorizacion.md.
 */
@Controller('restricciones')
export class RestriccionesController {
  constructor(private readonly service: RestriccionesService) {}

  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CrearRestriccionDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarRestriccionDto) {
    return this.service.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
