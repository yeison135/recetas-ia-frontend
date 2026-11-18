import { Injectable, signal } from '@angular/core';

import { IS_NATIVE } from './config';

/* Tipos mínimos de la Web Speech API (no están en lib.dom de TypeScript). */
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

const LANG = 'es-CO';

/** Brave expone la Web Speech API pero bloquea el servicio de reconocimiento de Google. */
const IS_BRAVE = typeof navigator !== 'undefined' && 'brave' in navigator;

const NO_DICTATION =
  'Tu navegador no permite el dictado por voz. Prueba en Chrome o Edge, o escribe tu pregunta. ' +
  'La lectura en voz alta de las respuestas sí funciona.';

export interface ListenResult {
  text?: string;
  silent?: boolean;
  error?: string;
}

/** Texto apto para leer en voz alta: sin viñetas, sin "Aviso:" duplicado de formato, sin emojis. */
export function forSpeech(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/^\s*[-*•]\s*/gm, '')
    .replace(/\n+/g, '. ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

/** Divide en frases cortas para la síntesis web (Chrome corta locuciones largas). */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?¿¡]+[.!?]*|[¿¡][^?!]+[?!]/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/** Mensaje para cada error de la Web Speech API; null si no hay que avisar (silencio, cancelado). */
export function webSpeechError(error: string): string | null {
  switch (error) {
    case 'aborted':
      return null;
    case 'no-speech':
      // Edge/Chrome escuchan el micrófono predeterminado del sistema: si está silenciado o es otro, llega aquí.
      return 'No te escuché. Revisa que el micrófono predeterminado de tu equipo esté activo y habla cerca de él.';
    case 'not-allowed':
      return 'Necesito permiso para usar el micrófono. Revisa el ícono del candado en la barra de direcciones.';
    case 'audio-capture':
      return 'No encontré un micrófono conectado.';
    case 'network':
    case 'service-not-allowed':
      // En Brave el servicio de Google está bloqueado y falla con 'network' aunque haya internet.
      return IS_BRAVE ? NO_DICTATION : 'No pude conectar con el servicio de voz. Revisa tu conexión o escribe tu pregunta.';
    case 'language-not-supported':
      return 'Tu navegador no reconoce voz en español de Colombia.';
    default:
      return 'No te escuché bien, intenta otra vez.';
  }
}

/**
 * Voz del dispositivo (decisión provisional, ver DECISIONES.md):
 * - Web: Web Speech API del navegador (dictado y lectura en voz alta).
 * - App Android: plugins nativos de Capacitor (reconocimiento y TTS del sistema), porque el
 *   WebView de Android no trae la Web Speech API.
 * Sin claves ni servidor de voz. La voz en tiempo real queda para más adelante.
 */
@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly listening = signal(false);
  readonly speaking = signal(false);
  readonly interim = signal('');

  private recognition: SpeechRecognitionLike | null = null;

  readonly canListen =
    IS_NATIVE ||
    (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window));
  readonly canSpeak = IS_NATIVE || (typeof window !== 'undefined' && 'speechSynthesis' in window);

  /**
   * Escucha una frase. `onFinal` recibe el texto; `onError` un mensaje y el código del error;
   * `onEnd` se llama siempre al terminar (haya o no texto).
   */
  listen(onFinal: (text: string) => void, onError?: (message: string, code: string) => void, onEnd?: () => void): void {
    if (!this.canListen || this.listening()) {
      onEnd?.();
      return;
    }
    this.stopSpeaking();
    if (IS_NATIVE) {
      void this.listenNative(onFinal, onError).finally(() => onEnd?.());
    } else {
      void this.listenWebChecked(onFinal, onError, onEnd);
    }
  }

  /**
   * Una sola frase, como promesa: texto, silencio (no habló) o error con mensaje.
   * Se resuelve solo cuando el reconocimiento terminó del todo: el error llega antes del fin, y volver
   * a escuchar en ese momento encontraría el micrófono aún ocupado.
   */
  listenOnce(): Promise<ListenResult> {
    return new Promise((resolve) => {
      let result: ListenResult = { silent: true };
      this.listen(
        (text) => (result = { text }),
        (message, code) => (result = code === 'no-speech' ? { silent: true } : { error: message }),
        () => resolve(result),
      );
    });
  }

  /** Antes del dictado web se comprueba que haya micrófono y permiso, para dar un error claro. */
  private async listenWebChecked(onFinal: (text: string) => void, onError?: (message: string, code: string) => void,
                                 onEnd?: () => void): Promise<void> {
    if (!this.micChecked && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        this.micChecked = true;
      } catch (e) {
        const code = e instanceof DOMException && e.name === 'NotFoundError' ? 'audio-capture' : 'not-allowed';
        onError?.(webSpeechError(code) ?? '', code);
        onEnd?.();
        return;
      }
    }
    this.listenWeb(onFinal, onError, onEnd);
  }

  stopListening(): void {
    if (IS_NATIVE) {
      void import('@capacitor-community/speech-recognition')
        .then(({ SpeechRecognition }) => SpeechRecognition.stop())
        .catch(() => undefined);
      this.listening.set(false);
      return;
    }
    this.recognition?.stop();
  }

  /** Lee el texto en voz alta; la promesa se cumple al terminar (o al interrumpirlo). */
  async speak(text: string): Promise<void> {
    if (!this.canSpeak || !text) return;
    this.stopSpeaking();
    const clean = forSpeech(text);
    if (IS_NATIVE) {
      await this.speakNative(clean);
      return;
    }
    // Frase por frase: Chrome corta las locuciones largas y así también se puede interrumpir.
    const token = ++this.speechToken;
    this.speaking.set(true);
    try {
      for (const sentence of sentences(clean)) {
        if (token !== this.speechToken) return;
        await this.speakWebSentence(sentence);
      }
    } finally {
      if (token === this.speechToken) this.speaking.set(false);
    }
  }

  private speechToken = 0;
  /** El micrófono ya se comprobó (permiso y dispositivo): no repetirlo en cada turno. */
  private micChecked = false;

  private speakWebSentence(sentence: string): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = LANG;
      const voices = speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang === LANG) ?? voices.find((v) => v.lang.startsWith('es-'));
      if (voice) u.voice = voice;
      u.rate = 1.05;
      // Respaldo: algunos navegadores no disparan onend; se estima la duración de la frase.
      const fallback = setTimeout(resolve, 2000 + sentence.length * 90);
      u.onend = () => { clearTimeout(fallback); resolve(); };
      u.onerror = () => { clearTimeout(fallback); resolve(); };
      speechSynthesis.speak(u);
    });
  }

  stopSpeaking(): void {
    this.speechToken++;
    if (IS_NATIVE) {
      void import('@capacitor-community/text-to-speech')
        .then(({ TextToSpeech }) => TextToSpeech.stop())
        .catch(() => undefined);
    } else if (this.canSpeak) {
      speechSynthesis.cancel();
    }
    this.speaking.set(false);
  }

  // ---------------------------------------------------------------- nativo (Android)

  private async listenNative(onFinal: (text: string) => void, onError?: (message: string, code: string) => void): Promise<void> {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      const { available } = await SpeechRecognition.available();
      if (!available) {
        onError?.('Este teléfono no tiene reconocimiento de voz disponible.', 'unavailable');
        return;
      }
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        onError?.('Necesito permiso para usar el micrófono.', 'not-allowed');
        return;
      }
      this.listening.set(true);
      const { matches } = await SpeechRecognition.start({
        language: LANG,
        maxResults: 1,
        partialResults: false,
        popup: false,
      });
      const text = matches?.[0]?.trim();
      if (text) onFinal(text);
    } catch {
      // El reconocedor de Android lanza error cuando no oye nada: se trata como silencio.
      onError?.('No te escuché bien, intenta otra vez.', 'no-speech');
    } finally {
      this.listening.set(false);
    }
  }

  private async speakNative(text: string): Promise<void> {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      this.speaking.set(true);
      await TextToSpeech.speak({ text, lang: LANG, rate: 1.0 });
    } catch {
      // Sin voz disponible: la respuesta igual queda escrita en pantalla.
    } finally {
      this.speaking.set(false);
    }
  }

  // ---------------------------------------------------------------- web

  private listenWeb(onFinal: (text: string) => void, onError?: (message: string, code: string) => void,
                    onEnd?: () => void): void {
    const Ctor = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionLike; // eslint-disable-line @typescript-eslint/no-explicit-any
    const rec = new Ctor();
    rec.lang = LANG;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      this.interim.set(interim || finalText);
    };
    rec.onerror = (e) => {
      const message = webSpeechError(e.error);
      if (message) onError?.(message, e.error);
    };
    rec.onend = () => {
      this.listening.set(false);
      this.interim.set('');
      this.recognition = null;
      if (finalText.trim()) onFinal(finalText.trim());
      onEnd?.();
    };
    this.recognition = rec;
    this.listening.set(true);
    rec.start();
  }
}
