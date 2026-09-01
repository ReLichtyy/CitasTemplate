import { Module } from '@nestjs/common';
import { EmpleadosController } from './empleados.controller.js';
import { EmpleadosService } from './empleados.service.js';

@Module({
  controllers: [EmpleadosController],
  providers: [EmpleadosService],
  exports: [EmpleadosService],
})
export class EmpleadosModule {}
