import { Injectable } from '@nestjs/common';
import type { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto.js';
import type { ReservarCitaDto } from './dto/reservar-cita.dto.js';
import { ReservadorCitas } from '../chatbot/reservador-citas.port.js';
import type { DisponibilidadDelDia } from '../chatbot/reservador-citas.port.js';
import { CitasService } from './citas.service.js';

/**
 * Implementacion del puerto que usa el chatbot: una linea de pegamento, igual que
 * `citas.confirmador.ts`. La reserva sigue ocurriendo dentro de `CitasService`, con
 * su transaccion y su invariante de `slotOcupado`; aqui no hay logica ninguna.
 *
 * El bot no manda usuario: es el camino de invitado, con el telefono que trajo el
 * canal como identidad. Ver 11-chatbot-reservas.md.
 */
@Injectable()
export class CitasReservador extends ReservadorCitas {
  constructor(private readonly citas: CitasService) {
    super();
  }

  reservar(dto: ReservarCitaDto): Promise<unknown> {
    return this.citas.reservar(dto);
  }

  disponibilidad(
    query: ConsultarDisponibilidadDto,
  ): Promise<DisponibilidadDelDia> {
    return this.citas.disponibilidad(query);
  }
}
