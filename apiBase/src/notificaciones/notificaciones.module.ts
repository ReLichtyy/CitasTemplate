import { HttpModule, HttpService } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CitasModule } from '../citas/citas.module.js';
import { WahaClient } from '../integrations/waha/waha.client.js';
import wahaConfig from '../integrations/waha/waha.config.js';
import { AcusesService } from './acuses.service.js';
import { ConfirmacionController } from './confirmacion.controller.js';
import { ConfirmacionService } from './confirmacion.service.js';
import notificacionesConfig from './notificaciones.config.js';
import { NotificacionesWorker } from './notificaciones.worker.js';
import { OutboxService } from './outbox.service.js';
import { WhatsappLogGateway } from './whatsapp-log.gateway.js';
import { WhatsappGateway } from './whatsapp.gateway.js';

/**
 * Global por la misma razon que `PrismaModule`: el outbox es infraestructura que el
 * dominio usa, no un modulo mas del que colgarse. Declararlo global es lo que rompe
 * el ciclo con `CitasModule`.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forFeature(notificacionesConfig),
    ConfigModule.forFeature(wahaConfig),
    HttpModule,
    // Una sola direccion: aqui se necesita `ConfirmadorCitas`, que implementa
    // CitasModule. Citas no importa este modulo —lo alcanza porque es global—, y eso
    // es lo que evita el ciclo entre los dos modulos, que con `forwardRef` en ambos
    // lados dejaba el arranque colgado sin error.
    CitasModule,
  ],
  controllers: [ConfirmacionController],
  providers: [
    OutboxService,
    ConfirmacionService,
    AcusesService,
    NotificacionesWorker,
    WhatsappLogGateway,
    {
      /**
       * Este `useFactory` es el unico lugar del modulo que nombra al adaptador: es la
       * raiz de composicion, y elegir implementacion es precisamente su trabajo. Ni
       * el outbox, ni el worker, ni las citas saben que existe WAHA.
       *
       * Sin `WAHA_URL` se usa el gateway de log, que es lo que permite verificar
       * reintentos, `SKIP LOCKED` e idempotencia sin gastar una sesion de WhatsApp.
       */
      provide: WhatsappGateway,
      inject: [ConfigService, HttpService],
      useFactory: (config: ConfigService, http: HttpService) =>
        config.get<string>('waha.url')
          ? new WahaClient(http, config)
          : new WhatsappLogGateway(),
    },
  ],
  exports: [OutboxService, ConfirmacionService, AcusesService],
})
export class NotificacionesModule {}
