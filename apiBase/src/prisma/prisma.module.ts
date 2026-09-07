import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * `PrismaService` es global: los servicios lo inyectan sin importar este modulo.
 *
 * Aqui vivia el interruptor `DATOS_QUEMADOS`, que resolvia el mismo token a un catalogo en
 * memoria para trabajar sin MariaDB. Se quito con el login real: era una segunda fuente de
 * verdad que podia quedar encendida por un `.env` olvidado, y entonces el API arrancaba
 * contra datos falsos sin que nadie mirara el log. La base local sale de
 * `docker-compose.yml` en la raiz del repo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
