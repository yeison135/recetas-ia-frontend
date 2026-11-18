import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Api } from './api';
import { AuthService } from './auth';
import { IS_NATIVE } from './config';
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
    // Al cerrar sesión no deben quedar temporizadores de otra persona en pantalla.
    inject(AuthService).loggedOut.subscribe(() => {
      for (const t of this.timers()) void cancelNative(t);
      this.timers.set([]);
      this.rung.clear();
    });
  }

  /** Pedir el permiso de notificaciones solo tras un gesto del usuario (los navegadores lo exigen). */
  askPermission(): void {
    requestNotificationPermission();
    unlockAudio();
  }

  async load(): Promise<void> {
    this.timers.set(await firstValueFrom(this.api.timers()));
  }

  add(t: CookingTimer): void {
    this.timers.update((list) => [...list.filter((x) => x.id !== t.id), t]);
    void scheduleNative(t);
  }

  async start(label: string, seconds: number): Promise<void> {
    requestNotificationPermission();
    this.add(await firstValueFrom(this.api.startTimer(label, seconds)));
  }

  async dismiss(id: string): Promise<void> {
    const t = this.timers().find((x) => x.id === id);
    this.timers.update((list) => list.filter((x) => x.id !== id));
    if (t && Date.parse(t.endsAt) > Date.now()) {
      void cancelNative(t);
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

/** Id numérico estable para la notificación nativa a partir del uuid del temporizador. */
function nativeId(t: CookingTimer): number {
  return parseInt(t.id.replace(/-/g, '').slice(0, 7), 16);
}

/** En la app nativa la alarma la programa el sistema: suena aunque la app esté cerrada o en segundo plano. */
async function scheduleNative(t: CookingTimer): Promise<void> {
  if (!IS_NATIVE || Date.parse(t.endsAt) <= Date.now()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;
  await LocalNotifications.schedule({
    notifications: [{ id: nativeId(t), title: '¡Listo el temporizador!', body: t.label, schedule: { at: new Date(t.endsAt), allowWhileIdle: true } }],
  });
}

async function cancelNative(t: CookingTimer): Promise<void> {
  if (!IS_NATIVE) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: nativeId(t) }] });
}

let audioCtx: AudioContext | null = null;

/**
 * Los navegadores móviles solo dejan sonar audio creado tras un toque del usuario: el contexto se crea
 * (o reanuda) en ese toque y se reutiliza cuando suena la alarma, aunque sea minutos después.
 */
function unlockAudio(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function requestNotificationPermission(): void {
  if (IS_NATIVE) return;
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

/** En Chrome para Android `new Notification` no existe: se usa el service worker si está. */
async function notify(label: string): Promise<void> {
  if (IS_NATIVE || !('Notification' in window) || Notification.permission !== 'granted') return;
  const options = { body: label, tag: 'timer-' + label };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification('¡Listo el temporizador!', options);
      return;
    }
    new Notification('¡Listo el temporizador!', options);
  } catch {
    // Sin notificaciones: queda la alarma sonora y el aviso visual.
  }
}

function ring(label: string): void {
  try {
    const ctx = unlockAudio();
    if (!ctx) throw new Error('sin audio');
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
  void notify(label);
  navigator.vibrate?.([300, 150, 300]);
}
