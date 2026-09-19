import type { ConfigService } from '@nestjs/config';
import type { CatalogoService } from '../catalogo/catalogo.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { OutboxService, type DatosAviso } from './outbox.service.js';
import type { ConfirmacionService } from './confirmacion.service.js';
import type { NotificacionesWorker } from './notificaciones.worker.js';

/**
 * Lo que el outbox decide solo y nadie mas puede verificar por el: el "select" de la
 * confirmacion por enlace y el aviso al administrador. El worker ya tiene su spec, y
 * `CitasService` ya comprueba que le pasa los datos y el `tx` a estos metodos.
 */

const CITA: DatosAviso = {
  id: 'cita-1',
  inicio: new Date('2026-09-25T15:00:00Z'),
  cliente: { nombre: 'Marta', apellido: 'Lopez', telefono: '88880001' },
  servicio: { nombre: 'Corte' },
  empleado: { usuario: { nombre: 'Ana', apellido: null } },
};

function crearOutbox(
  negocio: Record<string, unknown> = {
    nombre: 'El Negocio',
    zonaHoraria: 'UTC',
    locale: 'es',
    prefijoPais: '+506',
    confirmacionPorEnlace: true,
    telefonoAdmin: '60255433',
  },
) {
  const config = {
    get: (clave: string) =>
      ({ 'notificaciones.urlPublica': 'https://app.example' }[clave]),
  };
  const confirmacion = { emitirToken: vi.fn().mockResolvedValue('token-claro') };
  const outbox = new OutboxService(
    config as unknown as ConfigService,
    confirmacion as unknown as ConfirmacionService,
    { negocio: vi.fn().mockResolvedValue(negocio) } as unknown as CatalogoService,
    { despertar: vi.fn() } as unknown as NotificacionesWorker,
  );
  return { outbox, confirmacion };
}

describe('OutboxService.encolarConfirmacion', () => {
  it('emite el token y arma el enlace cuando el negocio activo la confirmacion', async () => {
    const { outbox, confirmacion } = crearOutbox();
    const tx = { notificacionSalida: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    await outbox.encolarConfirmacion(
      tx as unknown as Prisma.TransactionClient,
      CITA,
    );

    expect(confirmacion.emitirToken).toHaveBeenCalledTimes(1);
    const { data } = tx.notificacionSalida.createMany.mock.calls[0][0];
    expect(data[0].variables.enlace).toBe(
      'https://app.example/citas/confirmar/token-claro',
    );
    expect(data[0].destino).toBe('+50688880001');
  });

  /**
   * El "select" desactivado: el aviso sale igual —la reserva se avisa siempre— pero
   * sin token y sin enlace. La base no guarda ningun hash que nadie pueda canjear.
   */
  it('no emite token ni enlace cuando el negocio desactivo la confirmacion', async () => {
    const { outbox, confirmacion } = crearOutbox({
      nombre: 'El Negocio',
      prefijoPais: '+506',
      confirmacionPorEnlace: false,
    });
    const tx = { notificacionSalida: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    const encolada = await outbox.encolarConfirmacion(
      tx as unknown as Prisma.TransactionClient,
      CITA,
    );

    expect(confirmacion.emitirToken).not.toHaveBeenCalled();
    expect(encolada).toBe(true);
    const { data } = tx.notificacionSalida.createMany.mock.calls[0][0];
    expect(data[0].variables.enlace).toBe('');
  });

  it('no encola nada cuando el telefono no tiene forma internacional', async () => {
    const { outbox, confirmacion } = crearOutbox({ prefijoPais: null });
    const tx = { notificacionSalida: { createMany: vi.fn() } };

    const encolada = await outbox.encolarConfirmacion(
      tx as unknown as Prisma.TransactionClient,
      CITA,
    );

    expect(encolada).toBe(false);
    expect(tx.notificacionSalida.createMany).not.toHaveBeenCalled();
    expect(confirmacion.emitirToken).not.toHaveBeenCalled();
  });
});

describe('OutboxService.encolarAvisoReserva', () => {
  it('encola el aviso al administrador con la misma fecha y profesionales', async () => {
    const { outbox } = crearOutbox();
    const tx = { notificacionSalida: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    const encolada = await outbox.encolarAvisoReserva(
      tx as unknown as Prisma.TransactionClient,
      CITA,
    );

    expect(encolada).toBe(true);
    const { data } = tx.notificacionSalida.createMany.mock.calls[0][0];
    expect(data[0].tipo).toBe('AVISO_RESERVA_CITA');
    // El destino del admin es otro: el mismo prefijo, su propio telefono.
    expect(data[0].destino).toBe('+50660255433');
    expect(data[0].variables).toMatchObject({
      nombre: 'Marta Lopez',
      profesional: 'Ana',
      servicio: 'Corte',
    });
  });

  it('no encola nada sin telefono de administrador configurado', async () => {
    const { outbox } = crearOutbox({ prefijoPais: '+506', telefonoAdmin: null });
    const tx = { notificacionSalida: { createMany: vi.fn() } };

    const encolada = await outbox.encolarAvisoReserva(
      tx as unknown as Prisma.TransactionClient,
      CITA,
    );

    expect(encolada).toBe(false);
    expect(tx.notificacionSalida.createMany).not.toHaveBeenCalled();
  });
});
