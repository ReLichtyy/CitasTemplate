import { Injectable } from '@nestjs/common';
import { Rol } from '../generated/prisma/enums.js';
import { CatalogoService } from '../catalogo/catalogo.service.js';
import {
  diaEnZona,
  instanteDesdeZona,
  partesEnZona,
} from '../common/tiempo.js';
import { ServiciosService } from '../servicios/servicios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  OpcionDia,
  ServicioDelMenu,
} from './flujo-reserva.js';

/**
 * Los menus del bot se arman de las mismas lecturas publicas que la web: nada de
 * proyecciones paralelas — el catalogo del bot y el de `GET /servicios` no pueden
 * contar cosas distintas. Todo lo que aqui sale es dato ya formateado con la zona,
 * el locale y la moneda del negocio: `flujo-reserva.ts` no sabe que existe `Intl`.
 *
 * Tambien responde "quien escribe" y "que hay hoy": el asistente necesita saber si
 * del otro lado hay un cliente o el administrador, y a este ultimo mostrarle la
 * agenda. Las dos lecturas son de este modulo y no del adaptador: no hay razon para
 * que el proveedor de LLM sea quien pregunte por la base.
 */
@Injectable()
export class CatalogoBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicios: ServiciosService,
    private readonly catalogo: CatalogoService,
  ) {}

  /**
   * Un servicio sin profesionales activos no se puede reservar y no se ofrece: el
   * menu de solo reservables es tambien el menu contra el que se parsea la
   * respuesta, y ofrecer algo impossible solo gasta un turno del cliente.
   */
  async serviciosDelMenu(): Promise<ServicioDelMenu[]> {
    const negocio = await this.negocio();
    const servicios = await this.servicios.findAll();

    return servicios
      .filter((servicio) => servicio.empleados.length > 0)
      .map((servicio) => ({
        id: servicio.id,
        nombre: servicio.nombre,
        duracionMinutos: servicio.duracionMinutos,
        precio: new Intl.NumberFormat(negocio.locale, {
          style: 'currency',
          currency: negocio.moneda,
        }).format(Number(servicio.precio.toString())),
        profesionales: servicio.empleados.map((empleado) => ({
          id: empleado.id,
          nombre: [empleado.usuario.nombre, empleado.usuario.apellido]
            .filter(Boolean)
            .join(' '),
        })),
      }));
  }

  async nombreNegocio(): Promise<string> {
    return (await this.negocio()).nombre;
  }

  /** Hoy, manana y pasado manana resueltos en la zona del negocio. */
  async diasPosibles(): Promise<OpcionDia[]> {
    const negocio = await this.negocio();
    const hoy = partesEnZona(new Date(), negocio.zonaHoraria);
    const etiquetas = ['Hoy', 'Mañana', 'Pasado mañana'] as const;

    return [0, 1, 2].map((delta) => {
      // `dia + delta` desborda el mes cuando toca: `Date.UTC` normaliza la suma,
      // igual que `diaEnZona` usa `dia + 1` para el fin del dia.
      const instante = instanteDesdeZona(
        hoy.anio,
        hoy.mes,
        hoy.dia + delta,
        0,
        negocio.zonaHoraria,
      );
      const partes = partesEnZona(instante, negocio.zonaHoraria);
      return {
        etiqueta: etiquetas[delta],
        fecha: `${partes.anio}-${String(partes.mes).padStart(2, '0')}-${String(partes.dia).padStart(2, '0')}`,
        texto: this.formatoDelDia(instante, negocio),
      };
    });
  }

  /** "viernes 19 de septiembre" para una fecha `YYYY-MM-DD`. */
  async textoDelDia(fecha: string): Promise<string> {
    const negocio = await this.negocio();
    const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
    return this.formatoDelDia(
      instanteDesdeZona(anio, mes, dia, 0, negocio.zonaHoraria),
      negocio,
    );
  }

  /** Fecha completa con hora, la misma forma del aviso de confirmacion. */
  async textoDelInstante(iso: string): Promise<string> {
    const negocio = await this.negocio();
    return new Intl.DateTimeFormat(negocio.locale, {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: negocio.zonaHoraria,
    }).format(new Date(iso));
  }

  /** "09:45" — solo la hora de pared del inicio del hueco. */
  async horaDelInstante(iso: string): Promise<string> {
    const negocio = await this.negocio();
    return new Intl.DateTimeFormat(negocio.locale, {
      timeStyle: 'short',
      timeZone: negocio.zonaHoraria,
    }).format(new Date(iso));
  }

  /**
   * Si quien escribe es el administrador del negocio. El telefono es la credencial
   * (decision cerrada en SPEC.md) y la conversacion no pide nada mas: quien escribe
   * desde el numero del admin, es el admin. Solo cuentas activas — dar de baja al
   * administrador debe sacarle tambien el trato de colega.
   */
  async esAdministrador(telefono: string): Promise<boolean> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { telefono, activo: true },
      select: { rol: true },
    });
    return usuario?.rol === Rol.ADMIN;
  }

  /**
   * La agenda del dia, ya formateada para el contexto del asistente. Es lectura de
   * gestion y solo se le entrega al administrador: al cliente no se le muestra la
   * ficha de otros clientes.
   */
  async agendaDelDia(): Promise<string> {
    const negocio = await this.negocio();
    const hoy = partesEnZona(new Date(), negocio.zonaHoraria);
    const { medianoche, finDelDia } = diaEnZona(
      hoy.anio,
      hoy.mes,
      hoy.dia,
      negocio.zonaHoraria,
    );

    const citas = await this.prisma.cita.findMany({
      where: { inicio: { gte: medianoche, lt: finDelDia } },
      select: {
        inicio: true,
        estado: { select: { codigo: true } },
        cliente: { select: { nombre: true, apellido: true } },
        servicio: { select: { nombre: true } },
        empleado: { select: { usuario: { select: { nombre: true } } } },
      },
      orderBy: { inicio: 'asc' },
      // Tope por tokens del contexto, no por regla de negocio: un dia de 30 citas
      // ya es una agenda que nadie lee por WhatsApp.
      take: 30,
    });

    if (citas.length === 0) {
      return '(sin citas hoy)';
    }

    const lineas = await Promise.all(
      citas.map(async (cita) => {
        const hora = await this.horaDelInstante(cita.inicio.toISOString());
        const cliente = [cita.cliente.nombre, cita.cliente.apellido]
          .filter(Boolean)
          .join(' ');
        return `${hora} · ${cita.estado.codigo} · ${cliente} · ${cita.servicio.nombre} · ${cita.empleado.usuario.nombre}`;
      }),
    );
    return lineas.join('\n');
  }

  /** El negocio cacheado (CatalogoService, 60 s) con fallback al default del esquema. */
  private async negocio(): Promise<{
    nombre: string;
    zonaHoraria: string;
    locale: string;
    moneda: string;
  }> {
    const negocio = await this.catalogo.negocio();
    return {
      nombre: negocio?.nombre ?? 'el negocio',
      zonaHoraria: negocio?.zonaHoraria ?? 'UTC',
      locale: negocio?.locale ?? 'es',
      moneda: negocio?.moneda ?? 'USD',
    };
  }

  private formatoDelDia(
    instante: Date,
    negocio: { zonaHoraria: string; locale: string },
  ): string {
    return new Intl.DateTimeFormat(negocio.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: negocio.zonaHoraria,
    }).format(instante);
  }
}
