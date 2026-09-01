import { Injectable, NotImplementedException } from '@nestjs/common';

// TODO: back by real persistence once the data model is defined.
@Injectable()
export class EmpleadosService {
  findAll() {
    return [];
  }

  findOne(id: string) {
    throw new NotImplementedException(`Empleado ${id} lookup not implemented`);
  }

  create(dto: unknown) {
    throw new NotImplementedException('Empleado creation not implemented');
  }

  update(id: string, dto: unknown) {
    throw new NotImplementedException(`Empleado ${id} update not implemented`);
  }

  remove(id: string) {
    throw new NotImplementedException(`Empleado ${id} removal not implemented`);
  }
}
