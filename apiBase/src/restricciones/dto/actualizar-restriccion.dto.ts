import { PartialType } from '@nestjs/swagger';
import { CrearRestriccionDto } from './crear-restriccion.dto.js';

/**
 * Cuerpo de `PATCH /restricciones/:id`: lo mismo que al crear, todo opcional. El rango
 * coherente lo comprueba el servicio contra los valores que queden.
 */
export class ActualizarRestriccionDto extends PartialType(CrearRestriccionDto) {}
