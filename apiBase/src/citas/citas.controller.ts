import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PropiedadCita } from '../common/decorators/propiedad.decorator.js';
import { AuthOpcional, Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface.js';
import { CitasService } from './citas.service.js';
import { ActualizarCitaDto } from './dto/actualizar-cita.dto.js';
import { CancelarCitaDto } from './dto/cancelar-cita.dto.js';
import { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto.js';
import { ReservarCitaDto } from './dto/reservar-cita.dto.js';

// Ninguna ruta de citas queda sin declarar rol y propiedad, igual que ninguna queda
// sin declarar autenticacion. Ver 03-autorizacion.md.
@Controller('citas')
export class CitasController {
  constructor(private readonly service: CitasService) {}

  // El filtrado por propiedad de una lista no lo puede hacer el guard, que solo ve
  // un id de ruta: va en la consulta de CitasService.findAll.
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user);
  }

  // Publica porque un invitado tiene que ver horarios antes de decidir si reserva.
  // Antes de @Get(':id'), o 'disponibilidad' se leeria como un id.
  @Public()
  @Get('disponibilidad')
  disponibilidad(@Query() query: ConsultarDisponibilidadDto) {
    return this.service.disponibilidad(query);
  }

  @PropiedadCita()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user);
  }

  // Se reserva con o sin sesion. Sin ella hay que mandar `cliente` con el telefono,
  // que es la identidad del cliente; con ella el cliente sale del token y un CLIENTE
  // solo puede reservar para si mismo. Lo resuelve CitasService, no el guard.
  @AuthOpcional()
  @Post()
  reservar(
    @Body() dto: ReservarCitaDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.reservar(dto, user);
  }

  @Roles(Role.ADMIN, Role.EMPLEADO)
  @PropiedadCita()
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: ActualizarCitaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  // No borra la fila: pasa la cita a CANCELADA y libera el espacio. Ver 02-reservas-concurrencia.md.
  @PropiedadCita()
  @Delete(':id')
  cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarCitaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancelar(id, dto, user);
  }
}
