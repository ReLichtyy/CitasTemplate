import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface.js';
import { CitasService } from './citas.service.js';

// Any authenticated role may reach these routes; CitasService is responsible
// for scoping results/actions to what that role is allowed to see (own vs all).
@Controller('citas')
export class CitasController {
  constructor(private readonly service: CitasService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  reservar(@Body() dto: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reservar(dto, user);
  }

  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  cancelar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancelar(id, user);
  }
}
