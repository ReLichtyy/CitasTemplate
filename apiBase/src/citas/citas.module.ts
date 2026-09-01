import { Module } from '@nestjs/common';
import { CitasController } from './citas.controller.js';
import { CitasService } from './citas.service.js';

@Module({
  controllers: [CitasController],
  providers: [CitasService],
  exports: [CitasService],
})
export class CitasModule {}
