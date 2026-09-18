import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { EspecialidadesService } from './especialidades.service.js';

/**
 * Solo lectura, y publica: los nombres ya salen al catalogo dentro de cada empleado, y
 * una lista de nombres no es informacion sensible. Las altas de especialidades no existen
 * todavia como pantalla — cuando existan, llegan con su `@Roles(ADMIN)` y su gestion.
 */
@Controller('especialidades')
export class EspecialidadesController {
  constructor(private readonly service: EspecialidadesService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }
}
