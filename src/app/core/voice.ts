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

/** Mensaje para cada error de la Web Speech API; null si no hay que avisar (silencio, cancelado). */
export function webSpeechError(error: string): string | null {
  switch (error) {
    case 'no-speech':
    case 'aborted':
      return null;
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

  /** Escucha una frase y la entrega al terminar. */
  listen(onFinal: (text: string) => void, onError?: (message: string) => void): void {
    if (!this.canListen || this.listening()) return;
    this.stopSpeaking();
    if (IS_NATIVE) {
      void this.listenNative(onFinal, onError);
    } else {
      this.listenWeb(onFinal, onError);
    }
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

  speak(text: string): void {
    if (!this.canSpeak || !text) return;
    this.stopSpeaking();
    const clean = text.replace(/\n+/g, '. ');
    if (IS_NATIVE) {
      void this.speakNative(clean);
      return;
    }
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = LANG;
    const voice =
      speechSynthesis.getVoices().find((v) => v.lang === LANG) ??
      speechSynthesis.getVoices().find((v) => v.lang.startsWith('es-'));
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.onstart = () => this.speaking.set(true);
    u.onend = () => this.speaking.set(false);
    u.onerror = () => this.speaking.set(false);
    speechSynthesis.speak(u);
  }

  stopSpeaking(): void {
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

  private async listenNative(onFinal: (text: string) => void, onError?: (message: string) => void): Promise<void> {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      const { available } = await SpeechRecognition.available();
      if (!available) {
        onError?.('Este teléfono no tiene reconocimiento de voz disponible.');
        return;
      }
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        onError?.('Necesito permiso para usar el micrófono.');
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
      onError?.('No te escuché bien, intenta otra vez.');
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

  private listenWeb(onFinal: (text: string) => void, onError?: (message: string) => void): void {
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
      if (message) onError?.(message);
    };
    rec.onend = () => {
      this.listening.set(false);
      this.interim.set('');
      this.recognition = null;
      if (finalText.trim()) onFinal(finalText.trim());
    };
    this.recognition = rec;
    this.listening.set(true);
    rec.start();
  }
}
