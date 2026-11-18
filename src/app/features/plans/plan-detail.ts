import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { MealPlan } from '../../core/models';
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

@Component({
  selector: 'app-plan-detail',
  imports: [RouterLink, DatePipe, ShareButtons],
  template: `
    <div class="page stack">
      <a routerLink="/recetas" [queryParams]="{ vista: 'planes' }" class="back"><span aria-hidden="true">←</span> Planes</a>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

      @if (plan(); as p) {
        <header class="page-head enter">
          <h1>{{ p.title }}</h1>
          <p>{{ p.days.length }} {{ p.days.length === 1 ? 'día' : 'días' }} · creado el {{ p.createdAt | date: 'd MMM' }}</p>
        </header>

        <ol class="days">
          @for (d of p.days; track $index) {
            <li class="card stack day">
              <h2 class="card-title"><span class="ico" [class]="tint($index)" aria-hidden="true">{{ $index + 1 }}</span>{{ d.day }}</h2>
              <ul class="meals">
                @for (m of d.meals; track $index) {
                  <li>
                    <span class="m-ico" aria-hidden="true">{{ icon(m.moment) }}</span>
                    <div>
                      <span class="moment">{{ m.moment }}</span>
                      <strong>{{ m.dish }}</strong>
                      @if (m.note) { <span class="muted small">{{ m.note }}</span> }
                    </div>
                  </li>
                }
              </ul>
            </li>
          }
        </ol>

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
          <div class="skeleton" style="height: 160px"></div>
          <div class="skeleton" style="height: 160px"></div>
        </div>
      }
    </div>
  `,
  styles: `
    .days { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    .day { animation: rise 0.3s var(--ease) both; }
    .day:nth-child(2) { animation-delay: 0.04s; }
    .day:nth-child(n + 3) { animation-delay: 0.08s; }
    .day .ico { font-family: var(--font-display); font-weight: 600; color: var(--text); }
    .meals { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
    .meals li { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px dashed var(--line); }
    .meals li:last-child { border-bottom: 0; padding-bottom: 0; }
    .meals div { display: flex; flex-direction: column; gap: 2px; }
    .m-ico { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 12px; background: var(--surface-2); font-size: 1.1rem; }
    .moment { font-size: 0.8rem; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; color: var(--text-2); }
    .notes { margin: 0; white-space: pre-line; }
  `,
})
export class PlanDetailPage implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly plan = signal<MealPlan | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly icon = momentIcon;
  protected readonly shareText = computed(() => {
    const p = this.plan();
    return p ? mealPlanText(p) : '';
  });

  async ngOnInit(): Promise<void> {
    try {
      this.plan.set(await firstValueFrom(this.api.mealPlan(this.id())));
    } catch {
      this.error.set('No encontré ese plan.');
    }
  }

  protected tint(i: number): string {
    return ['', 'mango', 'menta', 'lavanda'][i % 4];
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
