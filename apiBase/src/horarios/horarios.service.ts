import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearHorarioDto } from './dto/crear-horario.dto.js';
import type { ActualizarHorarioDto } from './dto/actualizar-horario.dto.js';

const MENSAJE_NO_ENCONTRADO = 'Recurso no encontrado.';

/**
 * Franjas de atencion del negocio. La forma es la fila completa: esta pantalla es de
 * gestion y el `activo` apagado es justo lo que hay que ver para reencenderlo.
 */
const CAMPOS = {
  id: true,
  dia: true,
  minutoApertura: true,
  minutoCierre: true,
  activo: true,
} satisfies Prisma.HorarioAtencionSelect;

@Injectable()
export class HorariosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sin paginar: una semana tiene siete dias y por dia caben dos o tres turnos partidos.
   * Es configuracion, no datos que crecen con el uso. Ver 04-contrato-api.md.
   */
  findAll() {
    // Orden de presentacion: el dia como lo lee la agenda, y dentro del dia, de abrir a cerrar.
    return this.prisma.horarioAtencion.findMany({
      select: CAMPOS,
      orderBy: [{ dia: 'asc' }, { minutoApertura: 'asc' }],
    });
  }

  async findOne(id: string) {
    const horario = await this.prisma.horarioAtencion.findUnique({
      where: { id },
      select: CAMPOS,
    });
    if (!horario) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return horario;
  }

  async create(dto: CrearHorarioDto) {
    this.exigirCoherencia(dto.minutoApertura, dto.minutoCierre);
    try {
      return await this.prisma.horarioAtencion.create({ data: dto, select: CAMPOS });
    } catch (error) {
      throw this.traducirDuplicado(error);
    }
  }

  async update(id: string, dto: ActualizarHorarioDto) {
    // El parche puede traer un solo extremo: la coherencia se comprueba contra el estado
    // que quede, no contra lo que vino.
    const actual = await this.exigir(id);
    const apertura = dto.minutoApertura ?? actual.minutoApertura;
    const cierre = dto.minutoCierre ?? actual.minutoCierre;
    this.exigirCoherencia(apertura, cierre);

    try {
      return await this.prisma.horarioAtencion.update({
        where: { id },
        data: dto,
        select: CAMPOS,
      });
    } catch (error) {
      throw this.traducirDuplicado(error);
    }
  }

  /**
   * Borra de verdad. A diferencia de productos y adicionales, una franja de horario no
   * queda citada en ningun registro historico — es configuracion de la semana, y la
   * vuelta atras es volver a crearla. Apagar `activo` sigue existiendo para pausar un dia
   * sin perder el resto de los rangos.
   */
  async remove(id: string) {
    await this.exigir(id);
    // Se devuelve la fila borrada: la pantalla la necesita para quitarla de la lista sin
    // volver a pedir todo.
    return this.prisma.horarioAtencion.delete({ where: { id }, select: CAMPOS });
  }

  /**
   * Una franja que cierra antes de abrir no atiende nada y no es un 500 de la base: es un
   * dato que la pantalla mando mal. Los extremos que se tocan (cerrar a la hora exacta en
   * que otra abre) si son validos — los rangos son semiabiertos. Ver 02-reservas-concurrencia.md.
   */
  private exigirCoherencia(apertura: number, cierre: number) {
    if (apertura >= cierre) {
      throw new BadRequestException('La hora de apertura debe ser anterior a la de cierre.');
    }
  }

  private async exigir(id: string) {
    const horario = await this.prisma.horarioAtencion.findUnique({
      where: { id },
      select: { minutoApertura: true, minutoCierre: true },
    });
    if (!horario) {
      throw new NotFoundException(MENSAJE_NO_ENCONTRADO);
    }
    return horario;
  }

  /**
   * El unique `[dia, minutoApertura]` de la base decide la carrera entre dos altas
   * simultaneas; la consulta de arriba no alcanza para eso. Lo que si hace falta es
   * traducir el P2002 — un error de Prisma sale como 500 generico y su mensaje publica
   * nombres de tabla — al 409 redactado que el contrato le debe al usuario final.
   * Ver 04-contrato-api.md.
   */
  private traducirDuplicado(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Ese dia ya tiene una franja que abre a esa hora.');
    }
    return error;
  }
}
