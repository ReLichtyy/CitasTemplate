import { Injectable } from '@nestjs/common';
import type { EstadoCita, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Cuanto vive una lectura antes de volver a la base. Corto a proposito: la ventana de
 * desfase tras editar la configuracion es de un minuto, y a cambio una reserva deja de
 * pagar tres o cuatro viajes a la base **dentro** de su transaccion. Ver
 * 02-reservas-concurrencia.md: ahi cada milisegundo con la transaccion abierta es
 * tiempo de lock, y por tanto tasa de conflicto entre dos personas que pulsan el mismo
 * horario.
 */
const TTL_MS = 60_000;

/** Lo unico que el resto del API necesita de la fila de configuracion. */
const CAMPOS_NEGOCIO = {
  nombre: true,
  zonaHoraria: true,
  locale: true,
  prefijoPais: true,
} satisfies Prisma.ConfiguracionNegocioSelect;

export type NegocioCacheado = Prisma.ConfiguracionNegocioGetPayload<{
  select: typeof CAMPOS_NEGOCIO;
}>;

const ZONA_POR_DEFECTO = 'UTC';

/**
 * Un valor releido de la base cada `TTL_MS`.
 *
 * Guarda la **promesa** y no el valor: dos peticiones que fallan la cache a la vez
 * comparten una sola consulta en vez de disparar dos. Una promesa rechazada se descarta,
 * para que un fallo puntual de la base no quede cacheado un minuto entero.
 */
class Cacheado<T> {
  private entrada?: { valor: Promise<T>; expiraEn: number };

  constructor(private readonly consultar: () => Promise<T>) {}

  leer(): Promise<T> {
    if (this.entrada && this.entrada.expiraEn > Date.now()) {
      return this.entrada.valor;
    }

    const valor = this.consultar();
    const entrada = { valor, expiraEn: Date.now() + TTL_MS };
    this.entrada = entrada;

    // El `catch` solo evita el rechazo no manejado y suelta la entrada fallida; quien
    // espera la promesa sigue recibiendo el error tal cual.
    valor.catch(() => {
      if (this.entrada === entrada) {
        this.entrada = undefined;
      }
    });

    return valor;
  }

  invalidar(): void {
    this.entrada = undefined;
  }
}

/**
 * Lectura cacheada de las dos tablas que son **configuracion**, no datos: la fila unica
 * de `ConfiguracionNegocio` y el catalogo completo de `EstadoCita`. Las dos se releian en
 * cada reserva, cada cancelacion y cada confirmacion, y ninguna cambia entre dos
 * peticiones salvo que un administrador las edite.
 *
 * Lee siempre por `PrismaService` y nunca por el `tx` del llamador, aunque se la invoque
 * dentro de una transaccion: son datos que no participan de la carrera que esa
 * transaccion protege, y sacarlos de ella es justamente el punto.
 */
@Injectable()
export class CatalogoService {
  private readonly negocioCache = new Cacheado(() =>
    this.prisma.configuracionNegocio.findUnique({
      where: { id: 1 },
      select: CAMPOS_NEGOCIO,
    }),
  );

  /**
   * El catalogo entero son cinco filas, asi que se trae de una vez: pedir uno o pedirlos
   * todos cuesta lo mismo, y la siguiente busqueda ya no consulta.
   */
  private readonly estadosCache = new Cacheado(async () => {
    const filas = await this.prisma.estadoCita.findMany();
    return new Map(filas.map((fila) => [fila.codigo, fila]));
  });

  constructor(private readonly prisma: PrismaService) {}

  negocio(): Promise<NegocioCacheado | null> {
    return this.negocioCache.leer();
  }

  /** La zona del negocio, o UTC si nadie configuro la fila todavia. */
  async zonaHoraria(): Promise<string> {
    return (await this.negocio())?.zonaHoraria ?? ZONA_POR_DEFECTO;
  }

  /** Un estado por su codigo, o `undefined` si ese codigo no existe. */
  async estado(codigo: string): Promise<EstadoCita | undefined> {
    return (await this.estadosCache.leer()).get(codigo);
  }

  /**
   * Para el dia que exista la ruta que edita la configuracion o el catalogo de estados:
   * ese handler llama aqui y el cambio se ve en la siguiente peticion, no al minuto.
   */
  invalidar(): void {
    this.negocioCache.invalidar();
    this.estadosCache.invalidar();
  }
}
