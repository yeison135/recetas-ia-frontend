import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { kitchenQuantity } from '../../core/format';
import { Meal, MealPlan, PlanIngredient } from '../../core/models';
import { addDays, isoDate, longDate, parseIsoDate, shortDay } from '../../core/plan-dates';
import { mealPlanText } from '../../core/share';
import { ShareButtons } from '../../shared/share-buttons';

/** Ícono según el momento del día (el momento es texto libre que escribe la asistente). */
function momentIcon(moment: string): string {
  const m = moment.toLowerCase();
  if (m.includes('desayuno')) return '🌅';
  if (m.includes('almuerzo')) return '🍲';
  if (m.includes('cena') || m.includes('comida')) return '🌙';
  return '🍎';
}

/** Orden del día para alinear las filas del calendario (los planes viejos pueden traer otros momentos). */
function momentRank(moment: string): number {
  const m = moment.toLowerCase();
  if (m.includes('desayuno')) return 0;
  if (m.includes('mañana') || m.includes('nueves')) return 1;
  if (m.includes('almuerzo')) return 2;
  if (m.includes('onces') || m.includes('merienda') || m.includes('tarde')) return 3;
  if (m.includes('cena')) return 4;
  return 5;
}

interface DayColumn {
  /** Etiqueta corta del chip ("Mar" y "17") o el nombre del día si el plan no trae fecha. */
  abbr: string;
  num: string;
  /** "Martes 17 de noviembre" o "Martes". */
  long: string;
  today: boolean;
  /** Una celda por fila (momento); null si ese día no tiene esa comida. */
  cells: (Meal | null)[];
}

@Component({
  selector: 'app-plan-detail',
  imports: [RouterLink, DatePipe, ShareButtons],
  template: `
    <div class="page stack wide">
      <a routerLink="/recetas" [queryParams]="{ vista: 'planes' }" class="back"><span aria-hidden="true">←</span> Planes</a>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

      @if (plan(); as p) {
        <header class="page-head enter">
          <h1>{{ p.title }}</h1>
          <p>
            {{ p.days.length }} {{ p.days.length === 1 ? 'día' : 'días' }}
            @if (start(); as s) { · desde el {{ long(s) }} } @else { · creado el {{ p.createdAt | date: 'd MMM' }} }
            @if (p.householdSize) { · para {{ p.householdSize }} {{ p.householdSize === 1 ? 'persona' : 'personas' }} }
          </p>
        </header>

        @if (hasIngredients()) {
          <button type="button" class="btn block enter" (click)="shoppingList(p)" [disabled]="listBusy()">
            @if (listBusy()) { <span class="spinner" aria-hidden="true"></span> Armando la lista… }
            @else { <span aria-hidden="true">🧺</span> Lista de mercado de la semana }
          </button>
        }

        <fieldset class="group strip enter">
          <legend class="sr-only">Día</legend>
          <div class="choices scroll">
            @for (c of columns(); track $index) {
              <label class="choice day-chip" [class.today]="c.today">
                <input type="radio" name="plan-day" [checked]="selected() === $index" (change)="selected.set($index)" />
                <span>
                  <span class="sr-only">{{ c.long }}{{ c.today ? ', hoy' : '' }}</span>
                  <small aria-hidden="true">{{ c.abbr }}</small>
                  @if (c.num) { <strong aria-hidden="true">{{ c.num }}</strong> }
                </span>
              </label>
            }
          </div>
        </fieldset>

        <div class="cal enter" [style.--cols]="columns().length" [style.--rows]="rows().length + 1">
          @for (c of columns(); track $index; let di = $index) {
            <section class="col" [class.sel]="selected() === di" [class.today]="c.today" [attr.aria-labelledby]="'day-' + di">
              <h2 class="col-head" [id]="'day-' + di">
                {{ c.long }} @if (c.today) { <span class="chip hoy">Hoy</span> }
              </h2>
              @for (m of c.cells; track $index) {
                @if (m) {
                  <article class="card meal">
                    <div class="m-top">
                      <span class="m-ico" aria-hidden="true">{{ icon(m.moment) }}</span>
                      <span class="moment">{{ m.moment }}</span>
                    </div>
                    <h3>{{ m.dish }}</h3>
                    @if (m.cuisine) { <span class="chip cuisine"><span aria-hidden="true">🌎</span> {{ m.cuisine }}</span> }
                    @if (m.note) { <p class="muted small">{{ m.note }}</p> }
                    @if (m.ingredients?.length) {
                      <details>
                        <summary>Ingredientes ({{ m.ingredients!.length }})</summary>
                        <ul class="ing">
                          @for (i of m.ingredients!; track $index) {
                            <li><span>{{ i.name }}</span><span class="qty">{{ qty(i) }}</span></li>
                          }
                        </ul>
                      </details>
                    }
                    <button type="button" class="btn secondary small see" (click)="askRecipe(m)" [attr.aria-label]="'Ver receta de ' + m.dish">
                      <span aria-hidden="true">👩‍🍳</span> Ver receta
                    </button>
                  </article>
                } @else {
                  <div class="meal none" aria-hidden="true"></div>
                }
              }
            </section>
          }
        </div>

        @if (p.notes) {
          <section class="card stack enter">
            <h2 class="card-title"><span class="ico menta" aria-hidden="true">📝</span>Notas</h2>
            <p class="notes">{{ p.notes }}</p>
          </section>
        }
        <p class="muted small">La Sazón da sugerencias de cocina; no reemplaza a tu médico o nutricionista.</p>

        <section class="card stack enter">
          <h2 class="card-title"><span class="ico" aria-hidden="true">📤</span>Compártelo</h2>
          <app-share-buttons [subject]="p.title" [text]="shareText()" />
        </section>

        <button type="button" class="btn danger" (click)="remove(p)" [disabled]="busy()">
          @if (busy()) { <span class="spinner" aria-hidden="true"></span> }
          Borrar este plan
        </button>
      } @else if (!error()) {
        <div class="stack" aria-hidden="true">
          <div class="skeleton" style="height: 40px; width: 70%"></div>
          <div class="skeleton" style="height: 56px"></div>
          <div class="skeleton" style="height: 160px"></div>
          <div class="skeleton" style="height: 160px"></div>
        </div>
      }
    </div>
  `,
  styles: `
    .day-chip > span { flex-direction: column; gap: 0; min-width: 60px; min-height: 60px; padding: 6px 12px; border-radius: 18px; line-height: 1.1; }
    .day-chip small { font-size: 0.8rem; font-weight: 700; }
    .day-chip strong { font-family: var(--font-display); font-size: 1.3rem; font-weight: 600; }
    .day-chip.today > span { border-color: var(--mango); border-width: 2.5px; }
    .day-chip.today > span::after { content: ''; width: 6px; height: 6px; margin-top: 3px; border-radius: 50%; background: currentColor; }
    .cal { display: flex; flex-direction: column; gap: 12px; }
    .col { display: flex; flex-direction: column; gap: 12px; }
    .col:not(.sel) { display: none; }
    .col-head { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.2rem; }
    .chip.hoy { background: color-mix(in srgb, var(--mango) 45%, var(--surface)); color: var(--text); font-weight: 800; }
    .chip.cuisine { align-self: flex-start; background: var(--accent-soft); color: var(--accent); }
    .meal { display: flex; flex-direction: column; gap: 8px; animation: rise 0.3s var(--ease) both; }
    .meal.none { display: none; }
    .meal h3 { margin: 0; font-size: 1.1rem; line-height: 1.3; }
    .meal p { margin: 0; }
    .m-top { display: flex; align-items: center; gap: 10px; }
    .m-ico { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 12px; background: var(--surface-2); font-size: 1.1rem; }
    .moment { font-size: 0.8rem; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; color: var(--text-2); }
    details { border-top: 1px dashed var(--line); }
    summary { display: flex; align-items: center; min-height: 44px; font-weight: 700; cursor: pointer; border-radius: 8px; list-style: none; }
    summary::-webkit-details-marker { display: none; }
    summary::after { content: '▾'; margin-left: auto; padding: 0 4px; color: var(--text-2); transition: transform 0.2s var(--ease); }
    details[open] summary::after { transform: rotate(180deg); }
    summary:focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }
    .ing { list-style: none; padding: 0 0 6px; margin: 0; display: flex; flex-direction: column; gap: 4px; font-size: 0.92rem; }
    .ing li { display: flex; justify-content: space-between; gap: 8px; }
    .qty { flex: none; font-weight: 700; font-size: 0.85rem; color: var(--text-2); font-variant-numeric: tabular-nums; }
    .see { align-self: flex-start; margin-top: auto; }
    .notes { margin: 0; white-space: pre-line; }

    /* Escritorio: cuadrícula días × momentos; las filas se alinean con subgrid. */
    @media (min-width: 900px) {
      .page.wide { max-width: 1240px; }
      .strip { display: none; }
      .cal { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); grid-template-rows: repeat(var(--rows), auto); gap: 12px; }
      .col, .col:not(.sel) { display: grid; grid-row: span var(--rows); grid-template-rows: subgrid; gap: 12px; }
      .col-head { font-size: 1.05rem; padding: 8px 12px; border-radius: var(--radius-sm); background: var(--surface-2); }
      .col.today .col-head { background: color-mix(in srgb, var(--mango) 40%, var(--surface)); }
      .col.today .meal { border-color: color-mix(in srgb, var(--mango) 70%, var(--line)); }
      .meal { padding: 14px; }
      .meal h3 { font-size: 1rem; }
      .meal.none { display: block; border: 1.5px dashed var(--line); border-radius: var(--radius); }
    }
  `,
})
export class PlanDetailPage implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly plan = signal<MealPlan | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly listBusy = signal(false);
  protected readonly selected = signal(0);
  protected readonly icon = momentIcon;
  protected readonly long = longDate;
  protected readonly shareText = computed(() => {
    const p = this.plan();
    return p ? mealPlanText(p) : '';
  });

  protected readonly start = computed(() => parseIsoDate(this.plan()?.startDate));
  protected readonly hasIngredients = computed(() =>
    !!this.plan()?.days.some((d) => d.meals.some((m) => m.ingredients?.length)),
  );

  /** Momentos del plan en orden del día (filas del calendario). */
  protected readonly rows = computed(() => {
    const all = new Set((this.plan()?.days ?? []).flatMap((d) => d.meals.map((m) => m.moment)));
    return [...all].sort((a, b) => momentRank(a) - momentRank(b));
  });

  protected readonly columns = computed<DayColumn[]>(() => {
    const p = this.plan();
    if (!p) return [];
    const start = this.start();
    const today = isoDate(new Date());
    return p.days.map((d, i) => {
      const date = start ? addDays(start, i) : null;
      const [abbr, num] = date ? shortDay(date).split(' ') : [d.day || `Día ${i + 1}`, ''];
      return {
        abbr,
        num,
        long: date ? `${d.day} ${longDate(date)}` : d.day || `Día ${i + 1}`,
        today: !!date && isoDate(date) === today,
        cells: this.rows().map((r) => d.meals.find((m) => m.moment === r) ?? null),
      };
    });
  });

  async ngOnInit(): Promise<void> {
    try {
      this.plan.set(await firstValueFrom(this.api.mealPlan(this.id())));
      // Si hoy cae dentro del plan, se abre en hoy.
      const t = this.columns().findIndex((c) => c.today);
      if (t >= 0) this.selected.set(t);
    } catch {
      this.error.set('No encontré ese plan.');
    }
  }

  protected qty(i: PlanIngredient): string {
    return kitchenQuantity(i.quantity, i.unit);
  }

  /** Abre la cocina y le pide a la asistente la receta del plato para las personas del hogar. */
  protected async askRecipe(m: Meal): Promise<void> {
    let n = this.plan()?.householdSize ?? null;
    if (!n) n = await firstValueFrom(this.api.profile()).then((p) => p.householdSize).catch(() => null);
    const people = n ? ` para ${n} ${n === 1 ? 'persona' : 'personas'}` : '';
    await this.router.navigate(['/cocina'], { queryParams: { pregunta: `Dame la receta paso a paso de ${m.dish}${people}` } });
  }

  protected async shoppingList(p: MealPlan): Promise<void> {
    this.listBusy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.planShoppingList(p.id));
      await this.router.navigate(['/mercado']);
    } catch (e) {
      this.error.set(
        e instanceof HttpErrorResponse && e.status === 400
          ? 'Este plan no trae ingredientes, así que no puedo armar la lista.'
          : 'No pude armar la lista de mercado. Intenta de nuevo.',
      );
    } finally {
      this.listBusy.set(false);
    }
  }

  protected async remove(p: MealPlan): Promise<void> {
    if (!confirm(`¿Borrar el plan "${p.title}"? No se puede deshacer.`)) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteMealPlan(p.id));
      await this.router.navigate(['/recetas'], { queryParams: { vista: 'planes' } });
    } catch {
      this.error.set('No pude borrar el plan. Intenta de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
}
