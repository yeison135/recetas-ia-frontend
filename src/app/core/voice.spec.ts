import { forSpeech, sentences, webSpeechError } from './voice';

describe('webSpeechError', () => {
  it('no avisa cuando se canceló', () => {
    expect(webSpeechError('aborted')).toBeNull();
  });

  it('avisa cuando no detectó voz (antes fallaba en silencio)', () => {
    expect(webSpeechError('no-speech')).toContain('micrófono');
  });

  it('explica la causa real en vez de un error genérico', () => {
    expect(webSpeechError('not-allowed')).toContain('permiso');
    expect(webSpeechError('audio-capture')).toContain('micrófono');
    expect(webSpeechError('network')).toMatch(/servicio de voz|dictado/);
  });
});

describe('texto para voz', () => {
  it('quita viñetas y emojis y une líneas', () => {
    expect(forSpeech('Necesitas:\n- papa criolla\n- pollo 🎉')).toBe('Necesitas:. papa criolla. pollo');
  });

  it('divide en frases, incluidas las preguntas con ¿?', () => {
    expect(sentences('Listo. Te armé la lista. ¿Empezamos a cocinar?')).toEqual([
      'Listo.',
      'Te armé la lista.',
      '¿Empezamos a cocinar?',
    ]);
  });
});
