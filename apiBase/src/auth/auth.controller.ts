import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { LimiteIntentos } from '../common/decorators/limite-intentos.decorator.js';
import { LimiteIntentosGuard } from '../common/guards/limite-intentos.guard.js';
import { AuthService } from './auth.service.js';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegistroDto } from './dto/registro.dto.js';
import type { AuthenticatedUser } from './jwt-payload.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Las dos rutas abiertas del modulo son tambien las dos que un atacante puede repetir
  // sin cuenta: se limitan por IP. Ver 03-autorizacion.md.
  @Public()
  @UseGuards(LimiteIntentosGuard)
  @LimiteIntentos({ intentos: 10, ventanaMs: 5 * 60_000 })
  // 200 y no 201: el login no crea nada.
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(LimiteIntentosGuard)
  @LimiteIntentos({ intentos: 5, ventanaMs: 60 * 60_000 })
  @Post('registro')
  registro(@Body() dto: RegistroDto) {
    return this.authService.registro(dto);
  }

  // Cualquier rol autenticado, y solo sobre si mismo: el id sale del token y nunca de
  // la ruta, asi que no hay propiedad que comprobar.
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId);
  }

  @Patch('me')
  actualizarPerfil(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ActualizarPerfilDto,
  ) {
    return this.authService.actualizarPerfil(user.userId, dto);
  }
}
