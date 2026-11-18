import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { AvatarKind, avatarInfo } from '../../core/avatars';
import { ProfileStore } from '../../core/profile-store';
import { AvatarPicker } from '../../shared/avatar-picker';
import { ALLERGENS, Allergy, Consent, CookedEntry, Preference, Profile } from '../../core/models';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, AvatarPicker],
  template: `
    <div class="page stack">
      <h1>Tu perfil</h1>
      @if (message()) { <p class="notice" role="status">{{ message() }}</p> }

      <section class="card stack">
        <h2>Tu asistente</h2>
        <app-avatar-picker [selected]="store.avatar()" (selectedChange)="changeAvatar($event)" />
      </section>

      @if (profile(); as p) {
        <form class="card stack" (ngSubmit)="saveProfile()">
          <h2>Sobre ti</h2>
          <label>Nombre <input name="name" [(ngModel)]="p.displayName" maxlength="80" required /></label>
          <div class="grid2">
            <label>Nivel en la cocina
              <select name="level" [(ngModel)]="p.cookingLevel">
                <option value="BEGINNER">Estoy aprendiendo</option>
                <option value="INTERMEDIATE">Me defiendo</option>
                <option value="ADVANCED">Cocino de todo</option>
              </select>
            </label>
            <label>Personas en casa <input name="household" type="number" min="1" max="20" [(ngModel)]="p.householdSize" /></label>
            <label>Presupuesto
              <select name="budget" [(ngModel)]="p.budgetLevel">
                <option value="LOW">Económico</option>
                <option value="MEDIUM">Medio</option>
                <option value="HIGH">Sin problema</option>
              </select>
            </label>
            <label>Ciudad <input name="city" [(ngModel)]="p.city" maxlength="80" placeholder="Pereira" /></label>
          </div>
          <button class="btn" type="submit">Guardar</button>
        </form>
      }

      <section class="card stack">
        <h2>Alergias e intolerancias</h2>
        @if (!healthConsent()) {
          <p class="muted">
            Las alergias son datos de salud (datos sensibles según la Ley 1581 de 2012). Para guardarlas y ocultarte
            recetas que te hagan daño necesitamos tu autorización expresa. Puedes retirarla cuando quieras y se
            borrarán tus alergias.
          </p>
          <button type="button" class="btn" (click)="grantHealth()">Autorizo el tratamiento de mis datos de salud</button>
        } @else {
          <ul class="list">
            @for (a of allergies(); track a.id) {
              <li class="row between">
                <span>{{ label(a.allergen) }} <span class="chip warn">{{ severity[a.severity] }}</span></span>
                <button type="button" class="btn ghost small" (click)="removeAllergy(a)">Quitar</button>
              </li>
            } @empty {
              <li class="muted">No has registrado alergias.</li>
            }
          </ul>
          <div class="row">
            <select name="newAllergen" [(ngModel)]="newAllergen" aria-label="Alérgeno">
              @for (a of available(); track a.code) { <option [value]="a.code">{{ a.label }}</option> }
            </select>
            <select name="newSeverity" [(ngModel)]="newSeverity" aria-label="Gravedad">
              <option value="INTOLERANCE">Intolerancia</option>
              <option value="ALLERGY">Alergia</option>
              <option value="SEVERE">Alergia grave</option>
            </select>
            <button type="button" class="btn" (click)="addAllergy()" [disabled]="!newAllergen">Agregar</button>
          </div>
          <p class="muted small">Igual revisa siempre las etiquetas: La Sazón ayuda, pero no reemplaza tu cuidado ni el de un médico.</p>
          <button type="button" class="btn danger small" (click)="revokeHealth()">Retirar autorización y borrar mis alergias</button>
        }
      </section>

      <section class="card stack">
        <h2>Lo que La Sazón recuerda de ti</h2>
        <ul class="list">
          @for (p of preferences(); track p.id) {
            <li class="row between">
              <span>{{ kind[p.kind] ?? p.kind }}: {{ p.value }}
                @if (p.source === 'ASSISTANT') { <span class="chip">lo anotó La Sazón</span> }
              </span>
              <button type="button" class="btn ghost small" (click)="removePreference(p)">Olvidar</button>
            </li>
          } @empty {
            <li class="muted">Todavía nada. Cuéntale tus gustos en la conversación.</li>
          }
        </ul>
      </section>

      <section class="card stack">
        <h2>Tus datos</h2>
        <div class="row">
          <button type="button" class="btn secondary" (click)="exportData()">Descargar mis datos</button>
          <button type="button" class="btn secondary" (click)="auth.logout()">Cerrar sesión</button>
        </div>
        <p class="muted small">El archivo incluye tus datos de salud (alergias): guárdalo en un lugar seguro.</p>
        @if (!confirmingDelete()) {
          <button type="button" class="btn danger" (click)="confirmingDelete.set(true)">Borrar mi cuenta y todos mis datos</button>
        } @else {
          <form class="stack danger-zone" (ngSubmit)="deleteAccount()">
            <p>Se borrarán tu cuenta, conversaciones, listas, preferencias y alergias. No se puede deshacer.</p>
            <label>Escribe tu contraseña para confirmar
              <input name="deletePassword" type="password" autocomplete="current-password" [(ngModel)]="deletePassword" maxlength="128" />
            </label>
            @if (deleteError()) { <p class="error" role="alert">{{ deleteError() }}</p> }
            <div class="row">
              <button type="submit" class="btn danger" [disabled]="!deletePassword">Borrar definitivamente</button>
              <button type="button" class="btn secondary" (click)="confirmingDelete.set(false)">Cancelar</button>
            </div>
          </form>
        }
      </section>
      @if (history().length) {
        <section class="card stack">
          <h2>Lo que has cocinado</h2>
          <ul class="list">
            @for (h of history(); track $index) {
              <li class="row between"><span>{{ h.title }}</span><span class="muted small">{{ h.rating ? '★'.repeat(h.rating) : '' }}</span></li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .between { justify-content: space-between; flex-wrap: nowrap; }
    .row select { flex: 1; min-width: 140px; }
    .danger-zone { border: 1px solid var(--danger); border-radius: var(--radius-sm); padding: 12px; }
    .danger-zone p { margin: 0; }
  `,
})
export class ProfilePage implements OnInit {
  private readonly api = inject(Api);
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(ProfileStore);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly consents = signal<Consent[]>([]);
  protected readonly allergies = signal<Allergy[]>([]);
  protected readonly preferences = signal<Preference[]>([]);
  protected readonly message = signal('');
  protected readonly history = signal<CookedEntry[]>([]);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleteError = signal('');
  protected deletePassword = '';
  protected newAllergen = '';
  protected newSeverity = 'ALLERGY';

  protected readonly healthConsent = computed(() => this.consents().some((c) => c.purpose === 'HEALTH_DATA'));
  protected readonly available = computed(() =>
    ALLERGENS.filter((a) => !this.allergies().some((x) => x.allergen === a.code)),
  );
  protected readonly severity: Record<string, string> = { INTOLERANCE: 'Intolerancia', ALLERGY: 'Alergia', SEVERE: 'Grave' };
  protected readonly kind: Record<string, string> = { LIKE: 'Le gusta', DISLIKE: 'No le gusta', DIET: 'Dieta', EQUIPMENT: 'Utensilios', NOTE: 'Nota' };

  async ngOnInit(): Promise<void> {
    const [p, c, prefs] = await Promise.all([
      firstValueFrom(this.api.profile()),
      firstValueFrom(this.api.consents()),
      firstValueFrom(this.api.preferences()),
    ]);
    this.profile.set(p);
    this.consents.set(c);
    this.preferences.set(prefs);
    void firstValueFrom(this.api.history()).then((h) => this.history.set(h)).catch(() => undefined);
    if (this.healthConsent()) await this.loadAllergies();
  }

  protected label(code: string): string {
    return ALLERGENS.find((a) => a.code === code)?.label ?? code;
  }

  protected async changeAvatar(kind: AvatarKind): Promise<void> {
    const p = this.profile();
    if (!p) return;
    const previous = this.store.avatar();
    this.store.avatar.set(kind);
    try {
      this.profile.set(await firstValueFrom(this.api.updateProfile({ ...p, avatar: kind })));
      this.flash(`Listo, ahora te acompaña ${avatarInfo(kind).name}.`);
    } catch {
      this.store.avatar.set(previous);
      this.flash('No pude cambiar el avatar.');
    }
  }

  protected async saveProfile(): Promise<void> {
    const p = this.profile();
    if (!p) return;
    try {
      this.profile.set(await firstValueFrom(this.api.updateProfile({ ...p, householdSize: Number(p.householdSize) })));
      this.flash('Perfil guardado.');
    } catch {
      this.flash('Revisa los datos del perfil.');
    }
  }

  protected async grantHealth(): Promise<void> {
    await firstValueFrom(this.api.grantConsent('HEALTH_DATA'));
    // Primero las alergias, luego el consentimiento: así el formulario aparece ya con su valor inicial.
    await this.loadAllergies();
    this.consents.set(await firstValueFrom(this.api.consents()));
  }

  protected async revokeHealth(): Promise<void> {
    if (!confirm('Se borrarán tus alergias registradas. ¿Continuar?')) return;
    await firstValueFrom(this.api.revokeConsent('HEALTH_DATA'));
    this.consents.set(await firstValueFrom(this.api.consents()));
    this.allergies.set([]);
    this.flash('Autorización retirada y alergias borradas.');
  }

  protected async addAllergy(): Promise<void> {
    if (!this.newAllergen) return;
    await firstValueFrom(this.api.addAllergy(this.newAllergen, this.newSeverity));
    this.newAllergen = '';
    await this.loadAllergies();
  }

  protected async removeAllergy(a: Allergy): Promise<void> {
    const grave = a.severity === 'SEVERE' ? ' Es una alergia GRAVE:' : '';
    if (!confirm(`¿Quitar ${this.label(a.allergen)}?${grave} las recetas con ese ingrediente volverán a aparecer.`)) return;
    await firstValueFrom(this.api.deleteAllergy(a.id));
    await this.loadAllergies();
  }

  protected async removePreference(p: Preference): Promise<void> {
    await firstValueFrom(this.api.deletePreference(p.id));
    this.preferences.update((ps) => ps.filter((x) => x.id !== p.id));
  }

  protected async exportData(): Promise<void> {
    try {
      const data = await firstValueFrom(this.api.exportData());
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mis-datos-la-sazon.json';
      a.click();
      // Se libera después: revocarlo de inmediato cancela la descarga en algunos navegadores.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.flash('No pude preparar tus datos. Intenta en un momento.');
    }
  }

  protected async deleteAccount(): Promise<void> {
    this.deleteError.set('');
    try {
      await firstValueFrom(this.api.deleteAccount(this.deletePassword));
    } catch (e) {
      this.deleteError.set(e instanceof HttpErrorResponse && e.status === 403
        ? 'La contraseña no es correcta.' : 'No pude borrar la cuenta. Intenta de nuevo.');
      return;
    }
    this.deletePassword = '';
    await this.auth.clear();
    location.assign('/entrar');
  }

  private async loadAllergies(): Promise<void> {
    this.allergies.set(await firstValueFrom(this.api.allergies()));
    this.newAllergen = this.available()[0]?.code ?? '';
  }

  private flash(text: string): void {
    this.message.set(text);
    setTimeout(() => this.message.set(''), 3000);
  }
}
