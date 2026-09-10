import { ConsoleLogger, LogLevel, LoggerService } from '@nestjs/common';
import { requestIdActual } from './contexto-peticion.js';

/** De mas grave a menos. El nivel configurado deja pasar todo lo que este en su indice o antes. */
const NIVELES: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/** Campos extra que un log puede llevar ademas del mensaje. Se serializan como JSON, no como texto. */
export type DatosLog = Record<string, unknown>;

/**
 * Ningun mensaje legitimo se acerca a esto. Corta el caso de un `message` gigante —una
 * respuesta de terceros, un cuerpo entero— que multiplicaria el tamaño del log por cada
 * linea repetida.
 */
const LARGO_MAXIMO_MENSAJE = 2_000;
const LARGO_MAXIMO_TRAZA = 8_000;

function recortar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo)}…[recortado]`;
}

function esDatosLog(valor: unknown): valor is DatosLog {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Logger de la aplicacion. Dos formatos, misma informacion:
 *
 * - **json** (defecto en produccion): una linea por evento, `JSON.stringify`. Es lo que
 *   permite `grep`, `jq` y que journald/Loki lo indexen sin parsear texto libre. La
 *   serializacion tambien es la defensa contra la inyeccion de logs: un salto de linea
 *   dentro de un mensaje sale escapado como `\n` y no puede fabricar una linea falsa.
 *   Importa porque parte de lo que se loguea viene del navegador (ver `telemetria/`).
 * - **texto** (defecto fuera de produccion): el `ConsoleLogger` de Nest, con colores.
 *   Leer JSON crudo mientras se desarrolla es peor que leer texto.
 *
 * Todo evento lleva el `requestId` de su peticion, tomado del contexto async. No hay que
 * pasarlo: los `new Logger(...)` que ya existen en el codigo lo heredan sin cambiar una
 * linea.
 */
export class LoggerEstructurado implements LoggerService {
  private readonly consola = new ConsoleLogger();
  private readonly json: boolean;
  private readonly umbral: number;

  constructor(opciones: { json: boolean; nivel: LogLevel }) {
    this.json = opciones.json;
    const indice = NIVELES.indexOf(opciones.nivel);
    this.umbral = indice === -1 ? NIVELES.indexOf('log') : indice;
    this.consola.setLogLevels(NIVELES.slice(0, this.umbral + 1));
  }

  fatal(mensaje: unknown, ...resto: unknown[]) {
    this.escribir('fatal', mensaje, resto);
  }

  error(mensaje: unknown, ...resto: unknown[]) {
    this.escribir('error', mensaje, resto);
  }

  warn(mensaje: unknown, ...resto: unknown[]) {
    this.escribir('warn', mensaje, resto);
  }

  log(mensaje: unknown, ...resto: unknown[]) {
    this.escribir('log', mensaje, resto);
  }

  debug(mensaje: unknown, ...resto: unknown[]) {
    this.escribir('debug', mensaje, resto);
  }

  verbose(mensaje: unknown, ...resto: unknown[]) {
    this.escribir('verbose', mensaje, resto);
  }

  private escribir(nivel: LogLevel, mensaje: unknown, resto: unknown[]) {
    if (NIVELES.indexOf(nivel) > this.umbral) {
      return;
    }

    if (!this.json) {
      // En modo texto se delega tal cual: el formato de Nest ya es el bueno para leer a
      // mano, y lo unico que falta es el id, que va como prefijo.
      const requestId = requestIdActual();
      const conId = requestId ? `[${requestId.slice(0, 8)}] ${String(mensaje)}` : mensaje;
      this.consola[nivel === 'fatal' ? 'error' : nivel](conId, ...(resto as string[]));
      return;
    }

    const { contexto, traza, datos } = this.separar(resto);
    const registro: DatosLog = {
      ts: new Date().toISOString(),
      nivel,
      ctx: contexto,
      requestId: requestIdActual(),
      ...datos,
    };

    // El mensaje puede ser un objeto: `logger.log({ evento: 'x', ms: 12 })` sale como
    // campos y no como una cadena que despues habria que volver a parsear.
    if (esDatosLog(mensaje)) {
      Object.assign(registro, mensaje);
    } else {
      registro.msg = recortar(String(mensaje), LARGO_MAXIMO_MENSAJE);
    }

    if (traza) {
      registro.traza = recortar(traza, LARGO_MAXIMO_TRAZA);
    }

    // stdout directo: `console.log` de Node ya escribe una linea por llamada y no
    // entrelaza. El destino es el gestor de procesos (systemd, pm2, docker), que es quien
    // sabe rotar; la aplicacion no escribe archivos.
    process.stdout.write(`${JSON.stringify(registro, reemplazoSeguro())}\n`);
  }

  /**
   * Nest manda el contexto como ultimo parametro y, en `error`, la traza como primero.
   * Ninguno de los dos viene etiquetado, asi que hay que distinguirlos por forma: un
   * `Error`, una cadena multilinea o una muy larga es traza; una cadena corta de una sola
   * linea es el nombre del contexto (`'CitasService'`).
   */
  private separar(resto: unknown[]): {
    contexto: string | null;
    traza: string | null;
    datos: DatosLog;
  } {
    let contexto: string | null = null;
    let traza: string | null = null;
    const datos: DatosLog = {};

    for (const valor of resto) {
      if (valor instanceof Error) {
        traza = valor.stack ?? `${valor.name}: ${valor.message}`;
      } else if (typeof valor === 'string') {
        if (valor.includes('\n') || valor.length > 80) {
          traza = valor;
        } else {
          contexto = valor;
        }
      } else if (esDatosLog(valor)) {
        Object.assign(datos, valor);
      }
    }

    return { contexto, traza, datos };
  }
}

/**
 * `JSON.stringify` revienta con referencias circulares y con `BigInt`, y un log que lanza
 * tumba la peticion que estaba registrando. Un log nunca debe ser la causa de un fallo.
 */
function reemplazoSeguro() {
  const vistos = new WeakSet<object>();
  return (_clave: string, valor: unknown) => {
    if (typeof valor === 'bigint') {
      return valor.toString();
    }
    if (typeof valor === 'object' && valor !== null) {
      if (vistos.has(valor)) {
        return '[circular]';
      }
      vistos.add(valor);
    }
    return valor;
  };
}

/**
 * Construye el logger desde el entorno. `LOG_FORMAT` y `LOG_LEVEL` estan en `.env.example`.
 * Los defectos dependen de `NODE_ENV` porque son opuestos: en el VPS interesa una linea
 * JSON por evento y en desarrollo interesa leerlo.
 */
export function crearLogger(): LoggerEstructurado {
  const produccion = process.env.NODE_ENV === 'production';
  const formato = process.env.LOG_FORMAT ?? (produccion ? 'json' : 'texto');
  const nivel = (process.env.LOG_LEVEL ?? (produccion ? 'log' : 'debug')) as LogLevel;

  return new LoggerEstructurado({
    json: formato === 'json',
    nivel: NIVELES.includes(nivel) ? nivel : 'log',
  });
}
