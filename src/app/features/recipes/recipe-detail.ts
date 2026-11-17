import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { COST_LABEL, DIFFICULTY_LABEL, Ingredient, RecipeDetail } from '../../core/models';
import { kitchenQuantity } from '../../core/format';
import { TimerStore, formatSeconds } from '../../core/timers';
import { VoiceService } from '../../core/voice';

@Component({
  selector: 'app-recipe-detail',
  imports: [RouterLink],
  template: `
    <div class="page stack">
      <a routerLink="/recetas" class="back">← Recetas</a>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (recipe(); as r) {
        <header>
          <h1>{{ r.title }}</h1>
          <p class="muted">{{ r.summary }}</p>
          <div class="row">
            <span class="chip">{{ r.region }}</span>
            <span class="chip">Prep. {{ r.prepMinutes }} min</span>
            <span class="chip">Cocción {{ r.cookMinutes }} min</span>
            <span class="chip">{{ difficulty[r.difficulty] }}</span>
            <span class="chip">{{ cost[r.costLevel] }}</span>
            @for (a of r.allergens; track a) { <span class="chip warn">Contiene {{ a.replace('_', ' ') }}</span> }
          </div>
        </header>

        <section class="card stack">
          <div class="row servings">
            <h2>Ingredientes</h2>
            <div class="stepper" role="group" aria-label="Porciones">
              <button type="button" class="btn secondary" (click)="changeServings(-1)" [disabled]="r.servings <= 1" aria-label="Menos porciones">−</button>
              <span><strong>{{ r.servings }}</strong> porciones</span>
              <button type="button" class="btn secondary" (click)="changeServings(1)" [disabled]="r.servings >= 50" aria-label="Más porciones">+</button>
            </div>
          </div>
          <ul class="ingredients">
            @for (i of r.ingredients; track $index) {
              <li [class.optional]="i.optional">
                <span class="qty">{{ quantity(i) }}</span>
                <span>{{ i.name }}@if (i.preparation) {<span class="muted">, {{ i.preparation }}</span>}@if (i.optional) {<span class="muted"> (opcional)</span>}</span>
              </li>
            }
          </ul>
          <button type="button" class="btn secondary" (click)="makeList()" [disabled]="busy()">🧺 Hacer lista de mercado</button>
          @if (r.substitutes.length) {
            <details>
              <summary>Sustitutos</summary>
              <ul>
                @for (s of r.substitutes; track $index) {
                  <li>{{ s.ingredient }} → {{ s.substitute }}@if (s.note) {<span class="muted"> ({{ s.note }})</span>}</li>
                }
              </ul>
            </details>
          }
        </section>

        <section class="stack">
          <div class="row servings">
            <h2>Preparación</h2>
            <button type="button" class="btn secondary" (click)="cookMode.set(!cookMode())">{{ cookMode() ? 'Ver todos los pasos' : '👩‍🍳 Modo cocina' }}</button>
          </div>

          @if (cookMode()) {
            @let step = r.steps[current()];
            <div class="card cook">
              <p class="muted small">Paso {{ current() + 1 }} de {{ r.steps.length }}</p>
              <p class="big">{{ step.instruction }}</p>
              <div class="row">
                @if (step.timerSeconds) {
                  <button type="button" class="btn" (click)="startTimer(step.position, step.timerSeconds)">⏱️ {{ format(step.timerSeconds) }}</button>
                }
                @if (voice.canSpeak) {
                  <button type="button" class="btn secondary" (click)="voice.speak(step.instruction)">🔊 Leer</button>
                }
              </div>
              <div class="row nav">
                <button type="button" class="btn secondary" (click)="go(-1)" [disabled]="current() === 0">← Anterior</button>
                <button type="button" class="btn" (click)="go(1)" [disabled]="current() === r.steps.length - 1">Siguiente →</button>
              </div>
            </div>
          } @else {
            <ol class="steps">
              @for (s of r.steps; track s.position) {
                <li class="card">
                  <p>{{ s.instruction }}</p>
                  @if (s.timerSeconds) {
                    <button type="button" class="btn secondary small" (click)="startTimer(s.position, s.timerSeconds)">⏱️ {{ format(s.timerSeconds) }}</button>
                  }
                </li>
              }
            </ol>
          }
        </section>
        <section class="card stack cooked">
          @if (!cooked()) {
            <h2>¿Ya la cocinaste?</h2>
            <p class="muted small">Cuéntale a La Sazón qué tal te quedó: así no te repite platos y te recomienda mejor.</p>
            <div class="row stars" role="group" aria-label="Calificación">
              @for (n of [1, 2, 3, 4, 5]; track n) {
                <button type="button" class="star" [class.on]="n <= rating()" (click)="rating.set(n)" [attr.aria-label]="n + ' de 5'">★</button>
              }
            </div>
            <button type="button" class="btn" (click)="markCooked()">¡Lo cociné!</button>
          } @else {
            <p>¡Qué rico! Quedó en tu historial. 🎉</p>
          }
        </section>
        @if (message()) { <p class="notice" role="status">{{ message() }}</p> }
      }
    </div>
  `,
  styles: `
    .back { text-decoration: none; font-weight: 600; }
    .servings { justify-content: space-between; }
    .servings h2 { margin: 0; }
    .stepper { display: flex; align-items: center; gap: 10px; }
    .stepper .btn { width: 44px; padding: 0; }
    .ingredients { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .ingredients li { display: grid; grid-template-columns: 7.5rem 1fr; gap: 8px; }
    .ingredients .qty { font-weight: 700; font-variant-numeric: tabular-nums; }
    .ingredients .optional { opacity: 0.8; }
    .steps { padding-left: 1.2rem; display: flex; flex-direction: column; gap: 10px; }
    .steps li p { margin: 0 0 6px; }
    .cook .big { font-size: 1.35rem; line-height: 1.45; }
    .cook .nav { justify-content: space-between; margin-top: 12px; }
    .cooked h2 { margin: 0; }
    .cooked p { margin: 0; }
    .star { border: 0; background: transparent; font-size: 2rem; line-height: 1; color: var(--line); cursor: pointer; padding: 4px; }
    .star.on { color: #e0a100; }
  `,
})
export class RecipeDetailPage implements OnInit {
  private readonly api = inject(Api);
  private readonly timers = inject(TimerStore);
  private readonly router = inject(Router);
  protected readonly voice = inject(VoiceService);

  readonly slug = input.required<string>();
  readonly porciones = input<string>();

  protected readonly recipe = signal<RecipeDetail | null>(null);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected readonly cookMode = signal(false);
  protected readonly current = signal(0);
  protected readonly rating = signal(0);
  protected readonly cooked = signal(false);
  protected readonly difficulty = DIFFICULTY_LABEL;
  protected readonly cost = COST_LABEL;
  protected readonly format = formatSeconds;
  protected readonly title = computed(() => this.recipe()?.title ?? '');

  ngOnInit(): void {
    const s = Number(this.porciones());
    void this.load(Number.isInteger(s) && s > 0 ? s : undefined);
  }

  protected quantity(i: Ingredient): string {
    return kitchenQuantity(i.quantity, i.unit);
  }

  protected changeServings(delta: number): void {
    const r = this.recipe();
    if (r) void this.load(r.servings + delta);
  }

  protected go(delta: number): void {
    const r = this.recipe();
    if (!r) return;
    this.current.update((c) => Math.min(r.steps.length - 1, Math.max(0, c + delta)));
  }

  protected async startTimer(position: number, seconds: number): Promise<void> {
    const r = this.recipe();
    if (!r) return;
    try {
      await this.timers.start(`${r.title} · paso ${position}`.slice(0, 80), seconds);
      this.message.set(`Temporizador de ${formatSeconds(seconds)} en marcha.`);
    } catch {
      this.message.set('No pude iniciar el temporizador.');
    }
  }

  protected async markCooked(): Promise<void> {
    const r = this.recipe();
    if (!r) return;
    try {
      await firstValueFrom(this.api.markCooked(r.slug, r.servings, this.rating() || undefined));
      this.cooked.set(true);
    } catch {
      this.message.set('No pude guardarlo en tu historial.');
    }
  }

  protected async makeList(): Promise<void> {
    const r = this.recipe();
    if (!r) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.createShoppingList([r.slug], r.servings));
      await this.router.navigateByUrl('/mercado');
    } catch {
      this.message.set('No pude crear la lista de mercado.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(servings?: number): Promise<void> {
    try {
      this.recipe.set(await firstValueFrom(this.api.recipe(this.slug(), servings)));
      this.error.set('');
    } catch {
      this.error.set('No encontré esa receta.');
    }
  }
}
