import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module.js';
import { GaleriaController } from './galeria.controller.js';
import { GaleriaService } from './galeria.service.js';

@Module({
  // `ArchivosService` es lo que borra el archivo cuando se quita la foto que referencia.
  imports: [ArchivosModule],
  controllers: [GaleriaController],
  providers: [GaleriaService],
})
export class GaleriaModule {}
