import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CitasModule } from '../citas/citas.module.js';
import { MistralClient } from '../integrations/mistral/mistral.client.js';
import mistralConfig from '../integrations/mistral/mistral.config.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { ServiciosModule } from '../servicios/servicios.module.js';
import chatbotConfig from './chatbot.config.js';
import {
  AsistenteChat,
  AsistenteNoConfigurado,
} from './asistente.port.js';
import { CatalogoBotService } from './catalogo-bot.service.js';
import { ChatbotLlmService } from './chatbot-llm.service.js';
import { ChatbotService } from './chatbot.service.js';
import { ConversacionService } from './conversacion.service.js';
import { ProcesadorMensajes, ProcesadorNulo } from './mensajes.port.js';

/**
 * Compone el chatbot. No es global a proposito: solo `WahaModule` —el webhook—
 * consume el puerto de entrada.
 *
 * El atado del puerto es la misma composicion que la del gateway en
 * `NotificacionesModule`, con dos escalones:
 *
 * - `CHATBOT_ENABLED=true` y `LLM_API_KEY` puesta: modo conversacional. El
 *   asistente interpreta texto libre y este modulo valida todo lo que propone.
 * - `CHATBOT_ENABLED=true` sin clave: modo menus numerados, que no necesita
 *   ningun proveedor y sigue reservando de punta a punta.
 * - Apagado: `ProcesadorNulo` y el webhook descarta los `message` como siempre.
 */
@Module({
  imports: [
    ConfigModule.forFeature(chatbotConfig),
    ConfigModule.forFeature(mistralConfig),
    HttpModule,
    // Una sola direccion, como el resto del modulo: aqui se necesita
    // `ReservadorCitas` (lo implementa CitasModule), el gateway del canal y el
    // catalogo publico de servicios.
    CitasModule,
    NotificacionesModule,
    ServiciosModule,
  ],
  providers: [
    ConversacionService,
    CatalogoBotService,
    ChatbotService,
    ChatbotLlmService,
    MistralClient,
    {
      // Este `useFactory` es el unico lugar del modulo que nombra al adaptador:
      // raiz de composicion, igual que el `useFactory` del gateway.
      provide: AsistenteChat,
      inject: [ConfigService, MistralClient],
      useFactory: (config: ConfigService, mistral: MistralClient) =>
        config.get<string>('mistral.apiKey') ? mistral : new AsistenteNoConfigurado(),
    },
    {
      provide: ProcesadorMensajes,
      inject: [ConfigService, ChatbotService, ChatbotLlmService],
      useFactory: (
        config: ConfigService,
        menus: ChatbotService,
        conversacional: ChatbotLlmService,
      ) => {
        if (!config.get<boolean>('chatbot.enabled')) {
          return new ProcesadorNulo();
        }
        return config.get<string>('mistral.apiKey') ? conversacional : menus;
      },
    },
  ],
  exports: [ProcesadorMensajes],
})
export class ChatbotModule {}
