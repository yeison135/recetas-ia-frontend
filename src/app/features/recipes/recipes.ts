import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { COST_LABEL, DIFFICULTY_LABEL, RecipeSummary } from '../../core/models';

@Component({
  selector: 'app-recipes',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page stack">
      <header class="page-head enter">
        <h1>Recetas</h1>
        <p>Sabores de todas las regiones de Colombia.</p>
      </header>
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
      <p class="muted small">Si registraste alergias, las recetas con esos ingredientes no aparecen.</p>
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
    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 28px 16px; }
    .empty .emo { font-size: 2.4rem; }
    .empty p { margin: 0; }
  `,
})
export class Recipes implements OnInit {
  private readonly api = inject(Api);

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

  ngOnInit(): void {
    void firstValueFrom(this.api.regions()).then((r) => this.regions.set(r)).catch(() => undefined);
    void this.search();
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
