import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Sin `telefono`, sin `rol` y sin `activo`: el telefono es la identidad y cambiarlo por
 * formulario seria apropiarse de la ficha de otro numero; el rol y el estado los decide
 * la administracion, no el dueño de la cuenta.
 */
export class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellido?: string;

  /**
   * La cadena vacia es como el formulario dice "borre mi correo", asi que se acepta y el
   * servicio la guarda como NULL. Con `@IsEmail` a secas no habria forma de quitarlo.
   */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @ValidateIf((dto: ActualizarPerfilDto) => dto.email !== '')
  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  email?: string;
}
