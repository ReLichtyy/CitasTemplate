import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Prisma, Rol } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizarTelefono } from '../common/telefono.js';
import { Role } from '../common/enums/role.enum.js';
import type { ActualizarPerfilDto } from './dto/actualizar-perfil.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegistroDto } from './dto/registro.dto.js';
import type { JwtPayload } from './jwt-payload.interface.js';

/**
 * Coste de bcrypt. 12 son ~250 ms en hardware de VPS modesto: caro para quien prueba
 * millones de contrasenas, imperceptible en un login. Subirlo mas empieza a costarle al
 * usuario legitimo y a dar un vector de saturacion.
 */
const BCRYPT_ROUNDS = 12;

/** Contrasena que nadie tiene: el señuelo se hashea a partir de esto al arrancar. */
const SEÑUELO = randomBytes(32).toString('hex');

/** Mismo texto para telefono inexistente, contrasena incorrecta y cuenta inactiva. */
const MENSAJE_CREDENCIALES = 'Telefono o contrasena incorrectos.';

/**
 * Lo que sale hacia el cliente. `password` no esta, y no puede colarse: es un `select`
 * explicito, no un `omit` que se olvide al agregar un campo. Ver 04-contrato-api.md.
 */
const USUARIO_PROPIO = {
  id: true,
  telefono: true,
  nombre: true,
  apellido: true,
  email: true,
  rol: true,
} satisfies Prisma.UsuarioSelect;

type UsuarioPropio = Prisma.UsuarioGetPayload<{ select: typeof USUARIO_PROPIO }>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Hash de una contrasena que nadie tiene. Se compara contra el cuando el telefono no
   * existe o no tiene contrasena, para que un login fallido cueste lo mismo en los tres
   * casos: sin esto, el tiempo de respuesta dice quien esta registrado.
   *
   * Se calcula una sola vez, perezosamente, para no pagar un bcrypt en el arranque.
   */
  private readonly hashSeñuelo = hash(SEÑUELO, BCRYPT_ROUNDS);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Login por telefono. Un telefono inexistente, una contrasena incorrecta, una ficha de
   * invitado sin contrasena y una cuenta inactiva devuelven exactamente lo mismo: el login
   * no es un directorio de quien esta registrado.
   */
  async login(dto: LoginDto) {
    const telefono = normalizarTelefono(dto.telefono);
    const usuario = await this.prisma.usuario.findUnique({
      where: { telefono },
      select: { ...USUARIO_PROPIO, password: true, activo: true },
    });

    // Se compara siempre, incluso sin usuario: salir antes por `return` haria que el
    // fallo por telefono desconocido fuera mediblemente mas rapido que el fallo por
    // contrasena.
    const coincide = await compare(
      dto.password,
      usuario?.password ?? (await this.hashSeñuelo),
    );

    if (!usuario || !usuario.password || !usuario.activo || !coincide) {
      throw new UnauthorizedException(MENSAJE_CREDENCIALES);
    }

    const { password: _password, activo: _activo, ...propio } = usuario;
    return this.sesion(propio);
  }

  /**
   * Alta de cuenta. Siempre CLIENTE: el rol no se acepta del cuerpo ni aunque llegue.
   *
   * Un telefono puede existir ya **sin** contrasena — es la ficha que crea una reserva de
   * invitado. Registrarse sobre ella le pone contrasena y conserva sus citas, que es el
   * camino normal del producto. El 409 es solo para el telefono que ya tiene contrasena.
   *
   * Riesgo asumido y no mitigado: sin verificar el numero, quien conozca el telefono de un
   * invitado puede reclamar esa ficha y ver sus citas. Es la misma falta de verificacion
   * que ya permite reservar a nombre ajeno (SPEC.md); se cierra con verificacion por SMS,
   * y este es el punto donde entraria.
   */
  async registro(dto: RegistroDto) {
    const telefono = normalizarTelefono(dto.telefono);
    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    const existente = await this.prisma.usuario.findUnique({
      where: { telefono },
      select: { id: true, password: true, activo: true },
    });

    if (existente?.password) {
      // 409 redactado para que el usuario final lo lea tal cual. Ver 04-contrato-api.md.
      throw new ConflictException(
        'Ese telefono ya tiene una cuenta. Inicie sesion con el.',
      );
    }

    if (existente) {
      // Una ficha desactivada no se reactiva registrandose encima: eso convertiria la baja
      // en un tramite reversible por el propio dado de baja.
      if (!existente.activo) {
        throw new ConflictException(
          'Ese telefono no puede registrarse. Comuniquese con el negocio.',
        );
      }
      const usuario = await this.prisma.usuario.update({
        where: { id: existente.id },
        // Solo se agrega la credencial y lo que la ficha de invitado no traia. El `rol`
        // no se toca: si esa ficha es de un EMPLEADO, registrarse no lo degrada.
        data: {
          password: passwordHash,
          nombre: dto.nombre,
          apellido: dto.apellido || null,
          email: dto.email || null,
        },
        select: USUARIO_PROPIO,
      });
      this.logger.log(`Ficha de invitado reclamada: ${usuario.id}`);
      return this.sesion(usuario);
    }

    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          telefono,
          password: passwordHash,
          nombre: dto.nombre,
          apellido: dto.apellido || null,
          email: dto.email || null,
          rol: Rol.CLIENTE,
        },
        select: USUARIO_PROPIO,
      });
      return this.sesion(usuario);
    } catch (error) {
      // Dos registros simultaneos del mismo telefono: el unique de la base es quien
      // decide, no la consulta de arriba.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ese telefono ya tiene una cuenta. Inicie sesion con el.',
        );
      }
      throw error;
    }
  }

  /**
   * Los datos propios de quien tiene sesion. Es lo que permite a ReservarPage ofrecer
   * los datos ya guardados en vez de pedirlos otra vez, y lo que deja al frontend saber
   * su rol tras recargar sin decodificar el token.
   */
  async me(userId: string): Promise<UsuarioPropio> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: USUARIO_PROPIO,
    });
    if (!usuario) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return usuario;
  }

  /** Edita la propia ficha. El id sale del token; no hay id de ruta que suplantar. */
  async actualizarPerfil(
    userId: string,
    dto: ActualizarPerfilDto,
  ): Promise<UsuarioPropio> {
    try {
      return await this.prisma.usuario.update({
        where: { id: userId },
        // Campo ausente = no se toca; cadena vacia = se borra. `nombre` no acepta el
        // borrado: el DTO exige al menos un caracter.
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.apellido !== undefined ? { apellido: dto.apellido || null } : {}),
          ...(dto.email !== undefined ? { email: dto.email || null } : {}),
        },
        select: USUARIO_PROPIO,
      });
    } catch (error) {
      // El token es valido pero la ficha ya no esta (borrada mientras la sesion vivia).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Recurso no encontrado.');
      }
      throw error;
    }
  }

  /**
   * El token lleva `sub`, `telefono` y `rol`, y nada mas. La ficha viaja **fuera** del
   * token, en el cuerpo de la respuesta: es para que el navegador sepa que pintar sin
   * decodificar la credencial. La autoridad sigue siendo el token en cada peticion.
   */
  private async sesion(usuario: UsuarioPropio) {
    const payload: JwtPayload = {
      sub: usuario.id,
      telefono: usuario.telefono,
      rol: usuario.rol as Role,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario,
    };
  }
}
