import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { COST_LABEL, DIFFICULTY_LABEL, Ingredient, RecipeDetail } from '../../core/models';
import { kitchenQuantity } from '../../core/format';
import { catalogRecipeText } from '../../core/share';
import { TimerStore, formatSeconds } from '../../core/timers';
import { VoiceService } from '../../core/voice';
import { ShareButtons } from '../../shared/share-buttons';

@Component({
  selector: 'app-recipe-detail',
  imports: [RouterLink, ShareButtons],
  template: `
    <div class="page stack">
      <a routerLink="/recetas" class="back"><span aria-hidden="true">←</span> Recetas</a>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <div class="toast-host" role="status" aria-live="polite">
        @if (message()) { <p class="toast ok">{{ message() }}</p> }
      </div>
      @if (recipe(); as r) {
        <header class="enter">
          <div class="top">
            <span class="chip region">{{ r.region }}</span>
            <button type="button" class="btn secondary fav" [class.on]="favorite()" [attr.aria-pressed]="favorite()"
              (click)="toggleFavorite()" [disabled]="favBusy()">
              <span class="heart" aria-hidden="true">{{ favorite() ? '❤️' : '🤍' }}</span> Favorita
            </button>
          </div>
          <h1>{{ r.title }}</h1>
          <p class="muted">{{ r.summary }}</p>
          <dl class="facts">
            <div><dt>Preparación</dt><dd>{{ r.prepMinutes }} min</dd></div>
            <div><dt>Cocción</dt><dd>{{ r.cookMinutes }} min</dd></div>
            <div><dt>Dificultad</dt><dd>{{ difficulty[r.difficulty] }}</dd></div>
            <div><dt>Costo</dt><dd>{{ cost[r.costLevel] }}</dd></div>
          </dl>
          @if (r.allergens.length) {
            <div class="row">
              @for (a of r.allergens; track a) { <span class="chip warn">⚠️ Contiene {{ a.replace('_', ' ') }}</span> }
            </div>
          }
        </header>

        <section class="card stack enter">
          <div class="servings">
            <h2 class="card-title"><span class="ico mango" aria-hidden="true">🧺</span>Ingredientes</h2>
            <div class="stepper" role="group" aria-label="Porciones">
              <button type="button" class="btn secondary icon" (click)="changeServings(-1)" [disabled]="r.servings <= 1" aria-label="Menos porciones">−</button>
              <span class="count"><strong>{{ r.servings }}</strong> porciones</span>
              <button type="button" class="btn secondary icon" (click)="changeServings(1)" [disabled]="r.servings >= 50" aria-label="Más porciones">+</button>
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
          <button type="button" class="btn secondary block" (click)="makeList()" [disabled]="busy()">
            @if (busy()) { <span class="spinner" aria-hidden="true"></span> } @else { <span aria-hidden="true">🛒</span> }
            Hacer lista de mercado
          </button>
          @if (r.substitutes.length) {
            <details class="subs">
              <summary>¿Te falta algo? Sustitutos</summary>
              <ul>
                @for (s of r.substitutes; track $index) {
                  <li>{{ s.ingredient }} → <strong>{{ s.substitute }}</strong>@if (s.note) {<span class="muted"> ({{ s.note }})</span>}</li>
                }
              </ul>
            </details>
          }
        </section>

        <section class="stack enter">
          <div class="servings">
            <h2 class="card-title"><span class="ico menta" aria-hidden="true">🔥</span>Preparación</h2>
            <button type="button" class="btn secondary" (click)="cookMode.set(!cookMode())" [attr.aria-pressed]="cookMode()">
              {{ cookMode() ? 'Ver todos los pasos' : '👩‍🍳 Modo cocina' }}
            </button>
          </div>

          @if (cookMode()) {
            @let step = r.steps[current()];
            <div class="card cook">
              <div class="cook-head">
                <p class="muted small">Paso {{ current() + 1 }} de {{ r.steps.length }}</p>
                <div class="progress" aria-hidden="true"><span [style.width.%]="((current() + 1) / r.steps.length) * 100"></span></div>
              </div>
              @for (s of [step]; track s.position) {
                <p class="big">{{ s.instruction }}</p>
              }
              <div class="row">
                @if (step.timerSeconds) {
                  <button type="button" class="btn" (click)="startTimer(step.position, step.timerSeconds)">⏱️ {{ format(step.timerSeconds) }}</button>
                }
                @if (voice.canSpeak) {
                  <button type="button" class="btn secondary" (click)="voice.speak(step.instruction)">🔊 Leer</button>
                }
              </div>
              <div class="nav">
                <button type="button" class="btn secondary" (click)="go(-1)" [disabled]="current() === 0">← Anterior</button>
                <button type="button" class="btn" (click)="go(1)" [disabled]="current() === r.steps.length - 1">Siguiente →</button>
              </div>
            </div>
          } @else {
            <ol class="steps">
              @for (s of r.steps; track s.position) {
                <li class="card">
                  <span class="num" aria-hidden="true">{{ $index + 1 }}</span>
                  <div>
                    <p>{{ s.instruction }}</p>
                    @if (s.timerSeconds) {
                      <button type="button" class="btn secondary small timer" (click)="startTimer(s.position, s.timerSeconds)">⏱️ {{ format(s.timerSeconds) }}</button>
                    }
                  </div>
                </li>
              }
            </ol>
          }
        </section>
        <section class="card stack enter">
          <h2 class="card-title"><span class="ico" aria-hidden="true">📤</span>Compártela</h2>
          <app-share-buttons [subject]="r.title" [text]="shareText()" />
        </section>
        <section class="card stack cooked enter">
          @if (!cooked()) {
            <h2 class="card-title"><span class="ico lavanda" aria-hidden="true">⭐</span>¿Ya la cocinaste?</h2>
            <p class="muted small">Cuéntale a La Sazón qué tal te quedó: así no te repite platos y te recomienda mejor.</p>
            <div class="stars" role="group" aria-label="Calificación">
              @for (n of [1, 2, 3, 4, 5]; track n) {
                <button type="button" class="star" [class.on]="n <= rating()" (click)="rating.set(n)"
                  [attr.aria-label]="n + ' de 5'" [attr.aria-pressed]="n === rating()">★</button>
              }
            </div>
            <button type="button" class="btn block" (click)="markCooked()">¡Lo cociné!</button>
          } @else {
            <p class="done">🎉 ¡Qué rico! Quedó en tu historial.</p>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .fav { padding: 8px 16px; }
    .fav.on { background: var(--brand-soft); border-color: color-mix(in srgb, var(--brand) 40%, var(--line)); color: var(--brand-strong); }
    .fav.on .heart { animation: pop 0.4s var(--spring); }
    header h1 { font-size: 1.9rem; margin: 8px 0 4px; }
    header > p { margin: 0 0 12px; }
    .chip.region { background: var(--brand-soft); color: var(--brand-strong); }
    .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 10px; }
    .facts div { padding: 10px 6px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--line); text-align: center; }
    .facts dt { font-size: 0.72rem; font-weight: 700; color: var(--text-2); }
    .facts dd { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; }
    .servings { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    .stepper .count { padding: 0 4px; color: var(--text-2); font-weight: 600; font-size: 0.9rem; }
    .stepper .count strong { color: var(--text); }
    .ingredients .optional { opacity: 0.8; }
    .subs { border-radius: var(--radius-sm); background: var(--surface-2); padding: 0 14px; }
    .subs summary { min-height: 48px; display: flex; align-items: center; font-weight: 700; cursor: pointer; }
    .subs ul { margin: 0; padding: 0 0 12px 1.1rem; display: flex; flex-direction: column; gap: 4px; }
    .steps .timer { min-height: 44px; }
    .cook { display: flex; flex-direction: column; gap: 12px; border-width: 2px; border-color: color-mix(in srgb, var(--brand) 35%, var(--line)); }
    .cook-head p { margin: 0 0 6px; font-weight: 700; }
    .cook .big { font-size: 1.35rem; line-height: 1.45; margin: 0; animation: rise 0.3s var(--ease); }
    .cook .nav { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
    .cooked h2 { margin: 0; }
    .cooked p { margin: 0; }
    .cooked .done { font-weight: 700; animation: pop 0.4s var(--spring); }
    .stars { display: flex; gap: 2px; }
    .star {
      width: 48px; height: 48px; border: 0; border-radius: 50%; background: transparent; font-size: 2.1rem; line-height: 1;
      color: color-mix(in srgb, var(--text-2) 40%, var(--surface)); cursor: pointer; padding: 0; transition: transform 0.2s var(--spring), color 0.15s;
    }
    .star:hover { transform: scale(1.12); }
    .star.on { color: var(--gold); transform: scale(1.05); }
    .star:focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); }
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
  protected readonly shareText = computed(() => {
    const r = this.recipe();
    return r ? catalogRecipeText(r) : '';
  });
  protected readonly favorite = signal(false);
  protected readonly favBusy = signal(false);

  ngOnInit(): void {
    const s = Number(this.porciones());
    void this.load(Number.isInteger(s) && s > 0 ? s : undefined);
    void firstValueFrom(this.api.isFavorite(this.slug())).then((f) => this.favorite.set(f.favorite)).catch(() => undefined);
  }

  protected async toggleFavorite(): Promise<void> {
    const next = !this.favorite();
    this.favorite.set(next);
    this.favBusy.set(true);
    try {
      await firstValueFrom(next ? this.api.addFavorite(this.slug()) : this.api.removeFavorite(this.slug()));
      this.flash(next ? 'Guardada en tus favoritas.' : 'Quitada de tus favoritas.');
    } catch {
      this.favorite.set(!next);
      this.flash('No pude actualizar tus favoritas.');
    } finally {
      this.favBusy.set(false);
    }
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
      this.flash(`Temporizador de ${formatSeconds(seconds)} en marcha.`);
    } catch {
      this.flash('No pude iniciar el temporizador.');
    }
  }

  protected async markCooked(): Promise<void> {
    const r = this.recipe();
    if (!r) return;
    try {
      await firstValueFrom(this.api.markCooked(r.slug, r.servings, this.rating() || undefined));
      this.cooked.set(true);
    } catch {
      this.flash('No pude guardarlo en tu historial.');
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
      this.flash('No pude crear la lista de mercado.');
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

  private flashTimer?: ReturnType<typeof setTimeout>;

  private flash(text: string): void {
    this.message.set(text);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.message.set(''), 3200);
  }
}
