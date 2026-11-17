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
      <h1>Recetas</h1>
      <form class="filters" (ngSubmit)="search()" role="search">
        <label class="sr-only" for="q">Buscar</label>
        <input id="q" name="q" [(ngModel)]="q" placeholder="Ajiaco, algo con plátano, sopa…" maxlength="200" />
        <div class="row">
          <select name="region" [(ngModel)]="region" (change)="search()" aria-label="Región">
            <option value="">Todas las regiones</option>
            @for (r of regions(); track r) { <option [value]="r">{{ r }}</option> }
          </select>
          <select name="time" [(ngModel)]="maxMinutes" (change)="search()" aria-label="Tiempo">
            <option [ngValue]="undefined">Cualquier tiempo</option>
            <option [ngValue]="30">Hasta 30 min</option>
            <option [ngValue]="60">Hasta 1 hora</option>
            <option [ngValue]="120">Hasta 2 horas</option>
          </select>
          <button class="btn" type="submit">Buscar</button>
        </div>
      </form>

      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (!loading() && !items().length) { <p class="muted">No encontré recetas con esos filtros.</p> }

      <ul class="grid">
        @for (r of items(); track r.slug) {
          <li>
            <a class="card recipe" [routerLink]="['/recetas', r.slug]">
              <h2>{{ r.title }}</h2>
              <p class="muted small">{{ r.summary }}</p>
              <div class="row">
                <span class="chip">{{ r.region }}</span>
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
    .filters { display: flex; flex-direction: column; gap: 8px; }
    .filters select { flex: 1; min-width: 140px; }
    .grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .recipe { display: flex; flex-direction: column; gap: 6px; height: 100%; color: inherit; text-decoration: none; }
    .recipe h2 { font-size: 1.1rem; margin: 0; }
    .recipe p { margin: 0; flex: 1; }
  `,
})
export class Recipes implements OnInit {
  private readonly api = inject(Api);

  protected q = '';
  protected region = '';
  protected maxMinutes: number | undefined;
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
