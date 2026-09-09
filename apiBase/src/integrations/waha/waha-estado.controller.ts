import { HttpService } from '@nestjs/axios';
import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';

/**
 * Estado del canal de WhatsApp, para el personal.
 *
 * Vive en `integrations/waha/` y no en `health/` por la misma frontera de siempre: el
 * modulo de salud no tiene por que saber que del otro lado hay WAHA. Lo que sale de
 * aqui ya esta traducido a "operativo o no".
 *
 * No es `@Public()` ni entra en `/health` a secas: `/health` lo interroga el
 * orquestador para decidir si el contenedor sigue vivo, y el API sigue perfectamente
 * vivo con WhatsApp caido —las citas se reservan igual, el aviso es cortesia—. Mezclar
 * las dos cosas hace que una sesion sin parear reinicie el API en bucle.
 */
@Controller('health/whatsapp')
export class WahaEstadoController {
  private readonly logger = new Logger(WahaEstadoController.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Solo ADMIN: el estado dice si hay una sesion de WhatsApp viva y con que nombre, y
   * eso es reconocimiento gratis para quien alcance la ruta.
   */
  @Roles(Role.ADMIN)
  @Get()
  async estado(): Promise<{
    configurado: boolean;
    operativo: boolean;
    estado: string;
    numero?: string;
  }> {
    const url = this.config.get<string>('waha.url');
    const apiKey = this.config.get<string>('waha.apiKey');
    const sesion = this.config.get<string>('waha.session');

    if (!url || !apiKey || !sesion) {
      return { configurado: false, operativo: false, estado: 'SIN_CANAL' };
    }

    try {
      const { data } = await firstValueFrom(
        this.http.get<{ status?: string; me?: { id?: string } }>(
          `${url}/api/sessions/${encodeURIComponent(sesion)}`,
          {
            headers: { 'X-Api-Key': apiKey },
            timeout: this.config.get<number>('waha.timeoutMs'),
          },
        ),
      );

      return {
        configurado: true,
        operativo: data?.status === 'WORKING',
        estado: data?.status ?? 'DESCONOCIDO',
        numero: data?.me?.id,
      };
    } catch (error) {
      // El detalle va al log del personal, no a la respuesta: puede llevar la URL
      // interna del contenedor.
      this.logger.error(
        `No se pudo consultar el canal: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { configurado: true, operativo: false, estado: 'INALCANZABLE' };
    }
  }
}
