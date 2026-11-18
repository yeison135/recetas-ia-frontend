import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { kitchenQuantity } from '../../core/format';
import { ShoppingItem, ShoppingList, Store } from '../../core/models';
import { ShoppingSection, groupByCategory, hasSections, shoppingListText } from '../../core/share';
import { ShareButtons } from '../../shared/share-buttons';

@Component({
  selector: 'app-shopping',
  imports: [DatePipe, ShareButtons],
  template: `
    <div class="page stack">
      <header class="page-head enter">
        <h1>Mercado</h1>
        <p>Tus listas y dónde conseguir todo.</p>
      </header>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (loading()) {
        <div class="skeleton sk" aria-hidden="true"></div>
      } @else if (!lists().length) {
        <div class="card empty enter">
          <span class="emo" aria-hidden="true">🧺</span>
          <p class="muted">Aún no tienes listas. Pídele a La Sazón "hazme la lista de mercado para…" o ábrela desde una receta.</p>
        </div>
      }
      @for (l of lists(); track l.id) {
        <section class="card stack list-card enter" [class.complete]="!pending(l)">
          <div class="head">
            <div>
              <h2>{{ l.title }}</h2>
              <p class="muted small">{{ l.createdAt | date: 'd MMM, h:mm a' }}</p>
            </div>
            <button type="button" class="btn ghost icon" (click)="remove(l)" [attr.aria-label]="'Borrar ' + l.title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
              </svg>
            </button>
          </div>
          <div class="status">
            <span class="small"><strong>{{ l.items.length - pending(l) }}</strong> de {{ l.items.length }} en el canasto
              @if (!pending(l)) { · ¡Listo! 🎉 }</span>
            <div class="progress" aria-hidden="true"><span [style.width.%]="progress(l)"></span></div>
          </div>
          @let secs = sections(l);
          @let titled = hasSections(secs);
          @for (s of secs; track s.name) {
            <div class="section" [class.titled]="titled">
              @if (titled) {
                <h3 class="sec-head" [class.all]="!pendingIn(s.items)">
                  <span class="sec-ico" aria-hidden="true">{{ sectionIcon[s.name] }}</span>
                  <span class="sec-name">{{ s.name }}</span>
                  <span class="sec-count" [attr.aria-label]="(s.items.length - pendingIn(s.items)) + ' de ' + s.items.length + ' en el canasto'">
                    {{ s.items.length - pendingIn(s.items) }}/{{ s.items.length }}
                  </span>
                </h3>
              }
              <ul class="items">
                @for (i of s.items; track i.id) {
                  <li>
                    <label class="item" [class.done]="i.checked">
                      <input type="checkbox" class="check" [checked]="i.checked" (change)="toggle(l, i)" />
                      <span class="name">{{ i.label }}</span>
                      <span class="qty">{{ qty(i) }}</span>
                    </label>
                  </li>
                }
              </ul>
            </div>
          }
          <app-share-buttons [subject]="l.title" [text]="shareText(l)" />
        </section>
      }

      <section class="stack enter">
        <h2 class="card-title"><span class="ico menta" aria-hidden="true">📍</span>Dónde comprar</h2>
        <fieldset class="group">
          <legend class="sr-only">Ciudad</legend>
          <div class="seg">
            @for (c of cities; track c) {
              <label><input type="radio" name="city" [value]="c" [checked]="city() === c" (change)="loadStores(c)" /><span>{{ c }}</span></label>
            }
          </div>
        </fieldset>
        <ul class="stores">
          @for (s of stores(); track s.id) {
            <li class="card store">
              <span class="kind-ico" [attr.data-kind]="s.kind" aria-hidden="true">{{ icon[s.kind] }}</span>
              <div>
                <div class="store-head"><strong>{{ s.name }}</strong> <span class="chip">{{ kind[s.kind] }}</span></div>
                @if (s.address) { <p class="small">{{ s.address }}</p> }
                @if (s.notes) { <p class="muted small">{{ s.notes }}</p> }
              </div>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: `
    .sk { height: 220px; border-radius: var(--radius); }
    .empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 28px 16px; }
    .empty .emo { font-size: 2.4rem; }
    .empty p { margin: 0; }
    .list-card { transition: border-color 0.3s; }
    .list-card.complete { border-color: color-mix(in srgb, var(--accent) 50%, var(--line)); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .head h2 { margin: 0; font-size: 1.15rem; }
    .head p { margin: 2px 0 0; }
    .head .btn { color: var(--text-2); }
    .head .btn:hover { color: var(--danger); }
    .status { display: flex; flex-direction: column; gap: 6px; }
    .items, .stores { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
    .stores { gap: 10px; }
    .stores p { margin: 2px 0 0; }
    .item {
      flex-direction: row; align-items: center; gap: 12px; min-height: 52px; padding: 6px 4px;
      font-weight: 600; border-bottom: 1px dashed var(--line); cursor: pointer; border-radius: 8px; transition: background-color 0.15s;
    }
    .item:hover { background: var(--surface-2); }
    li:last-child .item { border-bottom: 0; }
    .item .name { flex: 1; transition: color 0.2s, opacity 0.2s; }
    .item.done .name { text-decoration: line-through; text-decoration-thickness: 2px; color: var(--text-2); }
    .qty { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 0.88rem; color: var(--text-2); padding: 2px 10px; border-radius: 999px; background: var(--surface-2); }
    .qty:empty { display: none; }
    .item.done .qty { opacity: 0.6; }
    .section.titled + .section.titled { margin-top: 6px; }
    .sec-head { display: flex; align-items: center; gap: 10px; margin: 0 0 2px; padding: 6px 0; font-size: 1rem; border-bottom: 2px solid var(--line); }
    .sec-ico { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 10px; background: var(--surface-2); font-size: 1rem; }
    .sec-name { flex: 1; }
    .sec-count { font-family: var(--font); font-size: 0.82rem; font-weight: 800; padding: 2px 10px; border-radius: 999px; background: var(--surface-2); color: var(--text-2); font-variant-numeric: tabular-nums; transition: background-color 0.2s, color 0.2s; }
    .sec-head.all .sec-count { background: var(--accent-soft); color: var(--accent); }
    .store { display: flex; gap: 12px; align-items: flex-start; }
    .store-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .kind-ico { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 14px; font-size: 1.3rem; background: var(--accent-soft); }
    .kind-ico[data-kind='SUPERMERCADO'] { background: color-mix(in srgb, var(--lavanda) 35%, var(--surface)); }
    .kind-ico[data-kind='TIENDA'] { background: color-mix(in srgb, var(--mango) 40%, var(--surface)); }
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
  protected readonly icon: Record<string, string> = { PLAZA: '🥬', SUPERMERCADO: '🛒', TIENDA: '🏪' };

  protected progress(l: ShoppingList): number {
    return l.items.length ? ((l.items.length - this.pending(l)) / l.items.length) * 100 : 0;
  }

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
    return this.pendingIn(l.items);
  }

  protected pendingIn(items: ShoppingItem[]): number {
    return items.filter((i) => !i.checked).length;
  }

  /** Secciones del mercado en orden de recorrido; las listas sin categorías quedan en una sola sin título. */
  protected sections(l: ShoppingList): ShoppingSection[] {
    return groupByCategory(l.items);
  }

  protected readonly hasSections = hasSections;
  protected readonly sectionIcon: Record<string, string> = {
    'Frutas y verduras': '🥕',
    'Proteínas': '🍗',
    'Lácteos y huevos': '🥚',
    'Granos y cereales': '🌾',
    'Panadería': '🥖',
    'Despensa': '🫙',
    'Condimentos': '🧂',
    'Bebidas': '🧃',
    'Otros': '🛍️',
  };

  protected shareText(l: ShoppingList): string {
    return shoppingListText(l);
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
