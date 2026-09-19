import { ConflictException } from '@nestjs/common';
import { EstadoConversacion as Estado } from '../generated/prisma/enums.js';
import type { WhatsappGateway } from '../notificaciones/whatsapp.gateway.js';
import {
  AsistenteNoDisponibleError,
  type RespuestaAsistente,
} from './asistente.port.js';
import type { AsistenteChat } from './asistente.port.js';
import { ChatbotLlmService } from './chatbot-llm.service.js';
import type { CatalogoBotService } from './catalogo-bot.service.js';
import type { ConversacionService } from './conversacion.service.js';
import {
  DESPEDIDA,
  ERROR_INESPERADO,
  HORARIO_OCUPADO,
  type DatosConversacion,
  type MensajeEntrante,
  type OpcionDia,
  type ServicioDelMenu,
} from './flujo-reserva.js';
import type { ReservadorCitas } from './reservador-citas.port.js';

const MENSAJE: MensajeEntrante = {
  telefono: '88887777',
  destino: '+50688887777',
  texto: '',
};

const SERVICIO: ServicioDelMenu = {
  id: 'srv-1',
  nombre: 'Limpieza facial profunda',
  duracionMinutos: 45,
  precio: '₡25,00',
  profesionales: [
    { id: 'emp-1', nombre: 'Ana Perez' },
    { id: 'emp-2', nombre: 'Luis Gomez' },
  ],
};

const DIAS: OpcionDia[] = [
  { etiqueta: 'Hoy', fecha: '2026-09-19', texto: 'sabado 19 de septiembre' },
  { etiqueta: 'Mañana', fecha: '2026-09-20', texto: 'domingo 20 de septiembre' },
];

const SLOTS = [
  { inicio: '2026-09-19T15:00:00.000Z' },
  { inicio: '2026-09-19T16:00:00.000Z' },
];

class ConversacionesFake {
  filas = new Map<string, { estado: Estado; datos: DatosConversacion }>();

  async cargar(telefono: string) {
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
  servicios: ServicioDelMenu[] = [SERVICIO];
  /** El telefono que escribe, ¿es del administrador del negocio? */
  esAdmin = false;
  agenda = '09:00 · PENDIENTE · Maria Lopez · Limpieza facial profunda · Ana';

  async serviciosDelMenu() {
    return this.servicios;
  }

  async nombreNegocio() {
    return 'Estetica Ejemplo';
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

  async esAdministrador(_telefono: string) {
    return this.esAdmin;
  }

  async agendaDelDia() {
    return this.agenda;
  }
}

class ReservadorFake {
  reservas: unknown[] = [];
  error: Error | null = null;

  async reservar(dto: unknown) {
    if (this.error) {
      throw this.error;
    }
    this.reservas.push(dto);
    return { id: 'cita-1' };
  }

  async disponibilidad(query: { fecha: string }) {
    return { fecha: query.fecha, slots: SLOTS };
  }
}

/** El asistente de mentira: devuelve turnos guionizados y registra lo que recibio. */
class AsistenteFake {
  siguientes: RespuestaAsistente[] = [];
  error: Error | null = null;
  instrucciones = '';
  historial: { rol: string; texto: string }[] = [];

  async conversar(instrucciones: string, historial: { rol: string; texto: string }[]) {
    if (this.error) {
      throw this.error;
    }
    this.instrucciones = instrucciones;
    this.historial = historial;
    const siguiente = this.siguientes.shift();
    if (!siguiente) {
      throw new Error('El test no guionizo este turno.');
    }
    return siguiente;
  }
}

function armarBot(overrides?: {
  conversaciones?: ConversacionesFake;
  catalogo?: CatalogoFake;
  reservador?: ReservadorFake;
  canal?: CanalFake;
  asistente?: AsistenteFake;
}) {
  const conversaciones = overrides?.conversaciones ?? new ConversacionesFake();
  const catalogo = overrides?.catalogo ?? new CatalogoFake();
  const reservador = overrides?.reservador ?? new ReservadorFake();
  const canal = overrides?.canal ?? new CanalFake();
  const asistente = overrides?.asistente ?? new AsistenteFake();

  const bot = new ChatbotLlmService(
    conversaciones as unknown as ConversacionService,
    catalogo as unknown as CatalogoBotService,
    reservador as unknown as ReservadorCitas,
    canal as unknown as WhatsappGateway,
    asistente as unknown as AsistenteChat,
  );

  const enviar = async (texto: string) => {
    await bot.procesar({ ...MENSAJE, texto });
    return canal.enviados.splice(-canal.enviados.length);
  };

  return { bot, conversaciones, catalogo, reservador, canal, asistente, enviar };
}

describe('ChatbotLlmService', () => {
  it('conversa: guarda lo validado, el historial y responde el texto del modelo', async () => {
    const { conversaciones, asistente, enviar } = armarBot();
    asistente.siguientes = [
      {
        respuesta: 'Claro, con quien lo atiendo?',
        accion: 'nada',
        datos: { servicioId: 'srv-1' },
      },
    ];

    const respuestas = await enviar('quiero una limpieza facial');

    expect(respuestas).toEqual(['Claro, con quien lo atiendo?']);
    const fila = conversaciones.filas.get('88887777');
    expect(fila?.estado).toBe(Estado.CONVERSANDO);
    expect(fila?.datos.servicioId).toBe('srv-1');
    expect(fila?.datos.historial).toEqual([
      { rol: 'usuario', texto: 'quiero una limpieza facial' },
      { rol: 'asistente', texto: 'Claro, con quien lo atiendo?' },
    ]);
    // El prompt lleva el catalogo real y el turno del cliente.
    expect(asistente.instrucciones).toContain('srv-1');
    expect(asistente.instrucciones).toContain('Limpieza facial profunda');
    expect(asistente.historial).toEqual([
      { rol: 'usuario', texto: 'quiero una limpieza facial' },
    ]);
  });

  it('muestra los horarios reales al modelo solo cuando hay servicio y profesional', async () => {
    const { asistente, enviar } = armarBot();
    asistente.siguientes = [
      { respuesta: 'ok', accion: 'nada', datos: {} },
    ];

    await enviar('hola');

    // Sin servicio y profesional elegidos, el modelo no ve horarios.
    expect(asistente.instrucciones).toContain('preguntalos antes de mostrar horarios');
  });

  it('reserva cuando el modelo pide el alta con los cuatro datos validados', async () => {
    const { conversaciones, reservador, asistente, enviar } = armarBot();

    // Primer turno: del catalogo puede salir servicio y profesional; la hora no,
    // porque todavia no vio slots.
    asistente.siguientes = [
      {
        respuesta: 'A que hora le sirve?',
        accion: 'nada',
        datos: { servicioId: 'srv-1', empleadoId: 'emp-1' },
      },
    ];
    await enviar('quiero una limpieza con Ana');

    // Segundo turno: con servicio y profesional en curso, los slots ya estuvieron
    // en el contexto y el modelo puede devolver uno tal cual.
    asistente.siguientes = [
      {
        respuesta: 'Le confirmo el alta.',
        accion: 'reservar',
        datos: {
          servicioId: 'srv-1',
          empleadoId: 'emp-1',
          inicio: '2026-09-19T15:00:00.000Z',
          nombre: 'Juan Perez',
        },
      },
    ];
    const respuestas = await enviar('a las 9, a nombre de Juan Perez');

    expect(reservador.reservas).toEqual([
      {
        servicioId: 'srv-1',
        empleadoId: 'emp-1',
        inicio: '2026-09-19T15:00:00.000Z',
        cliente: { telefono: '88887777', nombre: 'Juan Perez' },
      },
    ]);
    expect(conversaciones.filas.size).toBe(0);
    // El comprobante es deterministico, no texto del modelo.
    expect(respuestas[0]).toContain('✅ Cita reservada');
    expect(respuestas[0]).toContain('Limpieza facial profunda con Ana Perez');
    expect(respuestas[0]).toContain('Le llega un mensaje aparte con el enlace');
  });

  it('descarta un servicio que el modelo invento', async () => {
    const { conversaciones, asistente, enviar } = armarBot();
    asistente.siguientes = [
      {
        respuesta: 'Elegido!',
        accion: 'nada',
        datos: { servicioId: 'srv-inventado' },
      },
    ];

    await enviar('quiero lo que sea');

    const fila = conversaciones.filas.get('88887777');
    expect(fila?.datos.servicioId).toBeUndefined();
  });

  it('descarta una hora que no estaba en los horarios mostrados', async () => {
    const { conversaciones, asistente, enviar } = armarBot();
    // Primero elige servicio y profesional validos...
    await (async () => {
      asistente.siguientes = [
        {
          respuesta: 'ok',
          accion: 'nada',
          datos: { servicioId: 'srv-1', empleadoId: 'emp-2' },
        },
      ];
      await enviar('limpieza con Luis');
    })();

    // ...y despues propone una hora que no existe en el menu.
    asistente.siguientes = [
      {
        respuesta: 'listo',
        accion: 'nada',
        datos: { inicio: '2026-09-19T03:00:00.000Z' },
      },
    ];
    await enviar('a las 3 de la manana');

    const fila = conversaciones.filas.get('88887777');
    expect(fila?.datos.servicioId).toBe('srv-1');
    expect(fila?.datos.empleadoId).toBe('emp-2');
    expect(fila?.datos.inicio).toBeUndefined();
  });

  it('el alta sin los datos completos no relee al modelo: pide lo que falta', async () => {
    const { conversaciones, reservador, asistente, enviar } = armarBot();
    asistente.siguientes = [
      {
        respuesta: 'Listo, su cita quedo reservada.',
        accion: 'reservar',
        datos: { servicioId: 'srv-1' },
      },
    ];

    const respuestas = await enviar('confirmame');

    expect(reservador.reservas).toEqual([]);
    expect(respuestas[0]).toContain('Antes de confirmar me falta');
    expect(respuestas[0]).toContain('el profesional');
    expect(respuestas[0]).toContain('el dia y la hora');
    expect(respuestas[0]).toContain('el nombre');
    expect(conversaciones.filas.get('88887777')?.estado).toBe(
      Estado.CONVERSANDO,
    );
  });

  it('el 409 suelta la hora y avisa sin gastar un turno del modelo', async () => {
    const { conversaciones, reservador, asistente, enviar } = armarBot();
    reservador.error = new ConflictException('Ese horario ya esta tomado. Elija otro.');

    asistente.siguientes = [
      { respuesta: 'A que hora?', accion: 'nada', datos: { servicioId: 'srv-1', empleadoId: 'emp-1' } },
    ];
    await enviar('limpieza con Ana');

    asistente.siguientes = [
      {
        respuesta: 'Confirmado.',
        accion: 'reservar',
        datos: {
          servicioId: 'srv-1',
          empleadoId: 'emp-1',
          inicio: '2026-09-19T15:00:00.000Z',
          nombre: 'Juan Perez',
        },
      },
    ];
    const respuestas = await enviar('a las 9, Juan Perez');

    expect(respuestas).toEqual([HORARIO_OCUPADO]);
    const fila = conversaciones.filas.get('88887777');
    expect(fila?.datos.inicio).toBeUndefined();
    expect(fila?.datos.nombre).toBe('Juan Perez');
  });

  it('cancelar corta sin pasar por el modelo', async () => {
    const { conversaciones, asistente, enviar } = armarBot();
    asistente.siguientes = [{ respuesta: 'ok', accion: 'nada', datos: {} }];
    await enviar('hola');

    const respuestas = await enviar('cancelar');

    expect(respuestas).toEqual([DESPEDIDA]);
    expect(conversaciones.filas.size).toBe(0);
    expect(asistente.siguientes).toHaveLength(0); // el turno guionizado ya se uso en el hola; cancelar no consumio ninguno mas
  });

  it('un asistente caido avisa al cliente y no avanza nada', async () => {
    const { conversaciones, asistente, enviar } = armarBot();
    asistente.error = new AsistenteNoDisponibleError('Mistral 429');

    const respuestas = await enviar('hola');

    expect(respuestas).toEqual([ERROR_INESPERADO]);
    expect(conversaciones.filas.size).toBe(0);
  });

  it('el telefono del administrador recibe la personalidad de admin y su agenda', async () => {
    const { asistente, enviar } = armarBot({
      catalogo: Object.assign(new CatalogoFake(), { esAdmin: true }),
    });
    asistente.siguientes = [{ respuesta: 'dale', accion: 'nada', datos: {} }];

    await enviar('que hay hoy?');

    expect(asistente.instrucciones).toContain('quien te escribe es el administrador');
    expect(asistente.instrucciones).toContain('Agenda de hoy:');
    expect(asistente.instrucciones).toContain('Maria Lopez');
    expect(asistente.instrucciones).toContain('solo lectura');
  });

  it('un telefono de cliente recibe la personalidad de cliente y ninguna agenda', async () => {
    const { asistente, enviar } = armarBot();
    asistente.siguientes = [{ respuesta: 'dale', accion: 'nada', datos: {} }];

    await enviar('hola');

    expect(asistente.instrucciones).toContain('tratando al cliente de usted');
    expect(asistente.instrucciones).not.toContain('Agenda de hoy:');
    expect(asistente.instrucciones).not.toContain('Maria Lopez');
    expect(asistente.instrucciones).toContain('No hablas de otros clientes');
  });
});
