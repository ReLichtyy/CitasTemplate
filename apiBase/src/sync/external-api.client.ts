import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ExternalApiClient {
  private readonly logger = new Logger(ExternalApiClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('externalApi.baseUrl') ?? '';
  }

  private get authHeaders() {
    const apiKey = this.config.get<string>('externalApi.apiKey');
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await firstValueFrom(
      this.http.get<T>(`${this.baseUrl}${path}`, {
        headers: this.authHeaders,
        params,
        timeout: this.config.get<number>('externalApi.timeoutMs'),
      }),
    );
    return response.data;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await firstValueFrom(
      this.http.post<T>(`${this.baseUrl}${path}`, body, {
        headers: this.authHeaders,
        timeout: this.config.get<number>('externalApi.timeoutMs'),
      }),
    );
    return response.data;
  }
}
