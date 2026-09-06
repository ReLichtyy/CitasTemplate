import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import {
  AUTH_OPCIONAL_KEY,
  IS_PUBLIC_KEY,
} from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const authOpcional = this.reflector.getAllAndOverride<boolean>(
      AUTH_OPCIONAL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!authOpcional) {
      return (await super.canActivate(context)) as boolean;
    }

    // Con token valido, `request.user` queda puesto; sin el, o con uno vencido, la
    // peticion sigue como invitado. Passport lanza en los dos casos, asi que el
    // fallo se ignora aqui a proposito y la autorizacion la decide el handler.
    try {
      await super.canActivate(context);
    } catch {
      // Invitado.
    }
    return true;
  }
}
