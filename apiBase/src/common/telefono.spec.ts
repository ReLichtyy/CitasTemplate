import { describe, expect, it } from 'vitest';
import {
  TELEFONO_REGEX,
  aE164,
  aTelefonoLocal,
  normalizarTelefono,
} from './telefono.js';

describe('normalizarTelefono', () => {
  it('deja un numero local de 8 digitos tal cual', () => {
    expect(normalizarTelefono('88887777')).toBe('88887777');
  });

  it('quita el prefijo 506 de un numero de 11 digitos', () => {
    expect(normalizarTelefono('50688887777')).toBe('88887777');
    expect(normalizarTelefono('+506 8888-7777')).toBe('88887777');
  });

  it('no toca un numero de 8 digitos aunque empiece en 50', () => {
    // "50612345" es un numero local, no un prefijo pegado a un numero de 5.
    expect(normalizarTelefono('50612345')).toBe('50612345');
  });

  it('se queda solo con los digitos', () => {
    expect(normalizarTelefono('8888 7777')).toBe('88887777');
    expect(normalizarTelefono('(8888) 7777')).toBe('88887777');
  });
});

describe('aTelefonoLocal (Transform del DTO)', () => {
  it('reduce a la forma canonica antes del match', () => {
    expect(aTelefonoLocal({ value: '50688887777' })).toBe('88887777');
    expect(aTelefonoLocal({ value: '+506 8888 7777' })).toBe('88887777');
    expect(aTelefonoLocal({ value: 88887777 })).toBe('88887777');
  });
});

describe('aE164', () => {
  it('antepon el prefijo del negocio a un numero guardado en forma local', () => {
    expect(aE164('88887777', '+506')).toBe('+50688887777');
  });

  it('tambien reconstruye un numero que llego con el prefijo todavia dentro', () => {
    expect(aE164('50688887777', '+506')).toBe('+50688887777');
    expect(aE164('+506 8888-7777', '+506')).toBe('+50688887777');
  });

  it('devuelve null sin prefijo configurado o con un numero que no es local', () => {
    expect(aE164('88887777', null)).toBeNull();
    expect(aE164('1234567', '+506')).toBeNull();
  });
});

describe('TELEFONO_REGEX', () => {
  it('solo acepta 8 digitos', () => {
    expect(TELEFONO_REGEX.test('88887777')).toBe(true);
    expect(TELEFONO_REGEX.test('50688887777')).toBe(false);
    expect(TELEFONO_REGEX.test('8888777')).toBe(false);
    expect(TELEFONO_REGEX.test('888877777')).toBe(false);
  });
});
