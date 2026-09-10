import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Importe con hasta dos decimales, que es lo que cabe en `Decimal(10, 2)`.
 *
 * Se valida como **cadena** y no como numero: un `Decimal` viaja como cadena en el JSON y
 * pasarlo por un `number` de JavaScript le mete error de redondeo antes de llegar a la
 * base. La parte entera se topa en ocho digitos porque nueve ya no entran en la columna, y
 * un desbordamiento ahi es un error de MySQL que sale como 500 en vez de como 400.
 */
const IMPORTE = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * Cuerpo de `POST /productos`.
 *
 * A diferencia de una cita, aqui el precio **si** llega en el cuerpo y se persiste tal
 * cual: este es el catalogo, o sea el sitio donde el precio se define. La regla de
 * `apiBase/CLAUDE.md` —"el servidor recalcula importes"— habla de lo contrario: de que una
 * reserva no puede traer su propio precio, porque lo lee de aqui.
 */
export class CrearProductoDto {
  @IsUUID(undefined, { message: 'La categoria indicada no es valida.' })
  categoriaId!: string;

  @IsString({ message: 'El nombre debe ser texto.' })
  @MinLength(2, { message: 'El nombre es obligatorio.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'La descripcion debe ser texto.' })
  @MaxLength(2000, { message: 'La descripcion no puede pasar de 2000 caracteres.' })
  descripcion?: string;

  @Matches(IMPORTE, {
    message: 'El precio debe ser un importe con hasta dos decimales.',
  })
  precio!: string;

  @IsString({ message: 'La presentacion debe ser texto.' })
  @MinLength(1, { message: 'La presentacion es obligatoria.' })
  @MaxLength(60, { message: 'La presentacion no puede pasar de 60 caracteres.' })
  presentacion!: string;

  /**
   * `require_tld` queda activo: una URL sin dominio publico no la va a poder cargar el
   * navegador de un visitante, y aceptarla solo difiere el fallo hasta que la imagen no
   * aparece en el catalogo.
   */
  @IsOptional()
  @IsUrl({}, { message: 'La imagen debe ser una URL valida.' })
  @MaxLength(500, { message: 'La URL de la imagen es demasiado larga.' })
  imagenUrl?: string;

  /** Publicado en el catalogo publico. Ver el modelo: no es lo mismo que tener existencias. */
  @IsOptional()
  @IsBoolean({ message: 'El indicador de publicado debe ser verdadero o falso.' })
  activo?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'La disponibilidad debe ser verdadera o falsa.' })
  disponible?: boolean;
}
