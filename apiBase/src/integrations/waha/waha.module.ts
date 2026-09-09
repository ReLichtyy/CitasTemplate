import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificacionesModule } from '../../notificaciones/notificaciones.module.js';
import wahaConfig from './waha.config.js';
import { WahaEstadoController } from './waha-estado.controller.js';
import { WahaWebhookController } from './waha-webhook.controller.js';

/**
 * Las entradas: el webhook de acuses y la consulta de estado del canal. La salida
 * (`WahaClient`) la compone `NotificacionesModule`, que es quien decide contra que
 * canal habla el worker.
 */
@Module({
  imports: [
    ConfigModule.forFeature(wahaConfig),
    HttpModule,
    NotificacionesModule,
  ],
  controllers: [WahaWebhookController, WahaEstadoController],
})
export class WahaModule {}
