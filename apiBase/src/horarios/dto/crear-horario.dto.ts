import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { DiaSemana } from '../../generated/prisma/enums.js';

/**
 * Los extremos del dia en minutos desde medianoche (0..1439), la misma unidad del modelo:
 * la aritmetica de traslape es trivial y no arrastra zona horaria. Ver 01-modelo-datos.md.
 */
export const MINUTOS_DIA = 1439;

/**
 * Cuerpo de `POST /horarios`.
 *
 * Varios rangos por dia son varias filas — son los turnos partidos — y `minutoApertura` es
 * llave unica por dia: dos franjas no pueden abrir a la misma hora el mismo dia porque
 * serian la misma franja.
 */
export class CrearHorarioDto {
  @IsEnum(DiaSemana, { message: 'El dia indicado no es valido.' })
  dia!: DiaSemana;

  @IsInt({ message: 'La hora de apertura debe ser un numero de minutos.' })
  @Min(0, { message: 'La hora de apertura no puede ser anterior a medianoche.' })
  @Max(MINUTOS_DIA, { message: 'La hora de apertura no puede pasar de las 23:59.' })
  minutoApertura!: number;

  @IsInt({ message: 'La hora de cierre debe ser un numero de minutos.' })
  @Min(0, { message: 'La hora de cierre no puede ser anterior a medianoche.' })
  @Max(MINUTOS_DIA, { message: 'La hora de cierre no puede pasar de las 23:59.' })
  minutoCierre!: number;

  /** Apagado = ese rango no atiende, sin borrarlo: volver a encenderlo es un clic. */
  @IsOptional()
  @IsBoolean({ message: 'El indicador de atencion debe ser verdadero o falso.' })
  activo?: boolean;
}
