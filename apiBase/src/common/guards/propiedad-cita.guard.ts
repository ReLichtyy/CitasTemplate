import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Role } from '../enums/role.enum.js';
import { PROPIEDAD_KEY, type OpcionesPropiedad } from '../decorators/propiedad.decorator.js';
import type { AuthenticatedUser } from '../../auth/jwt-payload.interface.js';

/**
 * Un solo mensaje para "no existe" y para "no es suya". Distinguirlos convertiria
 * la ruta en un oraculo de ids ajenos. Ver 03-autorizacion.md y 04-contrato-api.md.
 */
const MENSAJE = 'No tiene acceso a este recurso.';

/**
 * Comprueba propiedad, no rol. Registrado como APP_GUARD junto a `RolesGuard`, y
 * como aquel, no hace nada donde no se declaro nada: solo actua sobre las rutas
 * decoradas con `@PropiedadCita()`. Ver 03-autorizacion.md.
 */
@Injectable()
export class PropiedadCitaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opciones = this.reflector.getAllAndOverride<OpcionesPropiedad | undefined>(
      PROPIEDAD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opciones) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException(MENSAJE);
    }

    if (opciones.rolesLibres.includes(user.rol)) {
      return true;
    }

    const id: string | undefined = request.params?.[opciones.param];
    if (!id) {
      throw new ForbiddenException(MENSAJE);
    }

    const cita = await this.prisma.cita.findUnique({
      where: { id },
      select: { clienteId: true, empleado: { select: { usuarioId: true } } },
    });
    if (!cita) {
      throw new ForbiddenException(MENSAJE);
    }

    // Un EMPLEADO pasa sobre las citas de su propia agenda; cualquier rol pasa sobre
    // las citas de las que es cliente.
    if (user.rol === Role.EMPLEADO && cita.empleado.usuarioId === user.userId) {
      return true;
    }
    if (cita.clienteId === user.userId) {
      return true;
    }

    throw new ForbiddenException(MENSAJE);
  }
}
