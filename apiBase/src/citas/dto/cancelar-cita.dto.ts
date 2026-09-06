import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Cuerpo opcional de DELETE /citas/:id. Cancelar no borra la fila. */
export class CancelarCitaDto {
  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto.' })
  @MaxLength(255, { message: 'El motivo no puede pasar de 255 caracteres.' })
  motivo?: string;
}
