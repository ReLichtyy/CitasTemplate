import { Global, Module } from '@nestjs/common';
import { CatalogoService } from './catalogo.service.js';

/**
 * Global por la misma razon que `PrismaModule`: es infraestructura de lectura que
 * cualquier dominio usa, no un modulo del que colgarse.
 */
@Global()
@Module({
  providers: [CatalogoService],
  exports: [CatalogoService],
})
export class CatalogoModule {}
