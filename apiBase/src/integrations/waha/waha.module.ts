import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificacionesModule } from '../../notificaciones/notificaciones.module.js';
import wahaConfig from './waha.config.js';
import { WahaWebhookController } from './waha-webhook.controller.js';

/**
 * Solo la entrada: el webhook. La salida (`WahaClient`) la compone
 * `NotificacionesModule`, que es quien decide contra que canal habla el worker.
 */
@Module({
  imports: [ConfigModule.forFeature(wahaConfig), NotificacionesModule],
  controllers: [WahaWebhookController],
})
export class WahaModule {}
