import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatbotModule } from '../../chatbot/chatbot.module.js';
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
    // Solo este modulo consume el puerto del chatbot: el webhook traduce el evento
    // y lo entrega; nada mas en el API tiene algo que hacer con una conversacion.
    ChatbotModule,
  ],
  controllers: [WahaWebhookController, WahaEstadoController],
})
export class WahaModule {}
