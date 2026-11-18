import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { Api } from '../../core/api';
import { AuthService } from '../../core/auth';
import { AvatarKind, avatarInfo } from '../../core/avatars';
import { ProfileStore } from '../../core/profile-store';
import { AvatarPicker } from '../../shared/avatar-picker';
import { ALLERGENS, Allergy, Consent, CookedEntry, HEALTH_CONDITIONS, Preference, Profile } from '../../core/models';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, AvatarPicker],
  template: `
    <div class="page stack">
      <header class="page-head enter">
        <h1>Tu perfil</h1>
        <p>{{ profile()?.displayName ? 'Hola, ' + profile()!.displayName + '. ' : '' }}Así La Sazón cocina a tu medida.</p>
      </header>
      <div class="toast-host" role="status" aria-live="polite">
        @if (message()) { <p class="toast" [class.ok]="messageOk()">{{ message() }}</p> }
      </div>

      <section class="card stack enter">
        <h2 class="card-title"><span class="ico lavanda" aria-hidden="true">✨</span>Tu asistente</h2>
        <app-avatar-picker [selected]="store.avatar()" (selectedChange)="changeAvatar($event)" />
      </section>

      @if (profile(); as p) {
        <form class="card stack enter" (ngSubmit)="saveProfile()">
          <h2 class="card-title"><span class="ico mango" aria-hidden="true">🧑‍🍳</span>Sobre ti</h2>
          <div class="field">
            <input id="pf-name" name="name" [(ngModel)]="p.displayName" (ngModelChange)="edited()" placeholder=" "
              maxlength="80" required autocomplete="given-name" />
            <label for="pf-name">Nombre</label>
          </div>
          <div class="field">
            <input id="pf-city" name="city" [(ngModel)]="p.city" (ngModelChange)="edited()" placeholder=" "
              maxlength="80" autocomplete="address-level2" aria-describedby="pf-city-hint" />
            <label for="pf-city">Ciudad</label>
            <span class="hint" id="pf-city-hint">Para recomendarte dónde comprar. Ej.: Pereira</span>
          </div>

          <fieldset class="group">
            <legend>Nivel en la cocina</legend>
            <div class="seg">
              @for (o of levels; track o.value) {
                <label><input type="radio" name="level" [value]="o.value" [(ngModel)]="p.cookingLevel" (ngModelChange)="edited()" />
                  <span><span class="emo" aria-hidden="true">{{ o.emo }}</span>{{ o.label }}</span></label>
              }
            </div>
          </fieldset>

          <fieldset class="group">
            <legend>Presupuesto para el mercado</legend>
            <div class="seg">
              @for (o of budgets; track o.value) {
                <label><input type="radio" name="budget" [value]="o.value" [(ngModel)]="p.budgetLevel" (ngModelChange)="edited()" />
                  <span><span class="emo" aria-hidden="true">{{ o.emo }}</span>{{ o.label }}</span></label>
              }
            </div>
          </fieldset>

          <div class="household">
            <div>
              <span class="group-label" id="pf-household">Personas en casa</span>
              <span class="muted small">Ajusta las porciones de las recetas.</span>
            </div>
            <div class="stepper" role="group" aria-labelledby="pf-household">
              <button type="button" class="btn secondary icon" (click)="household(p, -1)" [disabled]="p.householdSize <= 1" aria-label="Menos personas">−</button>
              <strong aria-live="polite">{{ p.householdSize }}</strong>
              <button type="button" class="btn secondary icon" (click)="household(p, 1)" [disabled]="p.householdSize >= 20" aria-label="Más personas">+</button>
            </div>
          </div>

          <button class="btn block" type="submit" [class.saved]="saveState() === 'saved'" [disabled]="saveState() === 'saving'">
            @switch (saveState()) {
              @case ('saving') { <span class="spinner" aria-hidden="true"></span> Guardando… }
              @case ('saved') { ✓ ¡Guardado! }
              @default { {{ dirty() ? 'Guardar cambios' : 'Guardar' }} }
            }
          </button>
        </form>

        <form class="card stack enter" (ngSubmit)="saveDiet()">
          <h2 class="card-title"><span class="ico menta" aria-hidden="true">🥗</span>Tu alimentación</h2>
          <fieldset class="group">
            <legend>Tipo de alimentación</legend>
            <div class="seg two">
              @for (o of diets; track o.value) {
                <label><input type="radio" name="diet" [value]="o.value" [(ngModel)]="p.dietType" (ngModelChange)="dietEdited()" />
                  <span><span class="emo" aria-hidden="true">{{ o.emo }}</span>{{ o.label }}</span></label>
              }
            </div>
          </fieldset>
          <fieldset class="group">
            <legend>Tu objetivo</legend>
            <div class="choices">
              @for (o of goals; track o.value) {
                <label class="choice"><input type="radio" name="goal" [value]="o.value" [(ngModel)]="p.goal" (ngModelChange)="dietEdited()" />
                  <span><span aria-hidden="true">{{ o.emo }}</span>{{ o.label }}</span></label>
              }
            </div>
          </fieldset>
          <p class="muted small">Tu asistente lo tiene en cuenta al sugerirte platos y planes. El catálogo oculta las recetas con carne o pescado si no las comes.</p>
          <button class="btn block" type="submit" [class.saved]="dietState() === 'saved'" [disabled]="dietState() === 'saving'">
            @switch (dietState()) {
              @case ('saving') { <span class="spinner" aria-hidden="true"></span> Guardando… }
              @case ('saved') { ✓ ¡Guardado! }
              @default { {{ dietDirty() ? 'Guardar cambios' : 'Guardar' }} }
            }
          </button>
        </form>
      } @else {
        <div class="card stack" aria-hidden="true">
          <div class="skeleton" style="height: 38px; width: 50%"></div>
          <div class="skeleton" style="height: 56px"></div>
          <div class="skeleton" style="height: 56px"></div>
          <div class="skeleton" style="height: 56px"></div>
        </div>
      }

      <section class="card stack enter">
        <h2 class="card-title"><span class="ico" aria-hidden="true">🛡️</span>Tu salud</h2>
        @if (!healthConsent()) {
          <div class="consent">
            <p>
              Las alergias y condiciones de salud son <strong>datos de salud</strong> (datos sensibles según la Ley 1581 de 2012). Para guardarlas y
              ocultarte recetas que te hagan daño o adaptar las sugerencias necesitamos tu autorización expresa.
            </p>
            <p class="muted small">Puedes retirarla cuando quieras y se borrarán tus alergias y condiciones.</p>
          </div>
          <button type="button" class="btn block" (click)="grantHealth()" [disabled]="busy() === 'consent'">
            @if (busy() === 'consent') { <span class="spinner" aria-hidden="true"></span> }
            Autorizo el tratamiento de mis datos de salud
          </button>
        } @else {
          <h3 class="sub">Alergias e intolerancias</h3>
          <ul class="rows list">
            @for (a of allergies(); track a.id) {
              <li>
                <span class="item-text">{{ label(a.allergen) }} <span class="chip sev" [attr.data-sev]="a.severity">{{ severity[a.severity] }}</span></span>
                <button type="button" class="btn ghost small" (click)="removeAllergy(a)" [attr.aria-label]="'Quitar ' + label(a.allergen)">Quitar</button>
              </li>
            } @empty {
              <li class="empty">No has registrado alergias. Agrega la primera aquí abajo.</li>
            }
          </ul>
          @if (available().length) {
            <div class="add-box stack">
              <fieldset class="group">
                <legend>Alérgeno</legend>
                <div class="choices">
                  @for (a of available(); track a.code) {
                    <label class="choice"><input type="radio" name="newAllergen" [value]="a.code" [(ngModel)]="newAllergen" /><span>{{ a.label }}</span></label>
                  }
                </div>
              </fieldset>
              <fieldset class="group">
                <legend>Gravedad</legend>
                <div class="seg">
                  @for (o of severities; track o.value) {
                    <label><input type="radio" name="newSeverity" [value]="o.value" [(ngModel)]="newSeverity" /><span>{{ o.label }}</span></label>
                  }
                </div>
              </fieldset>
              <button type="button" class="btn block" (click)="addAllergy()" [disabled]="!newAllergen || busy() === 'allergy'">
                @if (busy() === 'allergy') { <span class="spinner" aria-hidden="true"></span> }
                Agregar
              </button>
            </div>
          }
          <p class="muted small">Igual revisa siempre las etiquetas: La Sazón ayuda, pero no reemplaza tu cuidado ni el de un médico.</p>

          <fieldset class="group conditions">
            <legend class="sub">Condiciones de salud</legend>
            <p class="muted small">Marca las que apliquen y tu asistente adaptará sus sugerencias.</p>
            <div class="choices">
              @for (c of conditionList; track c.code) {
                <label class="choice"><input type="checkbox" [checked]="hasCondition(c.code)" [disabled]="busyCondition() === c.code"
                  (change)="toggleCondition(c.code, c.label)" /><span>{{ c.label }}</span></label>
              }
            </div>
          </fieldset>
          <p class="notice"><span aria-hidden="true">🩺</span> La Sazón da sugerencias de cocina; no reemplaza a tu médico o nutricionista.</p>
          <button type="button" class="btn danger small" (click)="revokeHealth()">Retirar autorización y borrar mis datos de salud</button>
        }
      </section>

      <section class="card stack enter">
        <h2 class="card-title"><span class="ico menta" aria-hidden="true">🧠</span>Lo que La Sazón recuerda de ti</h2>
        <ul class="rows list">
          @for (p of preferences(); track p.id) {
            <li>
              <span class="item-text"><span class="kind">{{ kind[p.kind] ?? p.kind }}</span> {{ p.value }}
                @if (p.source === 'ASSISTANT') { <span class="chip">lo anotó La Sazón</span> }
              </span>
              <button type="button" class="btn ghost small" (click)="removePreference(p)" [attr.aria-label]="'Olvidar ' + p.value">Olvidar</button>
            </li>
          } @empty {
            <li class="empty">Todavía nada. Cuéntale tus gustos en la conversación.</li>
          }
        </ul>
      </section>

      @if (history().length) {
        <section class="card stack enter">
          <h2 class="card-title"><span class="ico mango" aria-hidden="true">🍲</span>Lo que has cocinado</h2>
          <ul class="rows list">
            @for (h of history(); track $index) {
              <li>
                <span class="item-text">{{ h.title }}</span>
                @if (h.rating) { <span class="stars" [attr.aria-label]="h.rating + ' de 5 estrellas'">{{ '★'.repeat(h.rating) }}</span> }
              </li>
            }
          </ul>
        </section>
      }

      <section class="card stack enter">
        <h2 class="card-title"><span class="ico lavanda" aria-hidden="true">🔐</span>Tus datos</h2>
        <div class="actions2">
          <button type="button" class="btn secondary" (click)="exportData()"><span aria-hidden="true">⬇️</span> Descargar mis datos</button>
          <button type="button" class="btn secondary" (click)="auth.logout()"><span aria-hidden="true">👋</span> Cerrar sesión</button>
        </div>
        <p class="muted small">El archivo incluye tus datos de salud (alergias): guárdalo en un lugar seguro.</p>
        @if (!confirmingDelete()) {
          <button type="button" class="btn danger" (click)="confirmingDelete.set(true)">Borrar mi cuenta y todos mis datos</button>
        } @else {
          <form class="stack danger-zone" (ngSubmit)="deleteAccount()">
            <p><strong>¿Seguro?</strong> Se borrarán tu cuenta, conversaciones, listas, preferencias y alergias. No se puede deshacer.</p>
            <div class="field" [class.invalid]="deleteError()">
              <input id="pf-delete" name="deletePassword" type="password" placeholder=" " autocomplete="current-password"
                [(ngModel)]="deletePassword" maxlength="128" [attr.aria-describedby]="deleteError() ? 'pf-delete-error' : null" />
              <label for="pf-delete">Tu contraseña, para confirmar</label>
            </div>
            @if (deleteError()) { <p class="error" id="pf-delete-error" role="alert">{{ deleteError() }}</p> }
            <div class="actions2">
              <button type="button" class="btn secondary" (click)="confirmingDelete.set(false)">Cancelar</button>
              <button type="submit" class="btn danger solid" [disabled]="!deletePassword">Borrar definitivamente</button>
            </div>
          </form>
        }
      </section>
    </div>
  `,
  styles: `
    .card { gap: 16px; }
    .seg.two { display: grid; grid-template-columns: 1fr 1fr; }
    .sub { margin: 0; font-size: 1rem; font-weight: 800; font-family: var(--font); }
    .conditions > p { margin: -2px 0 10px; }
    .notice { margin: 0; }
    .household { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .household > div:first-child { display: flex; flex-direction: column; }
    .group-label { font-weight: 700; font-size: 0.95rem; }
    .consent { padding: 14px; border-radius: var(--radius-sm); background: var(--surface-2); }
    .consent p { margin: 0 0 6px; }
    .consent p:last-child { margin: 0; }
    .add-box { padding: 14px; border-radius: var(--radius); background: var(--surface-2); }
    .add-box .choice input:not(:checked) + span { background: var(--surface); }
    .add-box .seg { background: var(--bg); }
    .item-text { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-weight: 600; }
    .kind { color: var(--text-2); font-weight: 700; font-size: 0.85rem; }
    .kind::after { content: ':'; }
    .sev { background: var(--surface-2); color: var(--text-2); }
    .sev[data-sev='ALLERGY'] { background: var(--warn-soft); color: var(--warn); }
    .sev[data-sev='SEVERE'] { background: color-mix(in srgb, var(--danger) 14%, var(--surface)); color: var(--danger); }
    .stars { color: var(--gold); letter-spacing: 2px; }
    .actions2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
    .danger-zone { border: 1.5px solid var(--danger); border-radius: var(--radius); padding: 14px; background: color-mix(in srgb, var(--danger) 5%, var(--surface)); animation: rise 0.3s var(--ease); }
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
  protected readonly messageOk = signal(true);
  protected readonly saveState = signal<'idle' | 'saving' | 'saved'>('idle');
  protected readonly dirty = signal(false);
  protected readonly busy = signal<'' | 'consent' | 'allergy'>('');
  protected readonly dietState = signal<'idle' | 'saving' | 'saved'>('idle');
  protected readonly dietDirty = signal(false);
  protected readonly conditions = signal<string[]>([]);
  protected readonly busyCondition = signal('');
  protected readonly conditionList = HEALTH_CONDITIONS;
  protected readonly diets = [
    { value: 'OMNIVORE', label: 'Como de todo', emo: '🍗' },
    { value: 'VEGETARIAN', label: 'Vegetariana', emo: '🥕' },
    { value: 'VEGAN', label: 'Vegana', emo: '🌱' },
    { value: 'PESCATARIAN', label: 'Pescetariana', emo: '🐟' },
  ];
  protected readonly goals = [
    { value: 'NONE', label: 'Sin objetivo especial', emo: '😊' },
    { value: 'HEALTHY', label: 'Comer más sano', emo: '🥗' },
    { value: 'LOSE_WEIGHT', label: 'Bajar de peso', emo: '⚖️' },
    { value: 'GAIN_MUSCLE', label: 'Ganar músculo', emo: '💪' },
    { value: 'MORE_ENERGY', label: 'Más energía', emo: '⚡' },
  ];
  private dietTimer?: ReturnType<typeof setTimeout>;
  protected readonly levels = [
    { value: 'BEGINNER', label: 'Aprendiendo', emo: '🌱' },
    { value: 'INTERMEDIATE', label: 'Me defiendo', emo: '🍳' },
    { value: 'ADVANCED', label: 'De todo', emo: '👩‍🍳' },
  ];
  protected readonly budgets = [
    { value: 'LOW', label: 'Económico', emo: '🪙' },
    { value: 'MEDIUM', label: 'Medio', emo: '💵' },
    { value: 'HIGH', label: 'Sin problema', emo: '💳' },
  ];
  protected readonly severities = [
    { value: 'INTOLERANCE', label: 'Intolerancia' },
    { value: 'ALLERGY', label: 'Alergia' },
    { value: 'SEVERE', label: 'Grave' },
  ];
  private flashTimer?: ReturnType<typeof setTimeout>;
  private savedTimer?: ReturnType<typeof setTimeout>;
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
    this.profile.set(withDefaults(p));
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
      this.profile.set(withDefaults(await firstValueFrom(this.api.updateProfile({ ...p, avatar: kind }))));
      this.flash(`Listo, ahora te acompaña ${avatarInfo(kind).name}.`);
    } catch {
      this.store.avatar.set(previous);
      this.flash('No pude cambiar el avatar.', false);
    }
  }

  protected edited(): void {
    this.dirty.set(true);
    if (this.saveState() === 'saved') this.saveState.set('idle');
  }

  protected household(p: Profile, delta: number): void {
    p.householdSize = Math.min(20, Math.max(1, Number(p.householdSize) + delta));
    this.edited();
  }

  protected async saveProfile(): Promise<void> {
    const p = this.profile();
    if (!p || this.saveState() === 'saving') return;
    this.saveState.set('saving');
    try {
      this.profile.set(withDefaults(await firstValueFrom(this.api.updateProfile({ ...p, householdSize: Number(p.householdSize) }))));
      this.dirty.set(false);
      this.saveState.set('saved');
      clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => this.saveState.set('idle'), 2200);
      this.flash('Perfil guardado.');
    } catch {
      this.saveState.set('idle');
      this.flash('Revisa los datos del perfil.', false);
    }
  }

  protected dietEdited(): void {
    this.dietDirty.set(true);
    if (this.dietState() === 'saved') this.dietState.set('idle');
  }

  protected async saveDiet(): Promise<void> {
    const p = this.profile();
    if (!p || this.dietState() === 'saving') return;
    this.dietState.set('saving');
    try {
      this.profile.set(withDefaults(await firstValueFrom(this.api.updateProfile({ ...p, householdSize: Number(p.householdSize) }))));
      this.dietDirty.set(false);
      this.dirty.set(false); // el PUT guarda el perfil completo
      this.dietState.set('saved');
      clearTimeout(this.dietTimer);
      this.dietTimer = setTimeout(() => this.dietState.set('idle'), 2200);
      this.flash('Alimentación guardada.');
    } catch {
      this.dietState.set('idle');
      this.flash('No pude guardar tu alimentación.', false);
    }
  }

  protected hasCondition(code: string): boolean {
    return this.conditions().includes(code);
  }

  protected async toggleCondition(code: string, label: string): Promise<void> {
    const on = !this.hasCondition(code);
    this.conditions.update((cs) => (on ? [...cs, code] : cs.filter((x) => x !== code)));
    this.busyCondition.set(code);
    try {
      await firstValueFrom(on ? this.api.addHealthCondition(code) : this.api.removeHealthCondition(code));
      this.flash(on ? `${label}: tu asistente lo tendrá en cuenta.` : `${label} quitada.`);
    } catch {
      this.conditions.update((cs) => (on ? cs.filter((x) => x !== code) : [...cs, code]));
      this.flash('No pude actualizar tus condiciones de salud.', false);
    } finally {
      this.busyCondition.set('');
    }
  }

  protected async grantHealth(): Promise<void> {
    this.busy.set('consent');
    try {
      await firstValueFrom(this.api.grantConsent('HEALTH_DATA'));
      // Primero las alergias, luego el consentimiento: así el formulario aparece ya con su valor inicial.
      await this.loadAllergies();
      this.consents.set(await firstValueFrom(this.api.consents()));
    } catch {
      this.flash('No pude registrar tu autorización. Intenta de nuevo.', false);
    } finally {
      this.busy.set('');
    }
  }

  protected async revokeHealth(): Promise<void> {
    if (!confirm('Se borrarán tus alergias y condiciones de salud registradas. ¿Continuar?')) return;
    await firstValueFrom(this.api.revokeConsent('HEALTH_DATA'));
    this.consents.set(await firstValueFrom(this.api.consents()));
    this.allergies.set([]);
    this.conditions.set([]);
    this.flash('Autorización retirada y datos de salud borrados.');
  }

  protected async addAllergy(): Promise<void> {
    if (!this.newAllergen) return;
    const name = this.label(this.newAllergen);
    this.busy.set('allergy');
    try {
      await firstValueFrom(this.api.addAllergy(this.newAllergen, this.newSeverity));
      this.newAllergen = '';
      await this.loadAllergies();
      this.flash(`${name} agregado. Ya no verás recetas con ese ingrediente.`);
    } catch {
      this.flash('No pude agregar la alergia.', false);
    } finally {
      this.busy.set('');
    }
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
      this.flash('No pude preparar tus datos. Intenta en un momento.', false);
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
    const [allergies, conditions] = await Promise.all([
      firstValueFrom(this.api.allergies()),
      firstValueFrom(this.api.healthConditions()).catch(() => [] as string[]),
    ]);
    this.allergies.set(allergies);
    this.conditions.set(conditions);
    // Sin preselección: la persona elige el alérgeno a conciencia.
    this.newAllergen = '';
  }

  private flash(text: string, ok = true): void {
    this.message.set(text);
    this.messageOk.set(ok);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.message.set(''), 3200);
  }
}

/** Perfiles antiguos pueden no traer los campos de alimentación. */
function withDefaults(p: Profile): Profile {
  return { ...p, dietType: p.dietType ?? 'OMNIVORE', goal: p.goal ?? 'NONE' };
}
