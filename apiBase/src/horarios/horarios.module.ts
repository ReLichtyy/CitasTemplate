import { Module } from '@nestjs/common';
import { HorariosController } from './horarios.controller.js';
import { HorariosService } from './horarios.service.js';

@Module({
  controllers: [HorariosController],
  providers: [HorariosService],
  exports: [HorariosService],
})
export class HorariosModule {}
