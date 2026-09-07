import { Module } from '@nestjs/common';
import { CitasController } from './citas.controller.js';
import { CitasService } from './citas.service.js';
import { CitasConfirmador } from './citas.confirmador.js';
import { ConfirmadorCitas } from '../notificaciones/confirmador-citas.port.js';

@Module({
  // `OutboxService` llega por NotificacionesModule, que es global: importarlo aqui
  // cerraria el ciclo con el modulo que a su vez necesita a este.
  // Ver ../notificaciones/09-conexion-whatsapp.md.
  controllers: [CitasController],
  providers: [
    CitasService,
    // El puerto que consume notificaciones. Se ata aqui porque la implementacion es
    // de este modulo.
    { provide: ConfirmadorCitas, useClass: CitasConfirmador },
  ],
  exports: [CitasService, ConfirmadorCitas],
})
export class CitasModule {}
