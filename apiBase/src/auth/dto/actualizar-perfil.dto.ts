import {
  IsBoolean,
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

  /**
   * El opt-in de los avisos, que con sesion vive aqui y no en el cuerpo de la reserva:
   * quien ya tiene cuenta no pasa por `resolverCliente` creando ficha, y sin este campo
   * no habia forma de que el cliente con sesion recibiera un aviso. El timestamp del
   * consentimiento lo pone el servicio. Ver 09-conexion-whatsapp.md.
   */
  @IsOptional()
  @IsBoolean()
  aceptaWhatsapp?: boolean;
}
