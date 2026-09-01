import { Injectable, NotImplementedException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface.js';

// TODO: back by real persistence + traslape/disponibilidad rules once the spec is written.
@Injectable()
export class CitasService {
  findAll(_user: AuthenticatedUser) {
    // TODO: Admin sees all, Empleado sees own agenda, Cliente sees own citas.
    return [];
  }

  findOne(id: string, _user: AuthenticatedUser) {
    throw new NotImplementedException(`Cita ${id} lookup not implemented`);
  }

  reservar(dto: unknown, _user: AuthenticatedUser) {
    throw new NotImplementedException('Cita reservation not implemented');
  }

  update(id: string, dto: unknown, _user: AuthenticatedUser) {
    throw new NotImplementedException(`Cita ${id} update not implemented`);
  }

  cancelar(id: string, _user: AuthenticatedUser) {
    throw new NotImplementedException(`Cita ${id} cancellation not implemented`);
  }
}
