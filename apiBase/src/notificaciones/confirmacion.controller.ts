import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { LimiteIntentos } from '../common/decorators/limite-intentos.decorator.js';
import { LimiteIntentosGuard } from '../common/guards/limite-intentos.guard.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ConfirmacionService } from './confirmacion.service.js';
import { ConfirmarCitaDto } from './dto/confirmar-cita.dto.js';

/**
 * Confirmacion por enlace firmado.
 *
 * No existe ningun `GET /citas/confirmar/:token` en el API: esa ruta es del
 * frontend. Aqui las dos operaciones son POST porque un prefetch —de WhatsApp al
 * previsualizar el enlace, o del navegador— no hace POST, y un GET que confirma
 * confirmaria la cita solo. Ver 09-conexion-whatsapp.md.
 *
 * Es una escritura abierta a un invitado, como `POST /citas`: publica porque quien
 * confirma no tiene sesion, y limitada por IP porque hace trabajo por peticion.
 */
@Controller('citas/confirmacion')
export class ConfirmacionController {
  constructor(private readonly service: ConfirmacionService) {}

  /** Solo lee, para que la pagina pinte la cita antes de que alguien pulse el boton. */
  @Public()
  @UseGuards(LimiteIntentosGuard)
  @LimiteIntentos({ intentos: 30, ventanaMs: 15 * 60_000 })
  @HttpCode(200)
  @Post('consulta')
  consultar(@Body() dto: ConfirmarCitaDto) {
    return this.service.consultar(dto.token);
  }

  @Public()
  @UseGuards(LimiteIntentosGuard)
  @LimiteIntentos({ intentos: 15, ventanaMs: 15 * 60_000 })
  @HttpCode(200)
  @Post()
  confirmar(@Body() dto: ConfirmarCitaDto) {
    return this.service.confirmar(dto.token);
  }
}
