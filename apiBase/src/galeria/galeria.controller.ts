import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { GaleriaService } from './galeria.service.js';
import { CrearFotoGaleriaDto } from './dto/crear-foto-galeria.dto.js';

/**
 * Fotos de resultados que el personal agrega a la galeria, ademas de las que ya traen los
 * servicios y el equipo del catalogo.
 *
 * La lectura es publica —la galeria es una vidriera— y solo trae fotos de servicios
 * publicados: la foto lleva al servicio, y no puede senalar uno que el visitante no ve.
 * Las escrituras son de ADMIN y EMPLEADO: quien atiende es quien tiene el resultado en
 * las manos. Ver 03-autorizacion.md.
 */
@Controller('galeria')
export class GaleriaController {
  constructor(private readonly service: GaleriaService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Post()
  create(@Body() dto: CrearFotoGaleriaDto) {
    return this.service.create(dto);
  }

  /**
   * Borra de verdad, fila y archivo: una foto de galeria no la cita ningun historial, y
   * "despublicarla" seria dejar una fila que ninguna pantalla puede volver a alcanzar.
   * Ver el modelo en `prisma/schema.prisma`.
   */
  @Roles(Role.ADMIN, Role.EMPLEADO)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
