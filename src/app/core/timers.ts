import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Api } from './api';
import { CookingTimer } from './models';

export interface TimerView extends CookingTimer {
  remaining: number;
}

/**
 * Temporizadores activos: los crea el servidor (desde la receta o el chat) y aquí se cuenta el
 * tiempo localmente. Al terminar suena una alarma y, si hay permiso, se muestra una notificación.
 */
@Injectable({ providedIn: 'root' })
export class TimerStore {
  private readonly api = inject(Api);
  private readonly timers = signal<CookingTimer[]>([]);
  private readonly now = signal(Date.now());
  private readonly rung = new Set<string>();

  readonly active = computed<TimerView[]>(() =>
    this.timers()
      .map((t) => ({ ...t, remaining: Math.max(0, Math.round((Date.parse(t.endsAt) - this.now()) / 1000)) }))
      .sort((a, b) => a.remaining - b.remaining),
  );

  constructor() {
    const id = setInterval(() => {
      this.now.set(Date.now());
      for (const t of this.active()) {
        if (t.remaining === 0 && !this.rung.has(t.id)) {
          this.rung.add(t.id);
          ring(t.label);
        }
      }
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  async load(): Promise<void> {
    this.timers.set(await firstValueFrom(this.api.timers()));
  }

  add(t: CookingTimer): void {
    requestNotificationPermission();
    this.timers.update((list) => [...list.filter((x) => x.id !== t.id), t]);
  }

  async start(label: string, seconds: number): Promise<void> {
    this.add(await firstValueFrom(this.api.startTimer(label, seconds)));
  }

  async dismiss(id: string): Promise<void> {
    const t = this.timers().find((x) => x.id === id);
    this.timers.update((list) => list.filter((x) => x.id !== id));
    if (t && Date.parse(t.endsAt) > Date.now()) {
      await firstValueFrom(this.api.cancelTimer(id)).catch(() => undefined);
    }
  }
}

export function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

function ring(label: string): void {
  try {
    const ctx = new AudioContext();
    [0, 0.4, 0.8].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    });
  } catch {
    // Sin audio disponible: queda la notificación y el aviso visual.
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('¡Listo el temporizador!', { body: label, tag: `timer-${label}` });
  }
  navigator.vibrate?.([300, 150, 300]);
}
