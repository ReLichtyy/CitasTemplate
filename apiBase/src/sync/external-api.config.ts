import { registerAs } from '@nestjs/config';

export default registerAs('externalApi', () => ({
  baseUrl: process.env.EXTERNAL_API_BASE_URL ?? '',
  apiKey: process.env.EXTERNAL_API_KEY ?? '',
  timeoutMs: Number(process.env.EXTERNAL_API_TIMEOUT_MS ?? 10000),
  syncCron: process.env.EXTERNAL_API_SYNC_CRON ?? '*/15 * * * *',
}));
