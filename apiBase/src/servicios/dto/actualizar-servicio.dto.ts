import { PartialType } from '@nestjs/swagger';
import { CrearServicioDto } from './crear-servicio.dto.js';

/**
 * Cuerpo de `PATCH /servicios/:id`: lo mismo que al crear, todo opcional. La lista de
 * profesionales, cuando viene, reemplaza a la anterior — no se agregan a la que habia.
 */
export class ActualizarServicioDto extends PartialType(CrearServicioDto) {}
