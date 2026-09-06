import {
  desplazamientoZonaMs,
  instanteDesdeZona,
  partesEnZona,
  seTraslapan,
  sumarMinutos,
} from './tiempo.js';

const f = (iso: string) => new Date(iso);

describe('seTraslapan', () => {
  it('no traslapa cuando los extremos solo se tocan', () => {
    // Una cita que termina 10:00 y otra que empieza 10:00 conviven. Ver spec/02.
    expect(
      seTraslapan(
        f('2026-09-07T09:00:00Z'),
        f('2026-09-07T10:00:00Z'),
        f('2026-09-07T10:00:00Z'),
        f('2026-09-07T11:00:00Z'),
      ),
    ).toBe(false);
  });

  it('traslapa cuando se solapan parcialmente, en cualquier orden', () => {
    const a: [Date, Date] = [
      f('2026-09-07T09:00:00Z'),
      f('2026-09-07T10:00:00Z'),
    ];
    const b: [Date, Date] = [
      f('2026-09-07T09:30:00Z'),
      f('2026-09-07T10:30:00Z'),
    ];
    expect(seTraslapan(...a, ...b)).toBe(true);
    expect(seTraslapan(...b, ...a)).toBe(true);
  });

  it('traslapa cuando uno contiene al otro', () => {
    expect(
      seTraslapan(
        f('2026-09-07T09:00:00Z'),
        f('2026-09-07T12:00:00Z'),
        f('2026-09-07T10:00:00Z'),
        f('2026-09-07T10:30:00Z'),
      ),
    ).toBe(true);
  });

  it('no traslapa cuando son disjuntos', () => {
    expect(
      seTraslapan(
        f('2026-09-07T09:00:00Z'),
        f('2026-09-07T10:00:00Z'),
        f('2026-09-07T14:00:00Z'),
        f('2026-09-07T15:00:00Z'),
      ),
    ).toBe(false);
  });
});

describe('partesEnZona', () => {
  const lunes1430Utc = f('2026-09-07T14:30:00.000Z');

  it('devuelve los minutos desde medianoche de la hora de pared', () => {
    expect(partesEnZona(lunes1430Utc, 'UTC').minutos).toBe(14 * 60 + 30);
    expect(partesEnZona(lunes1430Utc, 'America/Costa_Rica').minutos).toBe(
      8 * 60 + 30,
    );
  });

  it('cambia el dia de la semana cuando la zona cruza la medianoche', () => {
    // En Sydney ese instante ya es martes 00:30: si el dia se tomara de UTC, la
    // franja de atencion consultada seria la del dia equivocado.
    expect(partesEnZona(lunes1430Utc, 'UTC').diaSemana).toBe('LUNES');
    expect(partesEnZona(lunes1430Utc, 'Australia/Sydney').diaSemana).toBe(
      'MARTES',
    );
    expect(partesEnZona(lunes1430Utc, 'Australia/Sydney').minutos).toBe(30);
    expect(partesEnZona(lunes1430Utc, 'Australia/Sydney').dia).toBe(8);
  });
});

describe('instanteDesdeZona', () => {
  it('es la inversa de partesEnZona', () => {
    const zona = 'America/Costa_Rica';
    const instante = instanteDesdeZona(2026, 9, 7, 8 * 60 + 30, zona);
    expect(instante.toISOString()).toBe('2026-09-07T14:30:00.000Z');
    expect(partesEnZona(instante, zona).minutos).toBe(8 * 60 + 30);
  });

  it('usa el desplazamiento real a cada lado de un cambio de horario de verano', () => {
    const zona = 'America/New_York';
    // 01:00 sigue en EST (-5); 13:00 del mismo dia ya es EDT (-4).
    expect(instanteDesdeZona(2026, 3, 8, 60, zona).toISOString()).toBe(
      '2026-03-08T06:00:00.000Z',
    );
    expect(instanteDesdeZona(2026, 3, 8, 13 * 60, zona).toISOString()).toBe(
      '2026-03-08T17:00:00.000Z',
    );
  });

  it('normaliza el dia siguiente, que es como se calcula el fin del dia', () => {
    expect(instanteDesdeZona(2026, 9, 30 + 1, 0, 'UTC').toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });
});

describe('desplazamientoZonaMs', () => {
  it('es cero en UTC y negativo al oeste de Greenwich', () => {
    const instante = f('2026-09-07T14:30:00.000Z');
    expect(desplazamientoZonaMs(instante, 'UTC')).toBe(0);
    expect(desplazamientoZonaMs(instante, 'America/Costa_Rica')).toBe(
      -6 * 60 * 60 * 1000,
    );
  });
});

describe('sumarMinutos', () => {
  it('suma la duracion del servicio al inicio', () => {
    expect(sumarMinutos(f('2026-09-07T09:00:00Z'), 45).toISOString()).toBe(
      '2026-09-07T09:45:00.000Z',
    );
  });
});
