import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

/** Techo duro. Ninguna peticion se lleva la agenda entera, la pida como la pida. */
export const LIMITE_MAXIMO = 100;
export const LIMITE_POR_DEFECTO = 50;

/**
 * Query de GET /citas. Existe porque la lista no tenia cota: un ADMIN pedia `/citas` y
 * el API cargaba todas las citas historicas del negocio con sus seis relaciones. Con la
 * semilla no se nota; con dos años de operacion es la consulta que tumba el endpoint.
 *
 * `@Type(() => Number)` no es decorativo: el `ValidationPipe` corre con
 * `enableImplicitConversion: false`, asi que sin el, `limite` llega como cadena y
 * `@IsInt` la rechaza. Ver main.ts.
 */
export class ConsultarCitasDto {
  /** Desde esta fecha/hora, inclusive. Sin ella, la lista no tiene piso. */
  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'La fecha desde debe ser una fecha ISO 8601.' },
  )
  desde?: string;

  /** Hasta esta fecha/hora, exclusive. */
  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'La fecha hasta debe ser una fecha ISO 8601.' },
  )
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El limite debe ser un numero entero.' })
  @Min(1, { message: 'El limite debe ser al menos 1.' })
  @Max(LIMITE_MAXIMO, { message: `El limite no puede pasar de ${LIMITE_MAXIMO}.` })
  limite?: number;

  /** Base cero, para que `pagina * limite` sea el desplazamiento sin restar uno. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero.' })
  @Min(0, { message: 'La pagina no puede ser negativa.' })
  pagina?: number;
}
