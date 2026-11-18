import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { isoDate, nextMonday } from '../../core/plan-dates';
import { ProfileStore } from '../../core/profile-store';
import { Avatar } from '../../shared/avatar';

/** Por si el servidor no responde la lista: las mismas cocinas que acepta el backend. */
const FALLBACK_CUISINES = [
  'Colombiana', 'Italiana', 'Japonesa', 'Peruana', 'Mexicana', 'Mediterránea',
  'India', 'China', 'Tailandesa', 'Española', 'Árabe', 'Coreana',
];

/** Lo que se va contando mientras la IA arma el plan (tarda de 40 s a 2 min). */
const STEPS = [
  'Pensando desayunos…',
  'Mirando tus gustos y alergias…',
  'Eligiendo almuerzos con sazón…',
  'Buscando que nada se repita…',
  'Armando cenas livianas…',
  'Calculando cantidades…',
  'Revisando la lista de ingredientes…',
  'Dándole el último toque…',
];

/**
 * Formulario "Crear plan semanal": días, fecha de inicio, cocinas e indicaciones. Al enviarlo muestra
 * un estado de espera con el avatar pensando y, cuando la IA termina, abre el plan en /planes/:id.
 */
@Component({
  selector: 'app-plan-generator',
  imports: [FormsModule, Avatar],
  template: `
    @if (!open()) {
      <button type="button" class="btn block cta enter" (click)="open.set(true)" aria-controls="plan-gen">
        <span aria-hidden="true">✨</span> Crear plan semanal
      </button>
    } @else {
      <section #card id="plan-gen" class="card stack gen enter" aria-labelledby="plan-gen-title" [attr.aria-busy]="busy()">
        <div class="gen-head">
          <h2 id="plan-gen-title" class="card-title"><span class="ico mango" aria-hidden="true">✨</span>Tu plan de la semana</h2>
          @if (!busy()) {
            <button type="button" class="btn ghost icon" (click)="open.set(false)" aria-label="Cerrar el formulario del plan">×</button>
          }
        </div>

        <div role="status" aria-live="polite">
          @if (busy()) {
            <div class="wait">
              <app-avatar [kind]="profile.avatar()" state="thinking" [size]="96" />
              <div class="wait-text">
                <!-- @for con track por texto: cada mensaje nuevo entra con su animación. -->
                @for (s of [steps[step()]]; track s) { <p class="step">{{ s }}</p> }
                <p class="muted small">Esto toma entre 1 y 2 minutos. Puedes quedarte aquí; te abro el plan apenas esté.</p>
                <div class="progress indeterminate" aria-hidden="true"><span></span></div>
              </div>
            </div>
          }
        </div>

        <form class="stack" (ngSubmit)="generate()" [class.dim]="busy()">
          <fieldset class="stack plain" [disabled]="busy()">
            <legend class="sr-only">Datos del plan</legend>
            <div class="two">
              <div class="group">
                <span class="lbl" id="pg-days-l">Días</span>
                <div class="stepper" role="group" aria-labelledby="pg-days-l">
                  <button type="button" class="btn secondary icon" aria-label="Menos días" (click)="setDays(days() - 1)" [disabled]="days() <= 1">−</button>
                  <strong aria-live="polite">{{ days() }}</strong>
                  <button type="button" class="btn secondary icon" aria-label="Más días" (click)="setDays(days() + 1)" [disabled]="days() >= 7">+</button>
                </div>
              </div>
              <div class="field date">
                <input id="pg-start" name="startDate" type="date" [(ngModel)]="startDate" [min]="today" required />
                <label for="pg-start">Empieza el</label>
              </div>
            </div>

            <fieldset class="group">
              <legend>Cocinas</legend>
              <div class="choices">
                <label class="choice"><input type="checkbox" [checked]="!picked().length" (change)="surprise()" /><span><span aria-hidden="true">🎲</span> Sorpréndeme</span></label>
                @for (c of cuisines(); track c) {
                  <label class="choice"><input type="checkbox" [checked]="picked().includes(c)" (change)="toggle(c)" /><span>{{ c }}</span></label>
                }
              </div>
            </fieldset>

            <div class="field">
              <textarea id="pg-notes" name="notes" rows="2" maxlength="300" placeholder=" " [(ngModel)]="notes" aria-describedby="pg-notes-h"></textarea>
              <label for="pg-notes">Indicaciones (opcional)</label>
              <span class="hint" id="pg-notes-h">P. ej. "rápido entre semana, nada de pescado" · {{ notes.length }}/300</span>
            </div>
          </fieldset>

          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn block" [disabled]="busy() || !startDate">
            @if (busy()) { <span class="spinner" aria-hidden="true"></span> Creando tu plan… } @else { Crear mi plan }
          </button>
        </form>
      </section>
    }
  `,
  styles: `
    .cta { font-size: 1.05rem; box-shadow: var(--shadow-lift); }
    .gen { scroll-margin-top: 12px; }
    .gen-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .gen-head .btn { font-size: 1.6rem; color: var(--text-2); }
    .plain { border: 0; margin: 0; padding: 0; min-width: 0; }
    .two { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
    .two .date { flex: 1 1 180px; }
    .lbl { display: block; margin-bottom: 8px; font-weight: 700; font-size: 0.95rem; }
    .date > label { top: 7px; font-size: 0.75rem; color: var(--brand); }
    form { transition: opacity 0.2s; }
    form.dim fieldset { opacity: 0.55; }
    .wait { display: flex; gap: 14px; align-items: center; padding: 12px; border-radius: var(--radius); background: var(--surface-2); animation: rise 0.3s var(--ease) both; }
    .wait-text { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .wait p { margin: 0; }
    .step { font-family: var(--font-display); font-weight: 600; font-size: 1.15rem; animation: rise 0.4s var(--ease) both; }
    .indeterminate { background: var(--surface); }
    .indeterminate span { width: 40%; animation: slide 1.6s ease-in-out infinite; }
    @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
  `,
})
export class PlanGenerator {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly profile = inject(ProfileStore);

  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly days = signal(7);
  protected readonly cuisines = signal<string[]>(FALLBACK_CUISINES);
  protected readonly picked = signal<string[]>([]);
  protected readonly step = signal(0);
  protected readonly steps = STEPS;
  protected readonly today = isoDate(new Date());
  protected startDate = isoDate(nextMonday(new Date()));
  protected notes = '';

  private ticker: ReturnType<typeof setInterval> | undefined;
  private destroyed = false;

  constructor() {
    void firstValueFrom(this.api.planCuisines()).then((c) => c.length && this.cuisines.set(c)).catch(() => undefined);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearInterval(this.ticker);
    });
  }

  protected setDays(n: number): void {
    this.days.set(Math.min(7, Math.max(1, n)));
  }

  protected toggle(c: string): void {
    this.picked.update((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  }

  /** "Sorpréndeme" = sin cocinas elegidas: la IA las varía. */
  protected surprise(): void {
    this.picked.set([]);
  }

  protected async generate(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.step.set(0);
    this.ticker = setInterval(() => this.step.update((s) => (s + 1) % STEPS.length), 4000);
    // El botón queda abajo: se sube a la tarjeta para que se vea el avatar pensando.
    requestAnimationFrame(() => this.card()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    try {
      const notes = this.notes.trim();
      const plan = await firstValueFrom(
        this.api.generateMealPlan({
          days: this.days(),
          cuisines: this.picked(),
          ...(notes ? { notes } : {}),
          ...(this.startDate ? { startDate: this.startDate } : {}),
        }),
      );
      if (!this.destroyed) await this.router.navigate(['/planes', plan.id]);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      clearInterval(this.ticker);
      this.busy.set(false);
    }
  }
}

function errorText(e: unknown): string {
  const status = e instanceof HttpErrorResponse ? e.status : -1;
  switch (status) {
    case 429:
      return 'Ya creaste varios planes en la última hora. Descansa un ratico y vuelve a intentarlo más tarde.';
    case 503:
      return 'Tu asistente no está disponible en este momento. Intenta de nuevo en unos minutos.';
    case 400: {
      const detail = (e as HttpErrorResponse).error?.detail;
      return `Revisa los datos del plan${typeof detail === 'string' ? `: ${detail}` : ' (días, fecha e indicaciones).'}`;
    }
    case 0:
      return 'No pude conectarme. Revisa tu conexión e intenta de nuevo.';
    default:
      return 'No pude crear el plan. Intenta de nuevo.';
  }
}
