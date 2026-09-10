import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { LimiteIntentos } from '../common/decorators/limite-intentos.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { LimiteIntentosGuard } from '../common/guards/limite-intentos.guard.js';
import { EventoClienteDto } from './dto/evento-cliente.dto.js';
import { TelemetriaService } from './telemetria.service.js';

@Controller('telemetria')
export class TelemetriaController {
  constructor(private readonly telemetria: TelemetriaService) {}

  /**
   * Recibe un fallo del navegador.
   *
   * Es `@Public()` porque el caso que mas importa es justo el que no tiene sesion: la
   * landing que revienta al renderizar, o el `ReservarPage` de un invitado. Exigir token
   * dejaria fuera el 100% del trafico anonimo, que es el de la demo.
   *
   * Publica y que escribe, entonces lleva limite por IP como las rutas de `auth` (ver
   * `apiBase/CLAUDE.md`). El numero es alto a proposito comparado con el del login: un
   * error de render en un `useEffect` puede repetirse varias veces antes de que el
   * cliente se calle solo, y perder un reporte legitimo es peor que registrar uno de mas.
   * El freno duro contra el bucle esta en el cliente (`lib/telemetria.ts`, con dedupe y
   * tope por sesion); esto es la red de abajo, para el cliente que no lo respete.
   *
   * Devuelve 204: no hay nada que contestarle a un reporte, y un cuerpo de respuesta seria
   * una superficie mas.
   */
  @Public()
  @UseGuards(LimiteIntentosGuard)
  @LimiteIntentos({ intentos: 30, ventanaMs: 5 * 60_000 })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('errores')
  reportar(@Body() dto: EventoClienteDto, @Req() request: Request) {
    this.telemetria.registrar(dto, {
      agente: request.headers['user-agent'],
      ip: request.ip,
    });
  }
}
