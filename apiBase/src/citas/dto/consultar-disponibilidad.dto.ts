import { IsISO8601, IsUUID } from 'class-validator';

/**
 * Query de GET /citas/disponibilidad. El frontend pregunta al API en vez de
 * simular horarios: la disponibilidad la decide el servidor. Ver 02-reservas-concurrencia.md.
 */
export class ConsultarDisponibilidadDto {
  @IsUUID(undefined, { message: 'El profesional indicado no es valido.' })
  empleadoId!: string;

  @IsUUID(undefined, { message: 'El servicio indicado no es valido.' })
  servicioId!: string;

  /** Dia a consultar, `YYYY-MM-DD`, interpretado en la zona del negocio. */
  @IsISO8601({ strict: true }, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha!: string;
}
