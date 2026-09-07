import { IsString, Matches, MaxLength } from 'class-validator';

/**
 * El token viaja en el cuerpo y no en la URL a proposito: WhatsApp previsualiza los
 * enlaces de un mensaje y los navegadores y antivirus hacen prefetch. Cualquiera de
 * ellos pediria un GET y confirmaria la cita solo, antes de que el cliente la vea.
 * Un prefetch no hace POST. Ver 09-conexion-whatsapp.md.
 */
export class ConfirmarCitaDto {
  @IsString({ message: 'El enlace no es valido o ya vencio.' })
  @MaxLength(128, { message: 'El enlace no es valido o ya vencio.' })
  // 32 bytes en base64url. Lo que no tenga esa forma no llega a tocar la base.
  @Matches(/^[A-Za-z0-9_-]{20,128}$/, {
    message: 'El enlace no es valido o ya vencio.',
  })
  token!: string;
}
