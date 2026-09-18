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
import { HorariosService } from './horarios.service.js';
import { CrearHorarioDto } from './dto/crear-horario.dto.js';
import { ActualizarHorarioDto } from './dto/actualizar-horario.dto.js';

/**
 * La semana de atencion del negocio.
 *
 * Las lecturas alcanzan a EMPLEADO porque su agenda depende de estos rangos; cambiar la
 * semana es de ADMIN, porque afecta a todos por igual. Ver 03-autorizacion.md.
 */
@Controller('horarios')
export class HorariosController {
  constructor(private readonly service: HorariosService) {}

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
  create(@Body() dto: CrearHorarioDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarHorarioDto) {
    return this.service.update(id, dto);
  }

  /** Si borra la fila: una franja no queda citada en ningun historico. */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
