import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * El id del mensaje no tiene una sola forma: llega como texto —`true_<chat>_<serial>`—
 * o envuelto en un objeto, segun motor y version. Un `@IsObject()` rechazaria el acuse
 * real de NOWEB, que lo manda como texto; un `@IsString()` rechazaria el de WEBJS.
 *
 * Lo que se acota aqui es el tamaño, que es lo unico que importa en la frontera: de
 * interpretar la forma ya se encarga `idDeMensaje`.
 */
@ValidatorConstraint({ name: 'esIdDeMensaje' })
class EsIdDeMensaje implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (typeof valor === 'string') {
      return valor.length <= 256;
    }
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
      return false;
    }
    return Object.values(valor).every(
      (campo) => typeof campo !== 'string' || campo.length <= 256,
    );
  }
}

/**
 * Forma minima del evento de WAHA, validada.
 *
 * Hasta ahora esto era una `interface`: tipo en compilacion y nada en ejecucion, asi
 * que el `ValidationPipe` global no tenia nada que validar y `payload.ack` entraba
 * como viniera. La firma HMAC prueba que el cuerpo lo mando WAHA; no prueba que WAHA
 * mandara lo que este codigo espera —una version nueva cambia un campo y el error
 * aparece adentro, no en la frontera—.
 *
 * `forbidNonWhitelisted` **no** se aplica en esta ruta: el evento real trae decenas de
 * campos que aqui no se usan, y rechazarlos seria rechazar el webhook entero. Se
 * declara lo que se lee y `whitelist` descarta el resto. Ver waha-webhook.controller.ts.
 */
export class PayloadWahaDto {
  @IsOptional()
  @Validate(EsIdDeMensaje)
  id?: string | { id?: string; _serialized?: string };

  /** NOWEB deja aqui el id del mensaje acusado. Ver waha.types.ts. */
  @IsOptional()
  @Validate(EsIdDeMensaje)
  key?: { id?: string; _serialized?: string };

  /**
   * El acuse de WhatsApp: de -1 (error) a 4 (reproducido). Acotado porque de aqui sale
   * una decision —marcar entregada o no entregable— y un numero fuera de ese rango es
   * una version de WAHA distinta de la que se probo.
   */
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(4)
  ack?: number;

  /** Estado de la sesion en `session.status`: WORKING, FAILED, STOPPED... */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;
}

export class EventoWahaDto {
  /** Sin id no hay como descartar un repetido. Ver `esEventoNuevo`. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  event?: string;

  /**
   * La sesion que origino el evento. Se compara contra la configurada: el contenedor
   * puede sostener mas de una, y un acuse de otra sesion no habla de nuestras filas.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  session?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayloadWahaDto)
  payload?: PayloadWahaDto;
}
