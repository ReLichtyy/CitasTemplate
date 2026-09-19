import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Solo `actualizarPerfil`: el opt-in con sesion es lo que permite al cliente con cuenta
 * recibir avisos — sin este camino, `PATCH /auth/me` ignoraba `aceptaWhatsapp` y el
 * outbox nunca tenia con que contar. Ver 09-conexion-whatsapp.md.
 */

const FICHA = {
  id: 'usr-1',
  telefono: '88887777',
  nombre: 'Ana',
  apellido: null,
  email: null,
  rol: 'CLIENTE',
  aceptaWhatsapp: false,
};

function crearService(update: ReturnType<typeof vi.fn>) {
  const prisma = { usuario: { update } };
  const jwt = { signAsync: vi.fn() };
  return new AuthService(
    jwt as unknown as JwtService,
    prisma as unknown as PrismaService,
  );
}

describe('AuthService.actualizarPerfil', () => {
  it('no toca el opt-in cuando el campo no viene', async () => {
    const update = vi.fn().mockResolvedValue(FICHA);
    const service = crearService(update);

    await service.actualizarPerfil('usr-1', { nombre: 'Ana Maria' });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ aceptaWhatsapp: expect.anything() }),
      }),
    );
  });

  it('enciende el opt-in sellando la fecha del consentimiento', async () => {
    const cuando = new Date('2026-01-15T15:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(cuando);
    const update = vi.fn().mockResolvedValue({ ...FICHA, aceptaWhatsapp: true });
    const service = crearService(update);

    await service.actualizarPerfil('usr-1', { aceptaWhatsapp: true });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aceptaWhatsapp: true,
          aceptaWhatsappEn: cuando,
        }),
      }),
    );
    vi.useRealTimers();
  });

  it('apagar el opt-in borra la fecha, igual que al crear la ficha', async () => {
    const update = vi.fn().mockResolvedValue(FICHA);
    const service = crearService(update);

    await service.actualizarPerfil('usr-1', { aceptaWhatsapp: false });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ aceptaWhatsapp: false, aceptaWhatsappEn: null }),
      }),
    );
  });

  it('devuelve la ficha con el opt-in: es lo que el perfil pinta', async () => {
    const update = vi.fn().mockResolvedValue({ ...FICHA, aceptaWhatsapp: true });
    const service = crearService(update);

    const ficha = await service.actualizarPerfil('usr-1', { aceptaWhatsapp: true });

    expect(ficha.aceptaWhatsapp).toBe(true);
  });
});
