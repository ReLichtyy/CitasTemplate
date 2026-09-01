import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { HealthController } from './health/health.controller.js';
import { SyncModule } from './sync/sync.module.js';
import { CitasModule } from './citas/citas.module.js';
import { EmpleadosModule } from './empleados/empleados.module.js';
import { ServiciosModule } from './servicios/servicios.module.js';
import { HorariosModule } from './horarios/horarios.module.js';
import { RestriccionesModule } from './restricciones/restricciones.module.js';
import { AdicionalesModule } from './adicionales/adicionales.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    SyncModule,
    CitasModule,
    EmpleadosModule,
    ServiciosModule,
    HorariosModule,
    RestriccionesModule,
    AdicionalesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Every route requires a valid JWT and passes role checks by default.
    // Opt out with @Public(), scope with @Roles(...).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
