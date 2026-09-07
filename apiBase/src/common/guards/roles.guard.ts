import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../auth/jwt-payload.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles(...) declared: route is open to any authenticated user.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    return !!user && requiredRoles.includes(user.rol);
  }
}
