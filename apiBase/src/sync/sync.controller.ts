import { Controller, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { SyncService } from './sync.service.js';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Roles(Role.ADMIN)
  @Post()
  trigger() {
    return this.syncService.runSync();
  }
}
