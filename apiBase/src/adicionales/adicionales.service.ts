import { Injectable, NotImplementedException } from '@nestjs/common';

// TODO: back by real persistence once the data model is defined.
@Injectable()
export class AdicionalesService {
  findAll() {
    return [];
  }

  findOne(id: string) {
    throw new NotImplementedException(`Adicional ${id} lookup not implemented`);
  }

  create(dto: unknown) {
    throw new NotImplementedException('Adicional creation not implemented');
  }

  update(id: string, dto: unknown) {
    throw new NotImplementedException(`Adicional ${id} update not implemented`);
  }

  remove(id: string) {
    throw new NotImplementedException(`Adicional ${id} removal not implemented`);
  }
}
