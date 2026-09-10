import { Module } from '@nestjs/common';
import { TelemetriaController } from './telemetria.controller.js';
import { TelemetriaService } from './telemetria.service.js';

/**
 * La contraparte de servidor de lo que el navegador no puede contar solo. Ver
 * `src/common/observabilidad/10-observabilidad.md`.
 */
@Module({
  controllers: [TelemetriaController],
  providers: [TelemetriaService],
})
export class TelemetriaModule {}
