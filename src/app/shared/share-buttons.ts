import { Component, computed, input, signal } from '@angular/core';

import { mailtoUrl, whatsappUrl } from '../core/share';

/**
 * Compartir sin servidor de correo: menú nativo del teléfono (Web Share API, si existe),
 * WhatsApp (wa.me) y correo (mailto). Recibe el texto ya armado con las funciones de core/share.ts.
 */
@Component({
  selector: 'app-share-buttons',
  template: `
    <div class="share" role="group" [attr.aria-label]="'Compartir ' + subject()">
      @if (canShare) {
        <button type="button" class="btn secondary" (click)="share()">
          <span aria-hidden="true">📤</span> Compartir
        </button>
      }
      <a class="btn secondary" [href]="whatsapp()" target="_blank" rel="noopener noreferrer">
        <span aria-hidden="true">💬</span> WhatsApp
      </a>
      <a class="btn secondary" [href]="mail()"><span aria-hidden="true">✉️</span> Correo</a>
    </div>
    @if (failed()) { <p class="error small" role="alert">No pude abrir el menú para compartir.</p> }
  `,
  styles: `
    :host { display: block; }
    .share { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
    .share .btn { padding: 10px 8px; font-size: 0.92rem; white-space: nowrap; }
    .error { margin: 6px 0 0; }
  `,
})
export class ShareButtons {
  /** Asunto del correo y título del menú de compartir. */
  readonly subject = input.required<string>();
  /** Texto completo (lista, receta o plan). */
  readonly text = input.required<string>();

  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  protected readonly failed = signal(false);
  protected readonly whatsapp = computed(() => whatsappUrl(this.text()));
  protected readonly mail = computed(() => mailtoUrl(this.subject(), this.text()));

  protected async share(): Promise<void> {
    this.failed.set(false);
    try {
      await navigator.share({ title: this.subject(), text: this.text() });
    } catch (e) {
      // Cerrar el menú sin elegir no es un error.
      if (!(e instanceof DOMException && e.name === 'AbortError')) this.failed.set(true);
    }
  }
}
