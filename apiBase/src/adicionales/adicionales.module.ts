import { Module } from '@nestjs/common';
import { AdicionalesController } from './adicionales.controller.js';
import { AdicionalesService } from './adicionales.service.js';

@Module({
  controllers: [AdicionalesController],
  providers: [AdicionalesService],
  exports: [AdicionalesService],
})
export class AdicionalesModule {}
