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
        <a routerLink="/cocina" routerLinkActive="active"><span aria-hidden="true">🍲</span>Cocina</a>
        <a routerLink="/recetas" routerLinkActive="active"><span aria-hidden="true">📖</span>Recetas</a>
        <a routerLink="/mercado" routerLinkActive="active"><span aria-hidden="true">🧺</span>Mercado</a>
        <a routerLink="/perfil" routerLinkActive="active"><span aria-hidden="true">👤</span>Perfil</a>
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
    .close {
      border: 0; background: transparent; color: inherit; font-size: 1.3rem; line-height: 1;
      width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
    }
    @keyframes pulse { 50% { transform: scale(1.04); } }
    .tabs {
      position: fixed;
      inset: auto 0 0 0;
      height: calc(var(--nav-h) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: var(--surface);
      border-top: 1px solid var(--line);
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
      font-size: 0.8rem;
      font-weight: 600;
    }
    .tabs a span { font-size: 1.35rem; }
    .tabs a.active { color: var(--brand); }
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
