import { telefonoDeChatId } from './waha.types.js';

describe('telefonoDeChatId', () => {
  it('un chatId de telefono local se traduce a las dos formas', () => {
    expect(telefonoDeChatId('50688887777@c.us')).toEqual({
      telefono: '88887777',
      destino: '+50688887777',
    });
  });

  it('un LID de NOWEB no se resuelve: es el caso que cae a remoteJidAlt', () => {
    expect(telefonoDeChatId('189494678536298@lid')).toBeNull();
  });

  it('un numero de otro pais no normaliza a la forma local', () => {
    expect(telefonoDeChatId('15551234567@c.us')).toBeNull();
  });

  it('cualquier otra direccion o ausencia no es nadie', () => {
    expect(telefonoDeChatId('1234-5678@g.us')).toBeNull();
    expect(telefonoDeChatId('')).toBeNull();
    expect(telefonoDeChatId(undefined)).toBeNull();
  });
});
