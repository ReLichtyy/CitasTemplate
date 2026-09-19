import { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import { AxiosError, type AxiosResponse } from 'axios';
import { of, throwError, type Observable } from 'rxjs';
import type { TipoNotificacion } from '../../generated/prisma/client.js';
import {
  CanalNoDisponibleError,
  EnvioPermanenteError,
} from '../../notificaciones/whatsapp.gateway.js';
import { WahaClient } from './waha.client.js';

/**
 * Solo `WahaClient`: el worker ya tiene su spec contra un gateway de mentira, y lo que
 * aqui se protege es lo que el adaptador decide solo —el reintento sin imagen y la
 * clasificacion de una sesion inexistente—, que es donde un aviso puede morir con el
 * numero en linea y nadie enterarse. Ver 09-conexion-whatsapp.md.
 */

const CONFIG: Record<string, unknown> = {
  'waha.url': 'http://waha:3000',
  'waha.apiKey': 'clave',
  'waha.session': 'sesion',
  'waha.timeoutMs': 1000,
};

const VARIABLES = {
  nombre: 'Marta',
  negocio: 'El Negocio',
  servicio: 'Corte',
  profesional: 'Ana',
  fecha: 'viernes',
  enlace: 'https://app/citas/confirmar/abc',
};

function rechazoHttp(estado: number): Observable<never> {
  const error = new AxiosError(`HTTP ${estado}`);
  error.response = { status: estado } as AxiosResponse;
  return throwError(() => error);
}

function crearCliente(
  get: ReturnType<typeof vi.fn>,
  post: ReturnType<typeof vi.fn>,
) {
  const config = { get: (clave: string) => CONFIG[clave] };
  return {
    cliente: new WahaClient(
      { get, post } as unknown as HttpService,
      config as unknown as ConfigService,
    ),
    post,
  };
}

function sesionOperativa(get: ReturnType<typeof vi.fn>) {
  get.mockReturnValue(of({ data: { status: 'WORKING' } }));
}

describe('WahaClient', () => {
  it('envia texto solo cuando el aviso no lleva imagen', async () => {
    const get = vi.fn();
    const post = vi.fn().mockReturnValue(of({ data: { key: { id: 'wa-9' } } }));
    sesionOperativa(get);
    const { cliente } = crearCliente(get, post);

    const resultado = await cliente.enviar(
      '+50688880001',
      'RECORDATORIO_CITA' as TipoNotificacion,
      VARIABLES,
    );

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('http://waha:3000/api/sendText');
    expect(post.mock.calls[0][1]).toMatchObject({
      session: 'sesion',
      chatId: '50688880001@c.us',
    });
    expect(resultado.idExterno).toBe('wa-9');
  });

  it('confirma con imagen cuando el canal la acepta', async () => {
    const get = vi.fn();
    const post = vi.fn().mockReturnValue(of({ data: { key: { id: 'wa-1' } } }));
    sesionOperativa(get);
    const { cliente } = crearCliente(get, post);

    const resultado = await cliente.enviar(
      '+50688880001',
      'CONFIRMACION_CITA' as TipoNotificacion,
      VARIABLES,
    );

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('http://waha:3000/api/sendImage');
    expect(resultado.idExterno).toBe('wa-1');
  });

  /**
   * La imagen es cortesia; el aviso es el texto con el enlace. NOWEB falla la subida
   * de medios de vez en cuando, y un aviso que muere porque fallo la decoracion es
   * exactamente lo que este cliente no puede permitirse.
   */
  it('reenvia solo texto cuando el canal rechaza la imagen', async () => {
    const get = vi.fn();
    const post = vi
      .fn()
      .mockReturnValueOnce(rechazoHttp(422))
      .mockReturnValue(of({ data: { key: { id: 'wa-2' } } }));
    sesionOperativa(get);
    const { cliente } = crearCliente(get, post);

    const resultado = await cliente.enviar(
      '+50688880001',
      'CONFIRMACION_CITA' as TipoNotificacion,
      VARIABLES,
    );

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0]).toBe('http://waha:3000/api/sendImage');
    expect(post.mock.calls[1][0]).toBe('http://waha:3000/api/sendText');
    expect(post.mock.calls[1][1]).toMatchObject({ chatId: '50688880001@c.us' });
    expect(resultado.idExterno).toBe('wa-2');
  });

  it('traduce el fallo cuando tambien el texto falla', async () => {
    const get = vi.fn();
    const post = vi
      .fn()
      .mockReturnValueOnce(rechazoHttp(500))
      .mockReturnValue(rechazoHttp(400));
    sesionOperativa(get);
    const { cliente } = crearCliente(get, post);

    await expect(
      cliente.enviar(
        '+50688880001',
        'CONFIRMACION_CITA' as TipoNotificacion,
        VARIABLES,
      ),
    ).rejects.toThrow(EnvioPermanenteError);
  });

  /**
   * Una sesion inexistente es un problema del despliegue, no del mensaje: como rechazo
   * permanente mataba la fila al instante —FALLIDA no se reintenta— y el aviso no
   * salia ni despues de corregir WAHA_SESSION. Como canal caido reintenta hasta 24 h.
   */
  it('trata una sesion inexistente como canal caido y no como rechazo del mensaje', async () => {
    const get = vi.fn().mockReturnValue(rechazoHttp(404));
    const post = vi.fn();
    const { cliente } = crearCliente(get, post);

    await expect(
      cliente.enviar(
        '+50688880001',
        'CONFIRMACION_CITA' as TipoNotificacion,
        VARIABLES,
      ),
    ).rejects.toThrow(CanalNoDisponibleError);

    expect(post).not.toHaveBeenCalled();
  });

  it('rechaza de una vez un destino sin forma internacional', async () => {
    const get = vi.fn();
    const post = vi.fn();
    const { cliente } = crearCliente(get, post);

    await expect(
      cliente.enviar(
        '88887777',
        'CONFIRMACION_CITA' as TipoNotificacion,
        VARIABLES,
      ),
    ).rejects.toThrow(EnvioPermanenteError);

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
