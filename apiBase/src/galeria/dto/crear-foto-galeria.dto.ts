import { IsOptional, IsString, IsUUID, IsUrl, MaxLength } from 'class-validator';

/** Cuerpo de `POST /galeria`. */
export class CrearFotoGaleriaDto {
  /**
   * La que devolvio `POST /archivos`: la subida ya ocurrio, esto solo la referencia.
   * `require_tld` queda activo por lo mismo que en `CrearProductoDto` — una URL que el
   * navegador del visitante no puede cargar no es una foto de galeria.
   */
  @IsUrl({}, { message: 'La imagen debe ser una URL valida.' })
  @MaxLength(500, { message: 'La URL de la imagen es demasiado larga.' })
  imagenUrl!: string;

  /** Con que servicio de los que ya hay se logro el resultado. Es el punto de la foto. */
  @IsUUID(undefined, { message: 'El servicio indicado no es valido.' })
  servicioId!: string;

  @IsOptional()
  @IsString({ message: 'La descripcion debe ser texto.' })
  @MaxLength(200, { message: 'La descripcion no puede pasar de 200 caracteres.' })
  descripcion?: string;
}
