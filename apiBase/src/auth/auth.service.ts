import { Injectable, NotImplementedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  // TODO: replace with real user lookup + password check once persistence is chosen.
  async login(_dto: LoginDto): Promise<{ accessToken: string }> {
    throw new NotImplementedException('User store not wired up yet');
  }
}
