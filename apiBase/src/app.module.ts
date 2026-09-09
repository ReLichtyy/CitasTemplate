import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module.js';
import { CatalogoModule } from './catalogo/catalogo.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PropiedadCitaGuard } from './common/guards/propiedad-cita.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SyncModule } from './sync/sync.module.js';
import { CitasModule } from './citas/citas.module.js';
import { EmpleadosModule } from './empleados/empleados.module.js';
import { ServiciosModule } from './servicios/servicios.module.js';
import { HorariosModule } from './horarios/horarios.module.js';
import { RestriccionesModule } from './restricciones/restricciones.module.js';
import { AdicionalesModule } from './adicionales/adicionales.module.js';
import { NotificacionesModule } from './notificaciones/notificaciones.module.js';
import { WahaModule } from './integrations/waha/waha.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CatalogoModule,
    AuthModule,
    SyncModule,
    CitasModule,
    EmpleadosModule,
    ServiciosModule,
    HorariosModule,
    RestriccionesModule,
    AdicionalesModule,
    NotificacionesModule,
    WahaModule,
  ],
  controllers: [HealthController],
  providers: [
    // Every route requires a valid JWT and passes role checks by default.
    // Opt out with @Public(), scope with @Roles(...), and declare ownership with
    // @PropiedadCita() — rol y propiedad son cosas distintas. Ver 03-autorizacion.md.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PropiedadCitaGuard },
  ],
})
export class AppModule {}
