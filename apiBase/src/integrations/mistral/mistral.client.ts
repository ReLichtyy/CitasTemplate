import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  AsistenteChat,
  AsistenteNoDisponibleError,
  type RespuestaAsistente,
} from '../../chatbot/asistente.port.js';
import type { MensajeDeChat } from '../../chatbot/flujo-reserva.js';

/**
 * Adaptador de la API de Mistral sobre el puerto `AsistenteChat`. Es la unica
 * clase del backend que sabe que del otro lado hay Mistral: cambiar de proveedor
 * es otro adaptador al lado de este archivo y el chatbot no se entera. Misma
 * frontera que `WahaClient` con WAHA.
 *
 * El contrato JSON lo impone `response_format`: el modelo no puede contestar nada
 * que no sea el objeto, y lo que llegue igual se valida en el parseo.
 */
@Injectable()
export class MistralClient extends AsistenteChat {
  private readonly logger = new Logger(MistralClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async conversar(
    instrucciones: string,
    historial: MensajeDeChat[],
  ): Promise<RespuestaAsistente> {
    const url = this.config.get<string>('mistral.url');
    const apiKey = this.config.get<string>('mistral.apiKey');
    const model = this.config.get<string>('mistral.model');
    if (!url || !apiKey) {
      throw new AsistenteNoDisponibleError('Mistral no esta configurado (LLM_API_KEY).');
    }

    let respuesta: { data: RespuestaChat };
    try {
      respuesta = await firstValueFrom(
        this.http.post<RespuestaChat>(
          `${url}/chat/completions`,
          {
            model,
            temperature: 0.2,
            messages: [
              { role: 'system', content: instrucciones },
              ...historial.map((turno) => ({
                role: turno.rol === 'usuario' ? 'user' : 'assistant',
                content: turno.texto,
              })),
            ],
            response_format: { type: 'json_object' },
          },
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: this.config.get<number>('mistral.timeoutMs'),
          },
        ),
      );
    } catch (error) {
      throw this.traducir(error);
    }

    const texto = respuesta.data.choices?.[0]?.message?.content;
    const parseada = this.parsear(texto);
    if (!parseada) {
      throw new AsistenteNoDisponibleError('Mistral no devolvio el JSON del contrato.');
    }
    return parseada;
  }

  /**
   * El contrato es de un objeto plano; el modelo a veces envuelve o agrega prosa
   * alrededor, y la respuesta truncada por el tope de tokens llega cortada. Todo
   * eso es lo mismo: un turno que no se puede usar, y el cliente reintenta con su
   * proximo mensaje.
   */
  private parsear(texto: string | undefined): RespuestaAsistente | null {
    if (typeof texto !== 'string' || texto.trim() === '') {
      return null;
    }
    try {
      const valor = JSON.parse(texto) as RespuestaAsistente;
      if (typeof valor.respuesta !== 'string' || valor.respuesta.trim() === '') {
        return null;
      }
      return valor;
    } catch {
      this.logger.warn('La respuesta del modelo no era JSON utilizable; se descarta.');
      return null;
    }
  }

  /**
   * Misma traduccion que `WahaClient`: 401/429 y los 5xx son del proveedor entero,
   * no de este turno, y ninguno gasta nada — el error se registra y la conversacion
   * se retoma sola con el proximo mensaje del cliente.
   */
  private traducir(error: unknown): Error {
    if (!(error instanceof AxiosError)) {
      return new AsistenteNoDisponibleError(
        error instanceof Error ? error.message : String(error),
      );
    }
    return new AsistenteNoDisponibleError(
      `Mistral respondio ${error.response?.status ?? error.code ?? 'sin estado'}: ${error.message}`,
    );
  }
}

/** Forma minima de la respuesta de `/chat/completions` que este adaptador lee. */
interface RespuestaChat {
  choices?: { message?: { content?: string } }[];
}
