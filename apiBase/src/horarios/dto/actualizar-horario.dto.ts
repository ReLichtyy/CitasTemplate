import { PartialType } from '@nestjs/swagger';
import { CrearHorarioDto } from './crear-horario.dto.js';

/**
 * Cuerpo de `PATCH /horarios/:id`: lo mismo que al crear, todo opcional. La coherencia
 * `apertura < cierre` la vuelve a comprobar el servicio contra los valores que queden —
 * un parche de solo `minutoCierre` tambien puede romperla.
 */
export class ActualizarHorarioDto extends PartialType(CrearHorarioDto) {}
