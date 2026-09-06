import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // DEFECTO ABIERTO: Prisma 7 exige un driver adapter en el constructor y este
    // proyecto no instala ninguno todavia, asi que instanciar esto lanza
    // PrismaClientInitializationError y el API no arranca. Hace falta
    // `@prisma/adapter-mariadb` y pasarlo aqui con DATABASE_URL.
    //
    // No lo introduce el modo de datos quemados: pasaba igual antes, solo que nadie
    // habia arrancado el API porque tampoco habia base de datos.
    super(undefined as never);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
