import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Cuanto se espera a que la base conteste antes de darla por caida. Corto a proposito:
 * la sonda la llama el vigia cada 60 s con `--max-time 10`, y una base que tarda cinco
 * segundos en responder `SELECT 1` ya esta rota para lo que el sitio necesita.
 */
const TIMEOUT_BASE_MS = 3000;

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vida, no salud: responde mientras el proceso pueda atender una peticion.
   *
   * Es la que interroga el `HEALTHCHECK` de la imagen y la que mira Traefik para
   * decidir si mandarle trafico a este contenedor. No toca la base a proposito: un
   * hipo de MariaDB no puede sacar de rotacion a un proceso que esta perfectamente
   * vivo y que, en cuanto la base vuelva, sigue sirviendo.
   */
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Salud de verdad: el API **y** la base.
   *
   * Existe porque `/health` a secas daba verde con MariaDB caida, y eso dejaba dos
   * agujeros: el vigia no avisaba de la unica caida que no se arregla sola, y
   * `deploy.sh` daba por bueno un despliegue que no podia atender una sola reserva.
   *
   * Separada de `/health` por lo contrario del mismo motivo: aqui un fallo tiene que
   * gritar, no reiniciar nada.
   */
  @Public()
  @Get('listo')
  async listo(): Promise<{ status: string; base: string }> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, rechazar) =>
          setTimeout(
            () => rechazar(new Error(`sin respuesta en ${TIMEOUT_BASE_MS} ms`)),
            TIMEOUT_BASE_MS,
          ),
        ),
      ]);
    } catch (error) {
      // El detalle va al log y no a la respuesta: la sonda es publica por fuerza —la
      // llama un contenedor sin sesion— y el mensaje de Prisma lleva la cadena de
      // conexion.
      this.logger.error(
        `La base no responde: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('La base de datos no responde.');
    }

    return { status: 'ok', base: 'ok' };
  }
}
