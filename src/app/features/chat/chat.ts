import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { ChatStream, ChatStreamEvent } from '../../core/chat-stream';
import { CookingTimer, ShoppingList } from '../../core/models';
import { TimerStore, formatSeconds } from '../../core/timers';
import { VoiceService } from '../../core/voice';
import { Face, FaceState } from './face';

interface Bubble {
  role: 'user' | 'assistant' | 'event';
  text?: string;
  recipe?: { slug: string; title: string; servings: number };
  timer?: CookingTimer;
  list?: ShoppingList;
  error?: boolean;
}

const CONVERSATION_KEY = 'sazon.conversation';

@Component({
  selector: 'app-chat',
  imports: [FormsModule, RouterLink, Face],
  template: `
    <div class="page chat">
      <header class="hero">
        <app-face [state]="faceState()" />
        <p class="status muted" aria-live="polite">{{ statusText() }}</p>
      </header>

      <section class="messages" aria-live="polite" aria-label="Conversación">
        @if (!bubbles().length) {
          <div class="empty">
            <p>¡Hola! ¿Qué cocinamos hoy? Puedes escribirme o hablarme.</p>
            <div class="suggestions">
              @for (s of suggestions; track s) {
                <button type="button" class="chip-btn" (click)="send(s)">{{ s }}</button>
              }
            </div>
          </div>
        }
        @for (b of bubbles(); track $index) {
          @switch (b.role) {
            @case ('user') { <div class="bubble user">{{ b.text }}</div> }
            @case ('assistant') { <div class="bubble assistant" [class.error]="b.error">{{ b.text }}</div> }
            @case ('event') {
              @if (b.recipe) {
                <a class="event" [routerLink]="['/recetas', b.recipe.slug]" [queryParams]="{ porciones: b.recipe.servings }">
                  📖 <strong>{{ b.recipe.title }}</strong> · {{ b.recipe.servings }} porciones <span class="go">Ver receta →</span>
                </a>
              }
              @if (b.timer) {
                <div class="event">⏱️ Temporizador <strong>{{ b.timer.label }}</strong> · {{ format(b.timer.durationSeconds) }}</div>
              }
              @if (b.list) {
                <a class="event" routerLink="/mercado">🧺 <strong>{{ b.list.title }}</strong> · {{ b.list.items.length }} productos <span class="go">Abrir →</span></a>
              }
            }
          }
        }
        @if (thinking()) {
          <div class="bubble assistant typing" aria-label="Escribiendo"><span></span><span></span><span></span></div>
        }
      </section>

      <form class="composer" (ngSubmit)="send(draft)">
        @if (voice.canListen) {
          <button type="button" class="mic" [class.on]="voice.listening()" (click)="toggleMic()"
            [attr.aria-label]="voice.listening() ? 'Dejar de escuchar' : 'Hablar'" [attr.aria-pressed]="voice.listening()">🎙️</button>
        }
        <label class="sr-only" for="msg">Mensaje</label>
        <textarea id="msg" name="msg" rows="1" [(ngModel)]="draft" [placeholder]="voice.interim() || 'Escribe tu pregunta…'"
          maxlength="2000" (keydown.enter)="onEnter($event)" [disabled]="thinking()"></textarea>
        <button class="btn send" type="submit" [disabled]="thinking() || !draft.trim()" aria-label="Enviar">➤</button>
      </form>
      <div class="tools row small">
        @if (voice.canSpeak) {
          <label class="toggle"><input type="checkbox" [(ngModel)]="readAloud" name="readAloud" /> Leer respuestas en voz alta</label>
        }
        <button type="button" class="btn ghost small" (click)="newConversation()">Nueva conversación</button>
      </div>
    </div>
  `,
  styles: `
    .chat { display: flex; flex-direction: column; min-height: calc(100dvh - var(--nav-h)); padding-bottom: calc(var(--nav-h) + 12px); }
    .hero { text-align: center; padding-top: 8px; }
    .status { min-height: 1.5em; margin: 8px 0 0; font-size: 0.95rem; }
    .messages { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 16px 0; }
    .empty { text-align: center; color: var(--text-2); }
    .suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
    .chip-btn { border: 1px solid var(--line); background: var(--surface); color: var(--text); border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 0.92rem; cursor: pointer; }
    .bubble { max-width: 85%; padding: 10px 14px; border-radius: 18px; white-space: pre-wrap; word-wrap: break-word; }
    .bubble.user { align-self: flex-end; background: var(--brand); color: var(--brand-ink); border-bottom-right-radius: 6px; }
    .bubble.assistant { align-self: flex-start; background: var(--surface); border: 1px solid var(--line); border-bottom-left-radius: 6px; }
    .bubble.error { border-color: var(--danger); color: var(--danger); }
    .event { align-self: flex-start; display: block; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--text); text-decoration: none; font-size: 0.95rem; }
    .event .go { color: var(--accent); font-weight: 600; margin-left: 4px; }
    .typing { display: flex; gap: 4px; }
    .typing span { width: 8px; height: 8px; border-radius: 50%; background: var(--text-2); animation: dot 1s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes dot { 50% { opacity: 0.3; transform: translateY(-3px); } }
    .composer { position: sticky; bottom: calc(var(--nav-h) + 8px); display: flex; gap: 8px; align-items: flex-end; background: var(--bg); padding-top: 8px; }
    .composer textarea { resize: none; border-radius: 22px; padding: 10px 16px; max-height: 140px; }
    .mic, .send { flex: none; width: 48px; height: 48px; border-radius: 50%; padding: 0; font-size: 1.2rem; }
    .mic { border: 1px solid var(--line); background: var(--surface); cursor: pointer; }
    .mic.on { background: var(--accent); border-color: var(--accent); animation: listen 1.2s infinite; }
    @keyframes listen { 50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 25%, transparent); } }
    .tools { justify-content: space-between; margin-top: 6px; }
    .toggle { flex-direction: row; align-items: center; gap: 6px; font-weight: 500; }
    .toggle input { width: auto; min-height: auto; }
  `,
})
export class Chat implements OnInit {
  private readonly api = inject(Api);
  private readonly stream = inject(ChatStream);
  private readonly timers = inject(TimerStore);
  protected readonly voice = inject(VoiceService);

  protected readonly bubbles = signal<Bubble[]>([]);
  protected readonly thinking = signal(false);
  protected draft = '';
  protected readAloud = false;
  protected readonly format = formatSeconds;
  private conversationId: string | null = null;

  protected readonly suggestions = [
    '¿Qué cocino hoy si tengo poco tiempo?',
    'Quiero hacer un ajiaco para 4',
    'Algo ligero para la cena',
    'Hazme la lista de mercado para un sancocho',
  ];

  protected readonly faceState = computed<FaceState>(() =>
    this.voice.listening() ? 'listening' : this.thinking() ? 'thinking' : this.voice.speaking() ? 'speaking' : 'idle',
  );

  protected readonly statusText = computed(() => {
    switch (this.faceState()) {
      case 'listening': return 'Te escucho…';
      case 'thinking': return 'Déjame pensar…';
      case 'speaking': return 'Hablando…';
      default: return 'La Sazón';
    }
  });

  async ngOnInit(): Promise<void> {
    this.conversationId = localStorage.getItem(CONVERSATION_KEY);
    if (this.conversationId) {
      try {
        const history = await firstValueFrom(this.api.messages(this.conversationId));
        this.bubbles.set(history.map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', text: m.content })));
        this.scrollDown();
      } catch {
        this.conversationId = null;
        localStorage.removeItem(CONVERSATION_KEY);
      }
    }
  }

  protected onEnter(e: Event): void {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      void this.send(this.draft);
    }
  }

  protected toggleMic(): void {
    if (this.voice.listening()) {
      this.voice.stopListening();
      return;
    }
    this.readAloud = true;
    this.voice.listen(
      (text) => void this.send(text),
      (msg) => this.bubbles.update((b) => [...b, { role: 'assistant', text: msg, error: true }]),
    );
  }

  protected async newConversation(): Promise<void> {
    this.voice.stopSpeaking();
    this.conversationId = null;
    localStorage.removeItem(CONVERSATION_KEY);
    this.bubbles.set([]);
  }

  async send(text: string): Promise<void> {
    const msg = text.trim();
    if (!msg || this.thinking()) return;
    this.draft = '';
    this.bubbles.update((b) => [...b, { role: 'user', text: msg }]);
    this.thinking.set(true);
    this.scrollDown();
    try {
      const id = await this.ensureConversation();
      await this.stream.send(id, msg, (e) => this.onEvent(e));
    } catch {
      this.bubbles.update((b) => [...b, { role: 'assistant', text: 'No pude conectarme con la cocina. Revisa tu conexión.', error: true }]);
    } finally {
      this.thinking.set(false);
      this.scrollDown();
    }
  }

  private onEvent(e: ChatStreamEvent): void {
    switch (e.type) {
      case 'text':
        this.bubbles.update((b) => [...b, { role: 'assistant', text: e.data.text }]);
        if (this.readAloud) this.voice.speak(e.data.text);
        break;
      case 'recipe':
        this.bubbles.update((b) => [...b, { role: 'event', recipe: e.data }]);
        break;
      case 'timer':
        this.timers.add(e.data);
        this.bubbles.update((b) => [...b, { role: 'event', timer: e.data }]);
        break;
      case 'shopping_list':
        this.bubbles.update((b) => [...b, { role: 'event', list: e.data }]);
        break;
      case 'error':
        this.bubbles.update((b) => [...b, { role: 'assistant', text: e.data.message, error: true }]);
        break;
    }
    this.scrollDown();
  }

  private async ensureConversation(): Promise<string> {
    if (!this.conversationId) {
      const { id } = await firstValueFrom(this.api.createConversation('TEXT'));
      this.conversationId = id;
      localStorage.setItem(CONVERSATION_KEY, id);
    }
    return this.conversationId;
  }

  private scrollDown(): void {
    queueMicrotask(() => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })));
  }
}
