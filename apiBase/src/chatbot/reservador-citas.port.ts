import type {
  ConsultarDisponibilidadDto,
} from '../citas/dto/consultar-disponibilidad.dto.js';
import type { ReservarCitaDto } from '../citas/dto/reservar-cita.dto.js';

/** Lo que el menu de horas necesita de cada hueco: la hora de inicio. */
export interface SlotDisponible {
  inicio: string;
}

export interface DisponibilidadDelDia {
  fecha: string;
  slots: SlotDisponible[];
}

/**
 * Lo que el chatbot necesita de citas: lo mismo que la web usa por HTTP, sin un
 * segundo proceso de reserva. La implementacion es una linea de pegamento sobre
 * `CitasService` (`citas.reservador.ts`), el mismo patron de `citas.confirmador.ts`
 * — la transaccion, el `@@unique` y el invariante de `slotOcupado` siguen siendo
 * de `CitasService`.
 *
 * A diferencia del confirmador, este puerto no cierra ningun ciclo — nada de
 * citas depende del chatbot — y por eso no lleva `forwardRef`.
 */
export abstract class ReservadorCitas {
  abstract reservar(dto: ReservarCitaDto): Promise<unknown>;
  abstract disponibilidad(
    query: ConsultarDisponibilidadDto,
  ): Promise<DisponibilidadDelDia>;
}
