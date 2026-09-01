import { Injectable, NotImplementedException } from '@nestjs/common';

// TODO: back by real persistence once the data model is defined.
@Injectable()
export class HorariosService {
  findAll() {
    return [];
  }

  findOne(id: string) {
    throw new NotImplementedException(`Horario ${id} lookup not implemented`);
  }

  create(dto: unknown) {
    throw new NotImplementedException('Horario creation not implemented');
  }

  update(id: string, dto: unknown) {
    throw new NotImplementedException(`Horario ${id} update not implemented`);
  }

  remove(id: string) {
    throw new NotImplementedException(`Horario ${id} removal not implemented`);
  }
}
