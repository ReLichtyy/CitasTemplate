import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import externalApiConfig from './external-api.config.js';
import { ExternalApiClient } from './external-api.client.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [ConfigModule.forFeature(externalApiConfig), HttpModule],
  controllers: [SyncController],
  providers: [ExternalApiClient, SyncService],
  exports: [ExternalApiClient, SyncService],
})
export class SyncModule {}
