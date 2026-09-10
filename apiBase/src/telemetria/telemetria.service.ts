import { Injectable, Logger } from '@nestjs/common';
import type { EventoClienteDto } from './dto/evento-cliente.dto.js';

/** Tope del `User-Agent`. La cabecera la escribe el cliente y no tiene limite propio. */
const LARGO_MAXIMO_AGENTE = 300;

export interface OrigenEvento {
  /** `User-Agent` de la peticion. Sirve para separar "falla en todos" de "falla en ese Safari". */
  agente?: string;
  ip?: string;
}

/**
 * Escribe al log lo que el navegador reporto. No hace nada mas, y esa es la decision:
 * sin tabla, sin cola, sin reintento.
 *
 * El destino es el mismo log estructurado que el resto del backend, con `evento:
 * 'cliente'`. Que sea el mismo importa: un fallo de reserva deja hoy hasta tres lineas
 * —acceso, excepcion y, si el navegador lo reporto, esta— y las tres comparten
 * `requestId`. Buscar por ese id devuelve la historia completa de los dos lados.
 */
@Injectable()
export class TelemetriaService {
  private readonly logger = new Logger('Cliente');

  registrar(evento: EventoClienteDto, origen: OrigenEvento) {
    this.logger.warn({
      evento: 'cliente',
      tipo: evento.tipo,
      mensaje: evento.mensaje,
      ruta: evento.ruta ?? null,
      componente: evento.componente ?? null,
      traza: evento.traza ?? null,
      // El id que mando el navegador es el de **otra** peticion, la que fallo. El de esta
      // lo pone el logger por su cuenta, asi que van los dos y con nombres distintos.
      requestIdOrigen: evento.requestId ?? null,
      agente: origen.agente?.slice(0, LARGO_MAXIMO_AGENTE) ?? null,
      ip: origen.ip ?? null,
    });
  }
}
