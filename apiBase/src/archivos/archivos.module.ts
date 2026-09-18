import { Module } from '@nestjs/common';
import { ArchivosController } from './archivos.controller.js';
import { ArchivosService } from './archivos.service.js';

@Module({
  controllers: [ArchivosController],
  providers: [ArchivosService],
  exports: [ArchivosService],
})
export class ArchivosModule {}
