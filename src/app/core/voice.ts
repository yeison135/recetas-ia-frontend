import { Injectable, signal } from '@angular/core';

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

/**
 * Voz con las capacidades del navegador: dictado (reconocimiento en es-CO) y lectura en voz alta.
 * Es el modo de voz básico y gratuito; la opción de voz en tiempo real queda por decidir (DECISIONES.md).
 */
@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly listening = signal(false);
  readonly speaking = signal(false);
  readonly interim = signal('');

  private recognition: SpeechRecognitionLike | null = null;

  readonly canListen =
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  readonly canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  /** Escucha una frase y la entrega al terminar. */
  listen(onFinal: (text: string) => void, onError?: (message: string) => void): void {
    if (!this.canListen || this.listening()) return;
    this.stopSpeaking();
    const Ctor = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionLike; // eslint-disable-line @typescript-eslint/no-explicit-any
    const rec = new Ctor();
    rec.lang = 'es-CO';
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
      if (e.error === 'not-allowed') onError?.('Necesito permiso para usar el micrófono.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') onError?.('No te escuché bien, intenta otra vez.');
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

  stopListening(): void {
    this.recognition?.stop();
  }

  speak(text: string): void {
    if (!this.canSpeak || !text) return;
    this.stopSpeaking();
    const u = new SpeechSynthesisUtterance(text.replace(/\n+/g, '. '));
    u.lang = 'es-CO';
    const voice =
      speechSynthesis.getVoices().find((v) => v.lang === 'es-CO') ??
      speechSynthesis.getVoices().find((v) => v.lang.startsWith('es-'));
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.onstart = () => this.speaking.set(true);
    u.onend = () => this.speaking.set(false);
    u.onerror = () => this.speaking.set(false);
    speechSynthesis.speak(u);
  }

  stopSpeaking(): void {
    if (this.canSpeak) speechSynthesis.cancel();
    this.speaking.set(false);
  }
}
