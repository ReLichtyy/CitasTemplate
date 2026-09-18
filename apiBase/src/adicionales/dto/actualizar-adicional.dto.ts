import { PartialType } from '@nestjs/swagger';
import { CrearAdicionalDto } from './crear-adicional.dto.js';

/**
 * Cuerpo de `PATCH /adicionales/:id`: lo mismo que al crear, todo opcional. Ver la nota de
 * `ActualizarProductoDto` — un cuerpo vacio es valido y no cambia nada.
 */
export class ActualizarAdicionalDto extends PartialType(CrearAdicionalDto) {}
