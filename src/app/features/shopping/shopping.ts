import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { kitchenQuantity } from '../../core/format';
import { ShoppingItem, ShoppingList, Store } from '../../core/models';

@Component({
  selector: 'app-shopping',
  imports: [DatePipe],
  template: `
    <div class="page stack">
      <h1>Mercado</h1>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (!lists().length && !loading()) {
        <p class="muted">Aún no tienes listas. Pídele a La Sazón "hazme la lista de mercado para…" o ábrela desde una receta.</p>
      }
      @for (l of lists(); track l.id) {
        <section class="card stack">
          <div class="row head">
            <div>
              <h2>{{ l.title }}</h2>
              <p class="muted small">{{ l.createdAt | date: 'd MMM, h:mm a' }} · {{ pending(l) }} por comprar</p>
            </div>
            <button type="button" class="btn ghost small" (click)="remove(l)" [attr.aria-label]="'Borrar ' + l.title">Borrar</button>
          </div>
          <ul class="items">
            @for (i of l.items; track i.id) {
              <li>
                <label class="item" [class.done]="i.checked">
                  <input type="checkbox" [checked]="i.checked" (change)="toggle(l, i)" />
                  <span>{{ i.label }}</span>
                  <span class="qty muted">{{ qty(i) }}</span>
                </label>
              </li>
            }
          </ul>
        </section>
      }

      <section class="stack">
        <h2>Dónde comprar</h2>
        <div class="row">
          @for (c of cities; track c) {
            <button type="button" class="btn small" [class.secondary]="city() !== c" (click)="loadStores(c)">{{ c }}</button>
          }
        </div>
        <ul class="stores">
          @for (s of stores(); track s.id) {
            <li class="card">
              <strong>{{ s.name }}</strong> <span class="chip">{{ kind[s.kind] }}</span>
              @if (s.address) { <p class="small">{{ s.address }}</p> }
              @if (s.notes) { <p class="muted small">{{ s.notes }}</p> }
            </li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: `
    .head { justify-content: space-between; align-items: flex-start; flex-wrap: nowrap; }
    .head h2 { margin: 0; font-size: 1.05rem; }
    .head p { margin: 2px 0 0; }
    .items, .stores { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .stores { gap: 8px; }
    .stores p { margin: 4px 0 0; }
    .item { flex-direction: row; align-items: center; gap: 10px; font-weight: 500; padding: 6px 0; border-bottom: 1px dashed var(--line); }
    .item input { width: 22px; height: 22px; min-height: 0; flex: none; accent-color: var(--accent); }
    .item span:first-of-type { flex: 1; }
    .item.done span { text-decoration: line-through; opacity: 0.6; }
    .qty { font-variant-numeric: tabular-nums; }
  `,
})
export class Shopping implements OnInit {
  private readonly api = inject(Api);

  protected readonly lists = signal<ShoppingList[]>([]);
  protected readonly stores = signal<Store[]>([]);
  protected readonly city = signal('Pereira');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly cities = ['Pereira', 'Dosquebradas'];
  protected readonly kind: Record<string, string> = { PLAZA: 'Plaza', SUPERMERCADO: 'Supermercado', TIENDA: 'Tienda' };

  async ngOnInit(): Promise<void> {
    void this.loadStores(this.city());
    try {
      this.lists.set(await firstValueFrom(this.api.shoppingLists()));
    } catch {
      this.error.set('No pude cargar tus listas.');
    } finally {
      this.loading.set(false);
    }
  }

  protected pending(l: ShoppingList): number {
    return l.items.filter((i) => !i.checked).length;
  }

  protected qty(i: ShoppingItem): string {
    return i.quantity === null ? '' : kitchenQuantity(i.quantity, i.unit);
  }

  protected async toggle(l: ShoppingList, i: ShoppingItem): Promise<void> {
    const checked = !i.checked;
    this.patch(l.id, i.id, checked);
    try {
      await firstValueFrom(this.api.checkItem(l.id, i.id, checked));
    } catch {
      this.patch(l.id, i.id, !checked);
    }
  }

  protected async remove(l: ShoppingList): Promise<void> {
    if (!confirm(`¿Borrar "${l.title}"?`)) return;
    await firstValueFrom(this.api.deleteShoppingList(l.id));
    this.lists.update((ls) => ls.filter((x) => x.id !== l.id));
  }

  protected async loadStores(city: string): Promise<void> {
    this.city.set(city);
    this.stores.set(await firstValueFrom(this.api.stores(city)).catch(() => []));
  }

  private patch(listId: string, itemId: string, checked: boolean): void {
    this.lists.update((ls) =>
      ls.map((l) => (l.id !== listId ? l : { ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, checked } : i)) })),
    );
  }
}
