import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Prisma 7 no arma la conexion por si solo: hay que darle un driver adapter. El
 * adapter es quien tiene el pool de MariaDB, asi que `DATABASE_URL` se lee aqui y
 * no en el `datasource` del schema.
 *
 * `DATABASE_URL` no lleva valor por defecto a proposito: apuntar en silencio a una
 * base equivocada es peor que no arrancar.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL');
    if (!url) {
      throw new Error('Falta DATABASE_URL. Ver apiBase/.env.example.');
    }
    super({ adapter: new PrismaMariaDb(url) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
