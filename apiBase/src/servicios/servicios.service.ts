import { Injectable, NotImplementedException } from '@nestjs/common';

// TODO: back by real persistence once the data model is defined.
@Injectable()
export class ServiciosService {
  findAll() {
    return [];
  }

  findOne(id: string) {
    throw new NotImplementedException(`Servicio ${id} lookup not implemented`);
  }

  create(dto: unknown) {
    throw new NotImplementedException('Servicio creation not implemented');
  }

  update(id: string, dto: unknown) {
    throw new NotImplementedException(`Servicio ${id} update not implemented`);
  }

  remove(id: string) {
    throw new NotImplementedException(`Servicio ${id} removal not implemented`);
  }
}
