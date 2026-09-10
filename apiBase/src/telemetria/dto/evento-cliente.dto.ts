import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * De donde salio el evento. Es un enum cerrado y no texto libre porque es el campo por el
 * que se va a filtrar el log, y un campo de agrupacion que el cliente puede inventar no
 * agrupa nada.
 */
export enum TipoEventoCliente {
  /** Excepcion durante el render de React, capturada por el `ErrorBoundary`. */
  RENDER = 'render',
  /** `window.onerror`: algo lanzo fuera del arbol de React. */
  GLOBAL = 'global',
  /** `unhandledrejection`: una promesa fallo y nadie la atrapo. */
  PROMESA = 'promesa',
  /** El `fetch` no llego a contestar: API caida, DNS, CORS, red del visitante. */
  RED = 'red',
  /** El API contesto 5xx. El 4xx no se reporta: ya queda en el log del servidor. */
  API = 'api',
}

/**
 * Lo que el navegador puede contar sobre un fallo suyo.
 *
 * Todo campo es **dato no confiable**: lo escribe un cliente que no se autentica. De ahi
 * las tres reglas de este DTO, y ninguna es negociable:
 *
 * 1. Cada campo tiene tope de largo. Sin eso, una sola peticion de 60 kB —el limite global
 *    del cuerpo— entra entera al log, y repetida llena el disco del VPS.
 * 2. `tipo` es un enum. Es la columna de agrupacion.
 * 3. Nada de esto se devuelve al cliente ni se interpola en una plantilla: se serializa
 *    como JSON (ver `logger.estructurado.ts`), que es lo que impide que un salto de linea
 *    fabrique una linea de log falsa.
 *
 * El `ValidationPipe` global corre con `forbidNonWhitelisted`, asi que un campo de mas es
 * 400 y no un campo de mas en el log.
 */
export class EventoClienteDto {
  @IsEnum(TipoEventoCliente, { message: 'El tipo de evento no es valido.' })
  tipo!: TipoEventoCliente;

  @IsString()
  @MinLength(1, { message: 'El mensaje no puede ir vacio.' })
  @MaxLength(500, { message: 'El mensaje es demasiado largo.' })
  mensaje!: string;

  /** Traza del navegador. Recortada tambien en el cliente; el tope de aqui es el que manda. */
  @IsOptional()
  @IsString()
  @MaxLength(4_000, { message: 'La traza es demasiado larga.' })
  traza?: string;

  /**
   * Ruta del SPA donde ocurrio (`/citas/reservar`), no la url completa: la url lleva
   * query string, y el query string de esta app lleva el token de confirmacion de una
   * cita. Un token de confirmacion en el log es un token filtrado.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La ruta es demasiado larga.' })
  ruta?: string;

  /**
   * El `x-request-id` de la peticion que fallo, cuando el evento viene de una llamada al
   * API. Es lo que cose el reporte del navegador con las lineas que el servidor ya
   * escribio por su cuenta.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{8,64}$/, { message: 'El identificador no es valido.' })
  requestId?: string;

  /** Pila de componentes de React, solo para el tipo `render`. */
  @IsOptional()
  @IsString()
  @MaxLength(2_000, { message: 'El detalle es demasiado largo.' })
  componente?: string;
}
