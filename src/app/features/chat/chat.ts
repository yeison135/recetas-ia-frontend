import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { LOCAL_KEYS, isUuid } from '../../core/config';
import { ChatStream, ChatStreamEvent } from '../../core/chat-stream';
import { CookingTimer, ShoppingList } from '../../core/models';
import { TimerStore, formatSeconds } from '../../core/timers';
import { VoiceService } from '../../core/voice';
import { ProfileStore } from '../../core/profile-store';
import { Avatar, AvatarState } from '../../shared/avatar';

interface Bubble {
  role: 'user' | 'assistant' | 'event';
  text?: string;
  recipe?: { slug: string; title: string; servings: number };
  timer?: CookingTimer;
  list?: ShoppingList;
  saved?: { id: string; title: string };
  plan?: { id: string; title: string; days: number };
  favorite?: { slug: string; title: string };
  error?: boolean;
}

const CONVERSATION_KEY = LOCAL_KEYS.conversation;

@Component({
  selector: 'app-chat',
  imports: [FormsModule, RouterLink, Avatar],
  template: `
    <div class="page chat">
      <header class="hero" [class.calling]="inCall()">
        <app-avatar [kind]="profile.avatar()" [state]="faceState()" [size]="inCall() ? 170 : 132" />
        <p class="status muted" aria-live="polite">{{ statusText() }}</p>
        @if (inCall() && voice.interim()) {
          <p class="interim">“{{ voice.interim() }}”</p>
        }
        @if (voice.canListen && voice.canSpeak) {
          @if (!inCall()) {
            <button type="button" class="btn call" (click)="startCall()">📞 Conversar por voz</button>
          } @else {
            <button type="button" class="btn danger call" (click)="endCall()">Colgar</button>
          }
        }
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
              @if (b.saved) {
                <a class="event" [routerLink]="['/recetas/mias', b.saved.id]">📒 Guardé «<strong>{{ b.saved.title }}</strong>» en Mis recetas <span class="go">Ver →</span></a>
              }
              @if (b.plan) {
                <a class="event" [routerLink]="['/planes', b.plan.id]">🗓️ Plan «<strong>{{ b.plan.title }}</strong>» · {{ b.plan.days }} {{ b.plan.days === 1 ? 'día' : 'días' }} <span class="go">Abrir →</span></a>
              }
              @if (b.favorite) {
                <a class="event" [routerLink]="['/recetas', b.favorite.slug]">❤️ «<strong>{{ b.favorite.title }}</strong>» en tus favoritas <span class="go">Ver →</span></a>
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
          <label class="toggle"><input type="checkbox" role="switch" class="switch" [(ngModel)]="readAloud" name="readAloud" /> Leer respuestas en voz alta</label>
        }
        <button type="button" class="btn ghost small" (click)="newConversation()">Nueva conversación</button>
      </div>
    </div>
  `,
  styles: `
    .chat { display: flex; flex-direction: column; min-height: calc(100dvh - var(--nav-h)); padding-bottom: calc(var(--nav-h) + 12px); }
    .hero { text-align: center; padding-top: 8px; }
    .status { min-height: 1.5em; margin: 8px 0 0; font-size: 0.95rem; }
    .call { margin-top: 10px; }
    .interim { margin: 6px auto 0; max-width: 32ch; font-style: italic; color: var(--text-2); }
    .hero.calling { position: sticky; top: 0; z-index: 4; background: var(--bg); padding-bottom: 8px; }
    .messages { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 16px 0; }
    .empty { text-align: center; color: var(--text-2); }
    .suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
    .chip-btn {
      border: 1.5px solid var(--line); background: var(--surface); color: var(--text); border-radius: 999px; padding: 8px 16px; min-height: 44px;
      font: inherit; font-size: 0.92rem; font-weight: 600; cursor: pointer; box-shadow: var(--shadow);
      transition: transform 0.18s var(--spring), border-color 0.15s, background-color 0.15s; animation: rise 0.35s var(--ease) both;
    }
    .chip-btn:nth-child(2) { animation-delay: 0.05s; }
    .chip-btn:nth-child(3) { animation-delay: 0.1s; }
    .chip-btn:nth-child(4) { animation-delay: 0.15s; }
    .chip-btn:nth-child(n + 5) { animation-delay: 0.2s; }
    .chip-btn:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); background: var(--brand-soft); }
    .chip-btn:active { transform: scale(0.96); }
    .chip-btn:focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }
    .bubble { max-width: 85%; padding: 10px 14px; border-radius: 20px; white-space: pre-wrap; word-wrap: break-word; animation: rise 0.25s var(--ease); }
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
    .composer {
      position: sticky; bottom: calc(var(--nav-h) + 8px); display: flex; gap: 6px; align-items: flex-end;
      padding: 6px; border-radius: 30px; background: var(--surface); border: 1.5px solid var(--line); box-shadow: var(--shadow-lift);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .composer:focus-within { border-color: var(--brand); box-shadow: var(--ring), var(--shadow-lift); }
    .composer textarea {
      resize: none; border: 0; background: transparent; border-radius: 22px; padding: 11px 8px; min-height: 48px; max-height: 140px;
    }
    .composer textarea:focus, .composer textarea:focus-visible { outline: none; }
    .mic, .send { flex: none; width: 48px; height: 48px; border-radius: 50%; padding: 0; font-size: 1.2rem; }
    .mic { border: 0; background: var(--surface-2); cursor: pointer; transition: transform 0.18s var(--spring), background-color 0.15s; }
    .mic:hover { background: var(--brand-soft); }
    .mic:active, .send:not(:disabled):active { transform: scale(0.92); }
    .mic:focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }
    .mic.on { background: var(--accent); border-color: var(--accent); animation: listen 1.2s infinite; }
    .send:disabled { opacity: 0.35; }
    .send:not(:disabled) { animation: pop 0.3s var(--spring); }
    @keyframes listen { 50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 25%, transparent); } }
    .tools { justify-content: space-between; margin-top: 10px; }
    .toggle { flex-direction: row; align-items: center; gap: 10px; font-weight: 600; min-height: 44px; cursor: pointer; }
  `,
})
export class Chat implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /** Cancela la respuesta en curso al salir de la pantalla, empezar otra conversación o cerrar sesión. */
  private inFlight: AbortController | null = null;
  private readonly logoutSub = this.auth.loggedOut.subscribe(() => this.stop());
  private readonly stream = inject(ChatStream);
  private readonly timers = inject(TimerStore);
  protected readonly voice = inject(VoiceService);
  protected readonly profile = inject(ProfileStore);

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
    'Invéntame algo con lo que tengo en la nevera',
    'Arma mi plan saludable de la semana',
  ];

  protected readonly faceState = computed<AvatarState>(() =>
    this.voice.listening() ? 'listening' : this.thinking() ? 'thinking' : this.voice.speaking() ? 'speaking' : 'idle',
  );

  protected readonly statusText = computed(() => {
    switch (this.faceState()) {
      case 'listening': return 'Te escucho…';
      case 'thinking': return 'Déjame pensar…';
      case 'speaking': return 'Hablando…';
      default: return this.profile.avatarName();
    }
  });

  async ngOnInit(): Promise<void> {
    const saved = localStorage.getItem(CONVERSATION_KEY);
    this.conversationId = isUuid(saved) ? saved : null;
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
    // Llegó con ?pregunta=… (p. ej. "Ver receta" de un plan): se envía una sola vez y se quita de la URL
    // para que recargar o volver atrás no la repita.
    const pregunta = this.route.snapshot.queryParamMap.get('pregunta')?.trim().slice(0, 500);
    if (pregunta) {
      await this.router.navigate([], { relativeTo: this.route, queryParams: { pregunta: null }, queryParamsHandling: 'merge', replaceUrl: true });
      void this.send(pregunta);
    }
  }

  protected onEnter(e: Event): void {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      void this.send(this.draft);
    }
  }

  ngOnDestroy(): void {
    this.stop();
    this.logoutSub.unsubscribe();
  }

  private stop(): void {
    this.inCall.set(false);
    this.inFlight?.abort();
    this.inFlight = null;
    this.voice.stopListening();
    this.voice.stopSpeaking();
  }

  protected async toggleMic(): Promise<void> {
    if (this.voice.listening()) {
      this.voice.stopListening();
      return;
    }
    if (!(await this.ensureVoiceConsent())) return;
    this.readAloud = true;
    this.voice.listen(
      (text) => void this.send(text),
      (msg) => this.bubbles.update((b) => [...b, { role: 'assistant', text: msg, error: true }]),
    );
  }

  /**
   * El dictado del navegador envía el audio al servicio de voz del navegador (en Chrome, Google).
   * Se pide la autorización VOICE una vez, explicándolo, y queda registrada en el servidor.
   */
  private async ensureVoiceConsent(): Promise<boolean> {
    try {
      const consents = await firstValueFrom(this.api.consents());
      if (consents.some((c) => c.purpose === 'VOICE')) return true;
      const ok = confirm(
        'Para hablarle a La Sazón, tu navegador o tu teléfono convierte tu voz en texto con su propio servicio ' +
          '(normalmente de Google). Solo se envía lo que dices mientras el micrófono está activo. ¿Autorizas el uso de tu voz?',
      );
      if (!ok) return false;
      await firstValueFrom(this.api.grantConsent('VOICE'));
      return true;
    } catch {
      return false;
    }
  }

  protected async newConversation(): Promise<void> {
    this.stop();
    this.conversationId = null;
    localStorage.removeItem(CONVERSATION_KEY);
    this.bubbles.set([]);
  }

  // ---------------------------------------------------------------- modo conversación

  /** Rondas seguidas sin oír nada antes de colgar solo. */
  private static readonly MAX_SILENT_ROUNDS = 3;
  protected readonly inCall = signal(false);

  /**
   * Conversación manos libres: un toque para empezar (los navegadores lo exigen para el micrófono)
   * y luego escuchar → responder en voz alta → volver a escuchar, hasta colgar.
   */
  protected async startCall(): Promise<void> {
    if (!(await this.ensureVoiceConsent())) return;
    this.stop();
    // Conversación de canal VOICE: el asistente responde más corto, pensado para oírse.
    this.conversationId = null;
    localStorage.removeItem(CONVERSATION_KEY);
    this.bubbles.set([]);
    this.inCall.set(true);
    this.timers.askPermission(); // este toque desbloquea la alarma de los temporizadores en el celular
    this.readAloud = false;
    void this.callLoop();
  }

  protected endCall(): void {
    this.inCall.set(false);
    this.stop();
  }

  private async callLoop(): Promise<void> {
    await this.voice.speak('¡Hola! Te escucho. ¿Qué cocinamos hoy?');
    let silent = 0;
    while (this.inCall()) {
      const heard = await this.voice.listenOnce();
      if (!this.inCall()) break;
      if (heard.error) {
        this.bubbles.update((b) => [...b, { role: 'assistant', text: heard.error, error: true }]);
        this.endCall();
        break;
      }
      if (!heard.text) {
        if (++silent >= Chat.MAX_SILENT_ROUNDS) {
          this.bubbles.update((b) => [...b, { role: 'assistant', text: 'No te escuché por un rato, así que colgué. Toca "Conversar por voz" para seguir.' }]);
          this.endCall();
        }
        continue;
      }
      silent = 0;
      const answer = await this.send(heard.text, 'VOICE');
      if (answer && this.inCall()) await this.voice.speak(answer);
    }
  }

  /** Envía un mensaje y devuelve el texto de la respuesta (si llegó). */
  async send(text: string, channel: 'TEXT' | 'VOICE' = 'TEXT'): Promise<string | null> {
    const msg = text.trim();
    if (!msg || this.thinking()) return null;
    let answer: string | null = null;
    this.draft = '';
    this.timers.askPermission(); // con el gesto del usuario, por si la IA inicia un temporizador
    this.bubbles.update((b) => [...b, { role: 'user', text: msg }]);
    this.thinking.set(true);
    this.scrollDown();
    const controller = new AbortController();
    this.inFlight = controller;
    try {
      const id = await this.ensureConversation(channel);
      await this.stream.send(id, msg, (e) => {
        if (e.type === 'text') answer = e.data.text;
        this.onEvent(e);
      }, controller.signal);
    } catch {
      if (!controller.signal.aborted) {
        this.bubbles.update((b) => [...b, { role: 'assistant', text: 'No pude conectarme con la cocina. Revisa tu conexión.', error: true }]);
      }
    } finally {
      if (this.inFlight === controller) this.inFlight = null;
      this.thinking.set(false);
      this.scrollDown();
    }
    return answer;
  }

  private onEvent(e: ChatStreamEvent): void {
    switch (e.type) {
      case 'text':
        this.bubbles.update((b) => [...b, { role: 'assistant', text: e.data.text }]);
        if (this.readAloud && !this.inCall()) void this.voice.speak(e.data.text);
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
      case 'saved_recipe':
        this.bubbles.update((b) => [...b, { role: 'event', saved: e.data }]);
        break;
      case 'meal_plan':
        this.bubbles.update((b) => [...b, { role: 'event', plan: e.data }]);
        break;
      case 'favorite':
        this.bubbles.update((b) => [...b, { role: 'event', favorite: e.data }]);
        break;
      case 'error':
        this.bubbles.update((b) => [...b, { role: 'assistant', text: e.data.message, error: true }]);
        break;
    }
    this.scrollDown();
  }

  private async ensureConversation(channel: 'TEXT' | 'VOICE'): Promise<string> {
    if (!this.conversationId) {
      const { id } = await firstValueFrom(this.api.createConversation(channel));
      this.conversationId = id;
      localStorage.setItem(CONVERSATION_KEY, id);
    }
    return this.conversationId;
  }

  private scrollDown(): void {
    queueMicrotask(() => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })));
  }
}
