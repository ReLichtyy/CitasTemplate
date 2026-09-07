import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  LIMITE_INTENTOS_KEY,
  type OpcionesLimiteIntentos,
} from '../decorators/limite-intentos.decorator.js';

interface Ventana {
  conteo: number;
  expiraEn: number;
}

/**
 * Freno por IP para las rutas abiertas de `auth`: sin el, probar contrasenas cuesta lo
 * mismo que pedirlas, y bcrypt con coste 12 convierte cada intento en trabajo del
 * servidor. No pretende ser un WAF; pretende que un bucle no sirva de nada.
 *
 * Estado en memoria del proceso, a proposito: un despliegue por negocio, un proceso, y
 * ninguna dependencia nueva. Las dos consecuencias, asumidas:
 *
 * - Reiniciar el API borra el conteo.
 * - Con varias instancias detras de un balanceador, el limite es por instancia. Si ese
 *   dia llega, esto se cambia por un almacen compartido, no por mas memoria.
 *
 * La IP sale de `request.ip`, que detras de un proxy es la del proxy salvo que Express
 * confie en el (`TRUST_PROXY`, ver `main.ts`). Mal configurado, el limite se aplica a
 * todo el trafico junto — de ahi que la variable exista y este documentada.
 */
@Injectable()
export class LimiteIntentosGuard implements CanActivate {
  private readonly logger = new Logger(LimiteIntentosGuard.name);
  private readonly ventanas = new Map<string, Ventana>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const opciones = this.reflector.getAllAndOverride<
      OpcionesLimiteIntentos | undefined
    >(LIMITE_INTENTOS_KEY, [context.getHandler(), context.getClass()]);
    if (!opciones) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ahora = Date.now();
    this.limpiar(ahora);

    // La ruta entra en la clave: gastar los intentos de login no debe cerrar el registro.
    const clave = `${request.ip ?? 'desconocida'}:${request.method} ${request.route?.path ?? request.url}`;
    const ventana = this.ventanas.get(clave);

    if (!ventana || ventana.expiraEn <= ahora) {
      this.ventanas.set(clave, { conteo: 1, expiraEn: ahora + opciones.ventanaMs });
      return true;
    }

    ventana.conteo += 1;
    if (ventana.conteo > opciones.intentos) {
      // Se registra el hecho, no la credencial: en el log no entra ni el telefono ni la
      // contrasena que se estaba probando.
      this.logger.warn(`Limite de intentos alcanzado: ${clave}`);
      throw new HttpException(
        'Demasiados intentos. Espere unos minutos y vuelva a intentar.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /**
   * Sin esto el mapa crece con cada IP que pase alguna vez. Se barre al atender, no con un
   * temporizador: un intervalo mantendria vivo el proceso y habria que apagarlo a mano.
   */
  private limpiar(ahora: number) {
    if (this.ventanas.size < 1_000) {
      return;
    }
    for (const [clave, ventana] of this.ventanas) {
      if (ventana.expiraEn <= ahora) {
        this.ventanas.delete(clave);
      }
    }
  }
}
