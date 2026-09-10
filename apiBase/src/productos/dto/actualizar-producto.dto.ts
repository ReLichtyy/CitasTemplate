import { PartialType } from '@nestjs/swagger';
import { CrearProductoDto } from './crear-producto.dto.js';

/**
 * Cuerpo de `PATCH /productos/:id`: lo mismo que al crear, todo opcional.
 *
 * `PartialType` y no una copia con `@IsOptional()` en cada campo: dos listas de reglas
 * para la misma forma se separan en cuanto alguien agrega un campo en una sola. Se importa
 * de `@nestjs/swagger` —no de `@nestjs/mapped-types`— porque es el que ya esta instalado
 * para `/docs`, y ademas arrastra los decoradores de documentacion.
 *
 * Nota: un cuerpo vacio es valido y no cambia nada. No se rechaza porque la alternativa
 * —exigir al menos un campo— obliga a un validador a nivel de objeto para atajar algo que
 * no hace dano.
 */
export class ActualizarProductoDto extends PartialType(CrearProductoDto) {}
