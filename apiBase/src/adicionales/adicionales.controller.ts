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
import { AdicionalesService } from './adicionales.service.js';
import { CrearAdicionalDto } from './dto/crear-adicional.dto.js';
import { ActualizarAdicionalDto } from './dto/actualizar-adicional.dto.js';

/**
 * Catalogo de complementos que suman costo pero nunca duracion.
 *
 * Las lecturas alcanzan a EMPLEADO porque atienden la agenda y necesitan explicar que
 * suma cada adicional; las escrituras son de ADMIN, que es quien fija precios. Ver
 * 03-autorizacion.md.
 */
@Controller('adicionales')
export class AdicionalesController {
  constructor(private readonly service: AdicionalesService) {}

  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // `ParseUUIDPipe` para que un id con forma invalida sea un 400 aqui y no una consulta a
  // la base que termina en 404.
  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CrearAdicionalDto) {
    return this.service.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarAdicionalDto) {
    return this.service.update(id, dto);
  }

  /** No borra la fila: despublica. Ver `AdicionalesService.remove`. */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
