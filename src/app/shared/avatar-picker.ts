import { Component, input, output } from '@angular/core';

import { AVATARS, AvatarKind } from '../core/avatars';
import { Avatar } from './avatar';

/** Tarjetas para elegir el avatar de la asistente (registro y perfil). */
@Component({
  selector: 'app-avatar-picker',
  imports: [Avatar],
  template: `
    <div class="grid" role="radiogroup" aria-label="Asistente">
      @for (a of avatars; track a.id) {
        <button type="button" class="card" role="radio" [attr.aria-checked]="selected() === a.id"
          [class.selected]="selected() === a.id" (click)="selectedChange.emit(a.id)">
          <app-avatar [kind]="a.id" [state]="selected() === a.id ? 'speaking' : 'idle'" [size]="78" />
          <strong>{{ a.name }}</strong>
          <span>{{ a.tagline }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .card {
      display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
      padding: 14px 8px 12px; border-radius: 20px; border: 2px solid var(--line); background: var(--surface);
      font: inherit; color: var(--text); cursor: pointer; transition: border-color 0.15s, transform 0.15s, background 0.15s;
    }
    .card:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); }
    .card strong { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; margin-top: 6px; }
    .card span { font-size: 0.78rem; color: var(--text-2); line-height: 1.3; }
    .card.selected { border-color: var(--brand); background: var(--brand-soft); transform: translateY(-2px); }
  `,
})
export class AvatarPicker {
  protected readonly avatars = AVATARS;
  readonly selected = input<AvatarKind>('robot');
  readonly selectedChange = output<AvatarKind>();
}
