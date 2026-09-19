import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoConversacion } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DatosConversacion } from './flujo-reserva.js';

/**
 * El estado del flujo por telefono: cargar viva, guardar paso, borrar al terminar.
 * La expiracion no la barre ningun cron: la comprueba el mensaje que llega, que es
 * lo unico que puede necesitarla. Ver 11-chatbot-reservas.md.
 */
@Injectable()
export class ConversacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * La conversacion viva, o `null` — vencida se borra aqui mismo y el mensaje que
   * la encontro empieza de cero.
   */
  async cargar(telefono: string) {
    const fila = await this.prisma.conversacionChatbot.findUnique({
      where: { telefono },
    });
    if (!fila) {
      return null;
    }
    if (fila.expiraEn.getTime() <= Date.now()) {
      await this.borrar(telefono);
      return null;
    }
    return fila;
  }

  async guardar(
    telefono: string,
    estado: EstadoConversacion,
    datos: DatosConversacion,
  ): Promise<void> {
    const expiraEn = new Date(
      Date.now() + this.config.get<number>('chatbot.expiracionMs', 30 * 60_000)!,
    );

    await this.prisma.conversacionChatbot.upsert({
      where: { telefono },
      create: {
        telefono,
        estado,
        datos: datos as Prisma.InputJsonValue,
        expiraEn,
      },
      update: { estado, datos: datos as Prisma.InputJsonValue, expiraEn },
    });
  }

  /** `deleteMany` y no `delete`: la fila puede no existir, y eso no es un error. */
  async borrar(telefono: string): Promise<void> {
    await this.prisma.conversacionChatbot.deleteMany({ where: { telefono } });
  }
}
