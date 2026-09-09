import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { LimiteIntentos } from '../common/decorators/limite-intentos.decorator.js';
import { LimiteIntentosGuard } from '../common/guards/limite-intentos.guard.js';
import { PropiedadCita } from '../common/decorators/propiedad.decorator.js';
import { AuthOpcional, Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface.js';
import { CitasService } from './citas.service.js';
import { ActualizarCitaDto } from './dto/actualizar-cita.dto.js';
import { ConsultarCitasDto } from './dto/consultar-citas.dto.js';
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
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ConsultarCitasDto,
  ) {
    return this.service.findAll(user, query);
  }

  // Publica porque un invitado tiene que ver horarios antes de decidir si reserva.
  // Antes de @Get(':id'), o 'disponibilidad' se leeria como un id.
  //
  // Con freno por IP: es la unica ruta abierta que hace trabajo de verdad —cuatro
  // consultas y un barrido de la jornada por peticion— y la regla del CLAUDE.md es que
  // toda ruta @Public() que cueste trabajo lo lleve. El numero es holgado: una pagina de
  // reserva consulta un dia por clic mientras el cliente compara horarios.
  @Public()
  @UseGuards(LimiteIntentosGuard)
  @LimiteIntentos({ intentos: 120, ventanaMs: 10 * 60_000 })
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
  // Es la unica escritura que acepta un invitado, asi que tambien es la unica que se
  // puede repetir sin cuenta: se limita por IP. El numero es holgado a proposito — una
  // familia detras de la misma IP reserva varias veces y eso es trafico legitimo.
  @AuthOpcional()
  @UseGuards(LimiteIntentosGuard)
  @LimiteIntentos({ intentos: 20, ventanaMs: 60 * 60_000 })
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
