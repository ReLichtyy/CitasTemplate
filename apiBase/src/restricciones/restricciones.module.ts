import { Module } from '@nestjs/common';
import { RestriccionesController } from './restricciones.controller.js';
import { RestriccionesService } from './restricciones.service.js';

@Module({
  controllers: [RestriccionesController],
  providers: [RestriccionesService],
  exports: [RestriccionesService],
})
export class RestriccionesModule {}
