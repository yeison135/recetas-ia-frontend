import { webSpeechError } from './voice';

describe('webSpeechError', () => {
  it('no avisa cuando no se dijo nada o se canceló', () => {
    expect(webSpeechError('no-speech')).toBeNull();
    expect(webSpeechError('aborted')).toBeNull();
  });

  it('explica la causa real en vez de un error genérico', () => {
    expect(webSpeechError('not-allowed')).toContain('permiso');
    expect(webSpeechError('audio-capture')).toContain('micrófono');
    expect(webSpeechError('network')).toMatch(/servicio de voz|dictado/);
  });
});
