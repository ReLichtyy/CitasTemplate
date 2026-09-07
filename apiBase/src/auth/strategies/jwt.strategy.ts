import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { leerJwtSecret } from '../jwt-secret.js';
import type { AuthenticatedUser, JwtPayload } from '../jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: leerJwtSecret(config),
      // El token es HS256 y nada mas. Sin esto, un token con `alg` distinto se evaluaria
      // contra otro algoritmo en vez de rechazarse de plano.
      algorithms: ['HS256'],
    });
  }

  /**
   * Lo que devuelve es exactamente lo que ven los guards y `@CurrentUser()`. No se
   * consulta la base: el token ya dice quien es, y volver a leer al usuario en cada
   * peticion cambiaria una firma por una consulta.
   *
   * La contrapartida, asumida: desactivar una cuenta no corta las sesiones ya emitidas
   * hasta que el token vence (`JWT_EXPIRES_IN`).
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      telefono: payload.telefono,
      rol: payload.rol,
    };
  }
}
