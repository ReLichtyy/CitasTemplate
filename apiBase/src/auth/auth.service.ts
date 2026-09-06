import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // TODO: login real por telefono con bcrypt, rechazando al usuario inactivo y al que
  // no tiene contrasena (las fichas que crea una reserva de invitado). Ver 03-autorizacion.md.
  async login(_dto: LoginDto): Promise<{ accessToken: string }> {
    throw new NotImplementedException('User store not wired up yet');
  }

  /**
   * Los datos propios de quien tiene sesion. Es lo que permite a ReservarPage ofrecer
   * los datos ya guardados en vez de pedirlos otra vez.
   */
  async me(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      // Sin `password` ni `rol`: la contrasena no sale de esta capa (04-contrato-api.md) y el rol
      // ya viaja en el token.
      select: {
        id: true,
        telefono: true,
        nombre: true,
        apellido: true,
        email: true,
      },
    });
    if (!usuario) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return usuario;
  }
}
