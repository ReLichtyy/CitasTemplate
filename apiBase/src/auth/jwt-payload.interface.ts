import { Role } from '../common/enums/role.enum.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}
