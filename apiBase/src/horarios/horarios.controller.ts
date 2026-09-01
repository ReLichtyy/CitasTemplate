import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { HorariosService } from './horarios.service.js';

// TODO: refine per-role read access once business rules for horarios are written.
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
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: unknown) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: unknown) {
    return this.service.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
