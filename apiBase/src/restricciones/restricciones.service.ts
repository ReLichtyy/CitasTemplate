import { Injectable, NotImplementedException } from '@nestjs/common';

// TODO: back by real persistence once the data model is defined.
@Injectable()
export class RestriccionesService {
  findAll() {
    return [];
  }

  findOne(id: string) {
    throw new NotImplementedException(`Restriccion ${id} lookup not implemented`);
  }

  create(dto: unknown) {
    throw new NotImplementedException('Restriccion creation not implemented');
  }

  update(id: string, dto: unknown) {
    throw new NotImplementedException(`Restriccion ${id} update not implemented`);
  }

  remove(id: string) {
    throw new NotImplementedException(`Restriccion ${id} removal not implemented`);
  }
}
