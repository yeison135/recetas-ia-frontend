import { parseEvent } from './chat-stream';

describe('parseEvent', () => {
  it('lee el tipo y el JSON de un evento SSE', () => {
    expect(parseEvent('event:text\ndata:{"text":"hola"}')).toEqual({ type: 'text', data: { text: 'hola' } });
  });

  it('ignora eventos sin datos o con JSON inválido', () => {
    expect(parseEvent('event:ping')).toBeNull();
    expect(parseEvent('event:text\ndata:{no es json')).toBeNull();
  });
});
