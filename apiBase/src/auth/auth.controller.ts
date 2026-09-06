import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import type { AuthenticatedUser } from './jwt-payload.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Cualquier rol autenticado, y solo sobre si mismo: el id sale del token y nunca de
  // la ruta, asi que no hay propiedad que comprobar.
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId);
  }
}
