import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExternalApiClient } from './external-api.client.js';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly externalApi: ExternalApiClient) {}

  // Placeholder cron: define real endpoint/payload once the external API contract is set.
  @Cron(CronExpression.EVERY_HOUR, { name: 'external-api-sync', disabled: true })
  async scheduledSync(): Promise<void> {
    await this.runSync();
  }

  async runSync(): Promise<{ synced: boolean }> {
    this.logger.log('Sync triggered');
    // TODO: replace with real external API endpoint + mapping once contract is defined.
    // const data = await this.externalApi.get('/some-endpoint');
    return { synced: true };
  }
}
