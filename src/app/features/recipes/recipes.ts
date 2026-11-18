import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { COST_LABEL, DIFFICULTY_LABEL, MealPlanSummary, RecipeSummary, UserRecipe } from '../../core/models';

type View = 'catalogo' | 'favoritas' | 'mias' | 'planes';

@Component({
  selector: 'app-recipes',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <div class="page stack">
      <header class="page-head enter">
        <h1>Recetas</h1>
        <p>Sabores de todas las regiones de Colombia.</p>
      </header>
      <fieldset class="group enter">
        <legend class="sr-only">Qué ver</legend>
        <div class="seg views">
          @for (v of views; track v.value) {
            <label><input type="radio" name="view" [value]="v.value" [checked]="view() === v.value" (change)="setView(v.value)" />
              <span><span class="emo" aria-hidden="true">{{ v.emo }}</span>{{ v.label }}</span></label>
          }
        </div>
      </fieldset>

      @switch (view()) {
      @case ('catalogo') {
      <form class="search enter" (ngSubmit)="search()" role="search">
        <span class="ico" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <label class="sr-only" for="q">Buscar recetas</label>
        <input id="q" type="search" name="q" [(ngModel)]="q" placeholder="Ajiaco, plátano, sopa…" maxlength="200"
          enterkeyhint="search" autocomplete="off" />
        @if (q) { <button type="button" class="clear" (click)="clearQuery()" aria-label="Borrar texto">×</button> }
        <button class="btn" type="submit">Buscar</button>
      </form>

      <fieldset class="group enter">
        <legend class="sr-only">Región</legend>
        <div class="choices scroll">
          <label class="choice"><input type="radio" name="region" value="" [ngModel]="region" (ngModelChange)="setRegion($event)" /><span>Todas</span></label>
          @for (r of regions(); track r) {
            <label class="choice"><input type="radio" name="region" [value]="r" [ngModel]="region" (ngModelChange)="setRegion($event)" /><span>{{ r }}</span></label>
          }
        </div>
      </fieldset>
      <fieldset class="group enter">
        <legend class="sr-only">Tiempo</legend>
        <div class="choices scroll">
          @for (t of times; track t.value) {
            <label class="choice"><input type="radio" name="time" [value]="t.value" [ngModel]="maxMinutes ?? 0" (ngModelChange)="setTime($event)" /><span>{{ t.label }}</span></label>
          }
        </div>
      </fieldset>

      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <p class="count" aria-live="polite">
        @if (loading()) { Buscando… } @else if (items().length) { {{ items().length }} {{ items().length === 1 ? 'receta' : 'recetas' }} }
      </p>
      @if (!loading() && !items().length) {
        <div class="empty card">
          <span class="emo" aria-hidden="true">🥄</span>
          <p class="muted">No encontré recetas con esos filtros.</p>
          @if (q || region || maxMinutes) { <button type="button" class="btn secondary" (click)="reset()">Quitar filtros</button> }
        </div>
      }

      @if (loading() && !items().length) {
        <div class="grid" aria-hidden="true">
          @for (n of [1, 2, 3]; track n) { <div class="skeleton sk"></div> }
        </div>
      }
      <ul class="grid" [class.dim]="loading()">
        @for (r of items(); track r.slug) {
          <li>
            <a class="card recipe" [routerLink]="['/recetas', r.slug]">
              <h2>{{ r.title }}</h2>
              <p class="muted small">{{ r.summary }}</p>
              <div class="row">
                <span class="chip region">{{ r.region }}</span>
                <span class="chip">⏱️ {{ r.prepMinutes + r.cookMinutes }} min</span>
                <span class="chip">{{ difficulty[r.difficulty] }}</span>
                <span class="chip">{{ cost[r.costLevel] }}</span>
              </div>
            </a>
          </li>
        }
      </ul>
      <p class="muted small">Si registraste alergias o una alimentación sin carne, esas recetas no aparecen.</p>
      }

      @case ('favoritas') {
        @if (mineLoading()) {
          <div class="grid" aria-hidden="true"><div class="skeleton sk"></div><div class="skeleton sk"></div></div>
        } @else if (!favorites().length && !mineError()) {
          <div class="card empty-state enter">
            <span class="emo" aria-hidden="true">🤍</span>
            <p class="muted">Aún no tienes favoritas. Toca el corazón en una receta o pídele a tu asistente: “guárdala en mis favoritas”.</p>
            <button type="button" class="btn secondary" (click)="setView('catalogo')">Ver el catálogo</button>
          </div>
        }
        <ul class="grid">
          @for (r of favorites(); track r.slug) {
            <li>
              <a class="card recipe" [routerLink]="['/recetas', r.slug]">
                <h2>{{ r.title }}</h2>
                <p class="muted small">{{ r.summary }}</p>
                <div class="row">
                  <span class="chip region">{{ r.region }}</span>
                  <span class="chip">⏱️ {{ r.prepMinutes + r.cookMinutes }} min</span>
                  <span class="chip"><span aria-hidden="true">❤️</span> Favorita</span>
                </div>
              </a>
            </li>
          }
        </ul>
      }

      @case ('mias') {
        @if (mineLoading()) {
          <div class="grid" aria-hidden="true"><div class="skeleton sk"></div><div class="skeleton sk"></div></div>
        } @else if (!own().length && !mineError()) {
          <div class="card empty-state enter">
            <span class="emo" aria-hidden="true">📒</span>
            <p class="muted">Aquí quedan las recetas que inventen juntas. Pídele a tu asistente: “invéntame algo con lo que tengo”.</p>
            <a class="btn secondary" routerLink="/cocina">Ir a la cocina</a>
          </div>
        }
        <ul class="grid">
          @for (r of own(); track r.id) {
            <li>
              <a class="card recipe" [routerLink]="['/recetas/mias', r.id]">
                <h2>{{ r.title }}</h2>
                @if (r.summary) { <p class="muted small">{{ r.summary }}</p> }
                <div class="row">
                  <span class="chip">🍽️ {{ r.servings }} {{ r.servings === 1 ? 'porción' : 'porciones' }}</span>
                  @if (r.minutes) { <span class="chip">⏱️ {{ r.minutes }} min</span> }
                  @if (r.source === 'ASSISTANT') { <span class="chip region">✨ De tu asistente</span> }
                </div>
              </a>
            </li>
          }
        </ul>
      }

      @case ('planes') {
        @if (mineLoading()) {
          <div class="grid" aria-hidden="true"><div class="skeleton sk"></div></div>
        } @else if (!plans().length && !mineError()) {
          <div class="card empty-state enter">
            <span class="emo" aria-hidden="true">🗓️</span>
            <p class="muted">Todavía no tienes planes de comida. Pídele a tu asistente: “arma mi plan de la semana”.</p>
            <a class="btn secondary" routerLink="/cocina">Ir a la cocina</a>
          </div>
        }
        <ul class="grid">
          @for (p of plans(); track p.id) {
            <li>
              <a class="card recipe" [routerLink]="['/planes', p.id]">
                <h2>{{ p.title }}</h2>
                <div class="row">
                  <span class="chip region">🗓️ {{ p.days }} {{ p.days === 1 ? 'día' : 'días' }}</span>
                  <span class="chip">Creado el {{ p.createdAt | date: 'd MMM' }}</span>
                </div>
              </a>
            </li>
          }
        </ul>
      }
      }
      @if (mineError()) { <p class="error" role="alert">{{ mineError() }}</p> }
    </div>
  `,
  styles: `
    .count { margin: -4px 4px 0; min-height: 1.2em; font-size: 0.85rem; font-weight: 700; color: var(--text-2); }
    .grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); transition: opacity 0.2s; }
    .grid:empty { display: none; }
    .grid.dim { opacity: 0.55; }
    .grid li { animation: rise 0.3s var(--ease) both; }
    .grid li:nth-child(2) { animation-delay: 0.04s; }
    .grid li:nth-child(3) { animation-delay: 0.08s; }
    .grid li:nth-child(n + 4) { animation-delay: 0.12s; }
    .sk { height: 132px; border-radius: var(--radius); }
    .recipe {
      display: flex; flex-direction: column; gap: 6px; height: 100%; color: inherit; text-decoration: none;
      position: relative; overflow: hidden; padding-left: 20px;
      transition: transform 0.2s var(--ease), box-shadow 0.2s, border-color 0.2s;
    }
    .recipe::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--brand); }
    .grid li:nth-child(4n + 2) .recipe::before { background: var(--mango); }
    .grid li:nth-child(4n + 3) .recipe::before { background: var(--menta); }
    .grid li:nth-child(4n + 4) .recipe::before { background: var(--lavanda); }
    .recipe:hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); border-color: color-mix(in srgb, var(--brand) 30%, var(--line)); }
    .recipe:active { transform: scale(0.98); }
    .recipe:focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }
    .recipe h2 { font-size: 1.15rem; margin: 0; }
    .recipe p { margin: 0; flex: 1; }
    .chip.region { background: var(--brand-soft); color: var(--brand-strong); }
    .views > label > span { font-size: 0.8rem; padding: 6px 2px; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 28px 16px; }
    .empty .emo { font-size: 2.4rem; }
    .empty p { margin: 0; }
  `,
})
export class Recipes {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  /** Vista elegida, en la URL (?vista=…) para que "atrás" vuelva a la misma. */
  readonly vista = input<string>();
  protected readonly view = computed<View>(() => {
    const v = this.vista();
    return v === 'favoritas' || v === 'mias' || v === 'planes' ? v : 'catalogo';
  });
  protected readonly views: { value: View; label: string; emo: string }[] = [
    { value: 'catalogo', label: 'Catálogo', emo: '📖' },
    { value: 'favoritas', label: 'Favoritas', emo: '❤️' },
    { value: 'mias', label: 'Mis recetas', emo: '📒' },
    { value: 'planes', label: 'Planes', emo: '🗓️' },
  ];
  protected readonly favorites = signal<RecipeSummary[]>([]);
  protected readonly own = signal<UserRecipe[]>([]);
  protected readonly plans = signal<MealPlanSummary[]>([]);
  protected readonly mineLoading = signal(false);
  protected readonly mineError = signal('');
  private catalogLoaded = false;

  protected q = '';
  protected region = '';
  protected maxMinutes: number | undefined;
  protected readonly times = [
    { value: 0, label: 'Cualquier tiempo' },
    { value: 30, label: '⚡ Hasta 30 min' },
    { value: 60, label: 'Hasta 1 hora' },
    { value: 120, label: 'Hasta 2 horas' },
  ];
  protected readonly items = signal<RecipeSummary[]>([]);
  protected readonly regions = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly difficulty = DIFFICULTY_LABEL;
  protected readonly cost = COST_LABEL;
  /** Solo se pinta la respuesta de la búsqueda más reciente. */
  private seq = 0;

  constructor() {
    effect(() => {
      const v = this.view();
      untracked(() => void this.loadView(v));
    });
  }

  protected setView(v: View): void {
    void this.router.navigate([], { queryParams: { vista: v === 'catalogo' ? null : v }, replaceUrl: true });
  }

  private async loadView(v: View): Promise<void> {
    this.mineError.set('');
    if (v === 'catalogo') {
      if (this.catalogLoaded) return;
      this.catalogLoaded = true;
      void firstValueFrom(this.api.regions()).then((r) => this.regions.set(r)).catch(() => undefined);
      void this.search();
      return;
    }
    this.mineLoading.set(true);
    try {
      if (v === 'favoritas') this.favorites.set(await firstValueFrom(this.api.favorites()));
      else if (v === 'mias') this.own.set(await firstValueFrom(this.api.myRecipes()));
      else this.plans.set(await firstValueFrom(this.api.mealPlans()));
    } catch {
      this.mineError.set('No pude cargar esta sección. Intenta de nuevo.');
    } finally {
      this.mineLoading.set(false);
    }
  }

  protected setRegion(region: string): void {
    this.region = region;
    void this.search();
  }

  protected setTime(minutes: number): void {
    this.maxMinutes = Number(minutes) || undefined;
    void this.search();
  }

  protected clearQuery(): void {
    this.q = '';
    void this.search();
  }

  protected reset(): void {
    this.q = '';
    this.region = '';
    this.maxMinutes = undefined;
    void this.search();
  }

  async search(): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.error.set('');
    try {
      const found = await firstValueFrom(this.api.searchRecipes(this.q.trim(), this.region, this.maxMinutes));
      if (mine === this.seq) this.items.set(found);
    } catch {
      if (mine === this.seq) this.error.set('No pude cargar las recetas.');
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }
}
