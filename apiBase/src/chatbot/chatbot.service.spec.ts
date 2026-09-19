import { ConflictException } from '@nestjs/common';
import { EstadoConversacion as Estado } from '../generated/prisma/enums.js';
import type { WhatsappGateway } from '../notificaciones/whatsapp.gateway.js';
import {
  DESPEDIDA,
  NOMBRE_INVALIDO,
  PEDIR_NOMBRE,
  SIN_SERVICIOS,
  ERROR_INESPERADO,
  saludo,
  type DatosConversacion,
  type OpcionDia,
  type ServicioDelMenu,
} from './flujo-reserva.js';
import { ChatbotService } from './chatbot.service.js';
import type { CatalogoBotService } from './catalogo-bot.service.js';
import type { ConversacionService } from './conversacion.service.js';
import type { MensajeEntrante } from './mensajes.port.js';
import type { ReservadorCitas } from './reservador-citas.port.js';

const MENSAJE: MensajeEntrante = {
  telefono: '88887777',
  destino: '+50688887777',
  texto: '',
};

const SERVICIO_UN_PROFESIONAL: ServicioDelMenu = {
  id: 'srv-1',
  nombre: 'Corte',
  duracionMinutos: 45,
  precio: '₡25,00',
  profesionales: [{ id: 'emp-1', nombre: 'Ana Perez' }],
};

const SERVICIO_DOS_PROFESIONALES: ServicioDelMenu = {
  id: 'srv-2',
  nombre: 'Tinte',
  duracionMinutos: 90,
  precio: '₡40,00',
  profesionales: [
    { id: 'emp-1', nombre: 'Ana Perez' },
    { id: 'emp-2', nombre: 'Luis Gomez' },
  ],
};

const DIAS: OpcionDia[] = [
  { etiqueta: 'Hoy', fecha: '2026-09-19', texto: 'sabado 19 de septiembre' },
  { etiqueta: 'Mañana', fecha: '2026-09-20', texto: 'domingo 20 de septiembre' },
  {
    etiqueta: 'Pasado mañana',
    fecha: '2026-09-21',
    texto: 'lunes 21 de septiembre',
  },
];

const SLOTS = [
  { inicio: '2026-09-19T15:00:00.000Z' },
  { inicio: '2026-09-19T16:00:00.000Z' },
];

interface ConversacionViva {
  estado: Estado;
  datos: DatosConversacion;
}

class ConversacionesFake {
  filas = new Map<string, ConversacionViva>();
  vencidas = new Set<string>();

  async cargar(telefono: string) {
    if (this.vencidas.has(telefono)) {
      await this.borrar(telefono);
      return null;
    }
    return this.filas.get(telefono) ?? null;
  }

  async guardar(telefono: string, estado: Estado, datos: DatosConversacion) {
    this.filas.set(telefono, { estado, datos });
  }

  async borrar(telefono: string) {
    this.filas.delete(telefono);
  }
}

class CanalFake {
  enviados: string[] = [];

  async enviarTexto(_destino: string, texto: string) {
    this.enviados.push(texto);
    return { idExterno: `log-${this.enviados.length}` };
  }
}

class CatalogoFake {
  servicios: ServicioDelMenu[] = [SERVICIO_UN_PROFESIONAL, SERVICIO_DOS_PROFESIONALES];

  async serviciosDelMenu() {
    return this.servicios;
  }

  async nombreNegocio() {
    return 'Barberia Ejemplo';
  }

  async diasPosibles() {
    return DIAS;
  }

  async textoDelDia(fecha: string) {
    return DIAS.find((d) => d.fecha === fecha)?.texto ?? fecha;
  }

  async textoDelInstante(iso: string) {
    return `FECHA(${iso})`;
  }

  async horaDelInstante(iso: string) {
    return `HORA(${iso})`;
  }
}

class ReservadorFake {
  reservas: unknown[] = [];
  error: Error | null = null;
  slots = SLOTS;

  async reservar(dto: unknown) {
    if (this.error) {
      throw this.error;
    }
    this.reservas.push(dto);
    return { id: 'cita-1' };
  }

  async disponibilidad(query: { fecha: string }) {
    return { fecha: query.fecha, slots: this.slots };
  }
}

function armarBot(overrides?: {
  conversaciones?: ConversacionesFake;
  catalogo?: CatalogoFake;
  reservador?: ReservadorFake;
  canal?: CanalFake;
}) {
  const conversaciones = overrides?.conversaciones ?? new ConversacionesFake();
  const catalogo = overrides?.catalogo ?? new CatalogoFake();
  const reservador = overrides?.reservador ?? new ReservadorFake();
  const canal = overrides?.canal ?? new CanalFake();

  const bot = new ChatbotService(
    conversaciones as unknown as ConversacionService,
    catalogo as unknown as CatalogoBotService,
    reservador as unknown as ReservadorCitas,
    canal as unknown as WhatsappGateway,
  );

  const enviar = async (texto: string) => {
    await bot.procesar({ ...MENSAJE, texto });
    return canal.enviados.splice(-canal.enviados.length);
  };

  return { bot, conversaciones, catalogo, reservador, canal, enviar };
}

describe('ChatbotService', () => {
  it('arranca la conversacion con el saludo y el menu de servicios', async () => {
    const { conversaciones, enviar } = armarBot();
    const respuestas = await enviar('hola');

    expect(respuestas).toEqual([saludo('Barberia Ejemplo', [
      SERVICIO_UN_PROFESIONAL,
      SERVICIO_DOS_PROFESIONALES,
    ])]);
    expect(conversaciones.filas.get('88887777')?.estado).toBe(
      Estado.ELIGIENDO_SERVICIO,
    );
  });

  it('sin servicios publicados no abre conversacion alguna', async () => {
    const { conversaciones, enviar } = armarBot({
      catalogo: Object.assign(new CatalogoFake(), { servicios: [] }),
    });

    const respuestas = await enviar('hola');

    expect(respuestas).toEqual([SIN_SERVICIOS]);
    expect(conversaciones.filas.size).toBe(0);
  });

  it('un servicio de un solo profesional salta directo al dia', async () => {
    const { conversaciones, enviar } = armarBot();

    await enviar('hola');
    const respuestas = await enviar('1');

    expect(respuestas).toHaveLength(1);
    expect(respuestas[0]).toContain('¿Qué día?');
    const fila = conversaciones.filas.get('88887777');
    expect(fila?.estado).toBe(Estado.ELIGIENDO_DIA);
    expect(fila?.datos).toEqual({ servicioId: 'srv-1', empleadoId: 'emp-1' });
  });

  it('un servicio de varios profesionales pregunta primero', async () => {
    const { conversaciones, enviar } = armarBot();

    await enviar('hola');
    const respuestas = await enviar('2');

    expect(respuestas[0]).toContain('¿Con qué profesional?');
    const fila = conversaciones.filas.get('88887777');
    expect(fila?.estado).toBe(Estado.ELIGIENDO_PROFESIONAL);
    expect(fila?.datos).toEqual({ servicioId: 'srv-2' });

    const despues = await enviar('2');
    expect(despues[0]).toContain('¿Qué día?');
    expect(conversaciones.filas.get('88887777')?.datos).toEqual({
      servicioId: 'srv-2',
      empleadoId: 'emp-2',
    });
  });

  it('una opcion fuera de la lista re-muestra el menu sin avanzar', async () => {
    const { conversaciones, enviar } = armarBot();

    await enviar('hola');
    const respuestas = await enviar('9');

    expect(respuestas[0]).toContain('¿Qué servicio desea reservar?');
    expect(conversaciones.filas.get('88887777')?.estado).toBe(
      Estado.ELIGIENDO_SERVICIO,
    );
  });

  it('cancelar en cualquier paso borra la conversacion y despide', async () => {
    const { conversaciones, enviar } = armarBot();

    await enviar('hola');
    await enviar('1');
    const respuestas = await enviar('cancelar');

    expect(respuestas).toEqual([DESPEDIDA]);
    expect(conversaciones.filas.size).toBe(0);
  });

  it('un dia sin huecos devuelve al menu de dias', async () => {
    const { conversaciones, reservador, enviar } = armarBot();
    reservador.slots = [];

    await enviar('hola');
    await enviar('1');
    const respuestas = await enviar('1');

    expect(respuestas[0]).toContain('Ese día no tiene horarios libres.');
    expect(respuestas[0]).toContain('¿Qué día?');
    expect(conversaciones.filas.get('88887777')?.estado).toBe(
      Estado.ELIGIENDO_DIA,
    );
  });

  it('reserva de punta a punta con los datos del canal', async () => {
    const { conversaciones, reservador, enviar } = armarBot();

    await enviar('hola');
    await enviar('1');
    await enviar('2');
    await enviar('1');
    await enviar('Juan Perez');
    const respuestas = await enviar('1');

    expect(reservador.reservas).toEqual([
      {
        servicioId: 'srv-1',
        empleadoId: 'emp-1',
        inicio: '2026-09-19T15:00:00.000Z',
        cliente: { telefono: '88887777', nombre: 'Juan Perez' },
      },
    ]);
    expect(conversaciones.filas.size).toBe(0);
    expect(respuestas[0]).toContain('✅ Cita reservada');
    expect(respuestas[0]).toContain('Juan Perez');
    expect(respuestas[0]).toContain('Corte con Ana Perez');
    expect(respuestas[0]).toContain('Le llega un mensaje aparte con el enlace');
  });

  it('el resumen muestra la eleccion antes del alta', async () => {
    const { conversaciones, enviar } = armarBot();

    await enviar('hola');
    await enviar('1');
    await enviar('2');
    await enviar('1');
    const respuestas = await enviar('Juan Perez');

    expect(respuestas[0]).toContain('Confirme su reserva');
    expect(respuestas[0]).toContain('Corte con Ana Perez');
    const fila = conversaciones.filas.get('88887777');
    expect(fila?.estado).toBe(Estado.CONFIRMANDO);
    expect(fila?.datos.nombre).toBe('Juan Perez');
  });

  it('un nombre corto no avanza', async () => {
    const { conversaciones, enviar } = armarBot();

    await enviar('hola');
    await enviar('1');
    await enviar('2');
    await enviar('1');
    const respuestas = await enviar('J');

    expect(respuestas).toEqual([NOMBRE_INVALIDO]);
    expect(conversaciones.filas.get('88887777')?.estado).toBe(
      Estado.PIDIENDO_NOMBRE,
    );
  });

  it('el 409 se relee y re-ofrece horarios sin perder lo elegido', async () => {
    const { conversaciones, reservador, enviar } = armarBot();
    reservador.error = new ConflictException(
      'Ese horario ya esta tomado. Elija otro.',
    );

    await enviar('hola');
    await enviar('1');
    await enviar('2');
    await enviar('1');
    await enviar('Juan Perez');
    const respuestas = await enviar('1');

    expect(respuestas[0]).toContain('Ese horario ya esta tomado. Elija otro.');
    expect(respuestas[0]).toContain('Horarios libres');
    const fila = conversaciones.filas.get('88887777');
    expect(fila?.estado).toBe(Estado.ELIGIENDO_HORA);
    expect(fila?.datos.nombre).toBe('Juan Perez');
  });

  it('una conversacion vencida empieza de cero', async () => {
    const { conversaciones, enviar } = armarBot();

    await enviar('hola');
    await enviar('1');
    // Vencida a mano: el mensaje siguiente la borra y arranca el saludo.
    conversaciones.vencidas.add('88887777');

    const respuestas = await enviar('1');

    expect(respuestas[0]).toContain('asistente de reservas');
    expect(conversaciones.filas.get('88887777')?.estado).toBe(
      Estado.ELIGIENDO_SERVICIO,
    );
  });

  it('un fallo inesperado no tumba el webhook y avisa al cliente', async () => {
    const { conversaciones, reservador, enviar } = armarBot();
    reservador.error = new Error('base caida');

    await enviar('hola');
    await enviar('1');
    await enviar('2');
    await enviar('1');
    await enviar('Juan Perez');
    const respuestas = await enviar('1');

    expect(respuestas).toEqual([ERROR_INESPERADO]);
    // La conversacion queda en CONFIRMANDO: el "1" reintenta sin perder nada.
    expect(conversaciones.filas.get('88887777')?.estado).toBe(
      Estado.CONFIRMANDO,
    );
  });

  it('pide el nombre despues de elegir hora', async () => {
    const { conversaciones, enviar } = armarBot();

    await enviar('hola');
    await enviar('1');
    await enviar('2');
    const respuestas = await enviar('1');

    expect(respuestas).toEqual([PEDIR_NOMBRE]);
    const fila = conversaciones.filas.get('88887777');
    expect(fila?.estado).toBe(Estado.PIDIENDO_NOMBRE);
    expect(fila?.datos.inicio).toBe('2026-09-19T15:00:00.000Z');
  });
});
