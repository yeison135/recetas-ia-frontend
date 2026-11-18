import { Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { AuthService } from './core/auth';
import { ProfileStore } from './core/profile-store';
import { TimerStore, formatSeconds } from './core/timers';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (showChrome()) {
      @if (timers.active().length) {
        <aside class="timers" aria-label="Temporizadores activos">
          @for (t of timers.active(); track t.id) {
            <div class="timer" [class.done]="t.remaining === 0" role="status">
              <span class="label">{{ t.label }}</span>
              <span class="time">{{ t.remaining === 0 ? '¡Listo!' : format(t.remaining) }}</span>
              <button class="close" type="button" (click)="timers.dismiss(t.id)" [attr.aria-label]="'Quitar temporizador ' + t.label">×</button>
            </div>
          }
        </aside>
      }
    }
    <main>
      <router-outlet />
    </main>
    @if (showChrome()) {
      <nav class="tabs" aria-label="Secciones">
        <a routerLink="/cocina" routerLinkActive="active" ariaCurrentWhenActive="page"><span class="ico" aria-hidden="true">🍲</span>Cocina</a>
        <a routerLink="/recetas" routerLinkActive="active" ariaCurrentWhenActive="page"><span class="ico" aria-hidden="true">📖</span>Recetas</a>
        <a routerLink="/mercado" routerLinkActive="active" ariaCurrentWhenActive="page"><span class="ico" aria-hidden="true">🧺</span>Mercado</a>
        <a routerLink="/perfil" routerLinkActive="active" ariaCurrentWhenActive="page"><span class="ico" aria-hidden="true">👤</span>Perfil</a>
      </nav>
    }
  `,
  styles: `
    .timers {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 8px 16px;
      background: color-mix(in srgb, var(--bg) 92%, transparent);
      backdrop-filter: blur(6px);
      border-bottom: 1px solid var(--line);
    }
    .timer {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: none;
      padding: 6px 6px 6px 14px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 700;
    }
    .timer.done {
      background: var(--brand);
      color: var(--brand-ink);
      animation: pulse 1s infinite;
    }
    .timer .label { font-weight: 600; max-width: 12ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .timer .time { font-variant-numeric: tabular-nums; }
    .timer { animation: rise 0.3s var(--ease) both; box-shadow: var(--shadow); }
    .timer .time { font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; }
    .close {
      border: 0; background: color-mix(in srgb, currentColor 12%, transparent); color: inherit; font-size: 1.3rem; line-height: 1;
      width: 36px; height: 36px; border-radius: 50%; cursor: pointer; transition: transform 0.18s var(--spring);
      position: relative;
    }
    /* Área táctil de 44px sin agrandar el círculo. */
    .close::after { content: ''; position: absolute; inset: -4px; }
    .close:active { transform: scale(0.9); }
    .close:focus-visible { outline: 3px solid currentColor; outline-offset: 1px; }
    @keyframes pulse { 50% { transform: scale(1.04); } }
    .tabs {
      position: fixed;
      inset: auto 0 0 0;
      height: calc(var(--nav-h) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: color-mix(in srgb, var(--surface) 94%, transparent);
      backdrop-filter: blur(10px);
      border-top: 1px solid var(--line);
      box-shadow: 0 -6px 20px rgb(43 33 27 / 6%);
      z-index: 10;
    }
    .tabs a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--text-2);
      text-decoration: none;
      font-size: 0.78rem;
      font-weight: 700;
      -webkit-tap-highlight-color: transparent;
      transition: color 0.2s;
    }
    .tabs .ico {
      display: grid;
      place-items: center;
      width: 56px;
      height: 32px;
      border-radius: 999px;
      font-size: 1.3rem;
      transition: background-color 0.25s, transform 0.25s var(--spring);
    }
    .tabs a:hover .ico { background: var(--surface-2); }
    .tabs a:active .ico { transform: scale(0.9); }
    .tabs a.active { color: var(--brand-strong); }
    .tabs a.active .ico { background: var(--brand-soft); transform: translateY(-1px); }
    .tabs a:focus-visible { outline: none; }
    .tabs a:focus-visible .ico { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }
  `,
})
export class App {
  protected readonly timers = inject(TimerStore);
  private readonly profile = inject(ProfileStore);
  private readonly auth = inject(AuthService);
  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: '' },
  );

  protected readonly showChrome = computed(() => this.auth.isLoggedIn() && !this.url().startsWith('/entrar'));
  protected readonly format = formatSeconds;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        void this.timers.load().catch(() => undefined);
        void this.profile.load();
      }
    });
  }
}
