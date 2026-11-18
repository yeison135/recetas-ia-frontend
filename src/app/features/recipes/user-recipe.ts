import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { kitchenQuantity } from '../../core/format';
import { UserRecipe, UserRecipeIngredient } from '../../core/models';
import { userRecipeText } from '../../core/share';
import { ShareButtons } from '../../shared/share-buttons';

/** Detalle de una receta propia (inventada con la asistente o escrita por la persona). */
@Component({
  selector: 'app-user-recipe',
  imports: [RouterLink, DatePipe, ShareButtons],
  template: `
    <div class="page stack">
      <a routerLink="/recetas" [queryParams]="{ vista: 'mias' }" class="back"><span aria-hidden="true">←</span> Mis recetas</a>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

      @if (recipe(); as r) {
        <header class="enter">
          <span class="chip src">{{ r.source === 'ASSISTANT' ? '✨ Inventada con tu asistente' : '✍️ Escrita por ti' }}</span>
          <h1>{{ r.title }}</h1>
          @if (r.summary) { <p class="muted">{{ r.summary }}</p> }
          <dl class="facts">
            <div><dt>Porciones</dt><dd>{{ r.servings }}</dd></div>
            <div><dt>Tiempo</dt><dd>{{ r.minutes ? r.minutes + ' min' : '—' }}</dd></div>
            <div><dt>Guardada</dt><dd>{{ r.createdAt | date: 'd MMM' }}</dd></div>
          </dl>
          @if (r.tags.length) {
            <div class="row">@for (t of r.tags; track t) { <span class="chip">{{ t }}</span> }</div>
          }
        </header>

        <section class="card stack enter">
          <h2 class="card-title"><span class="ico mango" aria-hidden="true">🧺</span>Ingredientes</h2>
          <ul class="ingredients">
            @for (i of r.ingredients; track $index) {
              <li><span class="qty">{{ quantity(i) }}</span><span>{{ i.name }}</span></li>
            }
          </ul>
        </section>

        <section class="stack enter">
          <h2 class="card-title"><span class="ico menta" aria-hidden="true">🔥</span>Preparación</h2>
          <ol class="steps">
            @for (s of r.steps; track $index) {
              <li class="card"><span class="num" aria-hidden="true">{{ $index + 1 }}</span><div><p>{{ s }}</p></div></li>
            }
          </ol>
        </section>

        <section class="card stack enter">
          <h2 class="card-title"><span class="ico" aria-hidden="true">📤</span>Compártela</h2>
          <app-share-buttons [subject]="r.title" [text]="shareText()" />
        </section>

        <button type="button" class="btn danger" (click)="remove(r)" [disabled]="busy()">
          @if (busy()) { <span class="spinner" aria-hidden="true"></span> }
          Borrar esta receta
        </button>
      } @else if (!error()) {
        <div class="stack" aria-hidden="true">
          <div class="skeleton" style="height: 40px; width: 70%"></div>
          <div class="skeleton" style="height: 64px"></div>
          <div class="skeleton" style="height: 220px"></div>
        </div>
      }
    </div>
  `,
  styles: `
    header h1 { font-size: 1.9rem; margin: 8px 0 4px; }
    header > p { margin: 0 0 12px; }
    .src { background: var(--brand-soft); color: var(--brand-strong); }
    .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 0 10px; }
    .facts div { padding: 10px 6px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--line); text-align: center; }
    .facts dt { font-size: 0.72rem; font-weight: 700; color: var(--text-2); }
    .facts dd { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; }
  `,
})
export class UserRecipePage implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly recipe = signal<UserRecipe | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly shareText = computed(() => {
    const r = this.recipe();
    return r ? userRecipeText(r) : '';
  });

  async ngOnInit(): Promise<void> {
    try {
      this.recipe.set(await firstValueFrom(this.api.myRecipe(this.id())));
    } catch {
      this.error.set('No encontré esa receta.');
    }
  }

  protected quantity(i: UserRecipeIngredient): string {
    return kitchenQuantity(i.quantity, i.unit);
  }

  protected async remove(r: UserRecipe): Promise<void> {
    if (!confirm(`¿Borrar "${r.title}" de tus recetas? No se puede deshacer.`)) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteRecipe(r.id));
      await this.router.navigate(['/recetas'], { queryParams: { vista: 'mias' } });
    } catch {
      this.error.set('No pude borrar la receta. Intenta de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
}
