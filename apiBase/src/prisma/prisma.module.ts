import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { crearPrismaEnMemoria } from '../demo/prisma-en-memoria.js';
import { PrismaService } from './prisma.service.js';

/**
 * Con `DATOS_QUEMADOS=true` el token `PrismaService` se resuelve a un almacen en
 * memoria, para poder recorrer la reserva sin MariaDB. Nadie mas se entera: los
 * servicios y los guards siguen siendo los mismos, con las mismas reglas.
 *
 * El interruptor se lee por `ConfigService` y no por `process.env` suelto: leerlo al
 * evaluar el decorador seria antes de que `ConfigModule` cargue el `.env`, y la
 * variable saldria vacia. Inyectarlo obliga a que el `.env` ya este leido.
 *
 * Es andamiaje de 01-modelo-datos.md ("la migracion no se ha corrido"): quitar la
 * variable devuelve el cliente real, y borrar `src/demo/` es todo lo que falta despues.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get<string>('DATOS_QUEMADOS') === 'true') {
          new Logger('PrismaModule').warn(
            'DATOS_QUEMADOS=true: catalogo en memoria, nada se guarda al reiniciar.',
          );
          return crearPrismaEnMemoria() as unknown as PrismaService;
        }
        return new PrismaService();
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
