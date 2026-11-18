import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth';
import { AvatarKind } from '../../core/avatars';
import { ProfileStore } from '../../core/profile-store';
import { Avatar } from '../../shared/avatar';
import { AvatarPicker } from '../../shared/avatar-picker';

type Mode = 'welcome' | 'login' | 'register';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Avatar, AvatarPicker],
  template: `
    <div class="welcome" [class.sheet-open]="mode() !== 'welcome'">
      <!-- Trazos decorativos -->
      <svg class="squiggle top" viewBox="0 0 400 260" aria-hidden="true" preserveAspectRatio="xMidYMin slice">
        <path d="M60 -10 C 40 80 150 120 120 60 C 95 10 30 90 90 150 C 140 200 200 120 180 70" class="s-mango" />
        <path d="M150 -20 C 160 60 240 90 250 30 C 258 -15 200 10 215 70 C 230 130 300 140 300 70" class="s-durazno" />
        <path d="M300 -10 C 260 70 360 120 330 180 C 310 220 380 250 420 200" class="s-lavanda" />
      </svg>
      <svg class="squiggle bottom" viewBox="0 0 400 260" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
        <path d="M-20 170 C 60 140 80 60 40 90 C 0 120 60 250 130 230" class="s-menta" />
        <path d="M110 270 C 120 180 200 170 190 220 C 180 270 120 230 160 170 C 200 110 270 150 250 210 C 235 255 300 270 320 200" class="s-mango" />
        <path d="M250 280 C 260 220 330 230 340 190 C 350 150 300 160 320 200 C 340 240 410 230 420 180" class="s-durazno" />
      </svg>

      <main class="hero">
        <app-avatar [kind]="heroAvatar()" [state]="mode() === 'welcome' ? 'idle' : 'listening'" [size]="mode() === 'welcome' ? 150 : 96" />
        <h1 class="brand">La Sazón</h1>
        <p class="tagline">Tu cocina colombiana, con alguien que sabe</p>
        @if (mode() === 'welcome') {
          <div class="actions">
            <button type="button" class="btn pill-white" (click)="open('login')">Iniciar sesión</button>
            <button type="button" class="btn pill-outline" (click)="open('register')">Crear cuenta</button>
          </div>
        }
      </main>

      @if (mode() !== 'welcome') {
        <section class="sheet" role="dialog" [attr.aria-label]="mode() === 'login' ? 'Iniciar sesión' : 'Crear cuenta'">
          <header class="sheet-head">
            <button type="button" class="back" (click)="back()" aria-label="Volver">←</button>
            <div>
              <h2>{{ mode() === 'login' ? '¡Qué bueno verte!' : step() === 1 ? 'Creemos tu cuenta' : 'Elige tu asistente' }}</h2>
              @if (mode() === 'register') {
                <p class="steps"><span [class.on]="step() >= 1"></span><span [class.on]="step() >= 2"></span> Paso {{ step() }} de 2</p>
              }
            </div>
          </header>

          <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            @if (mode() === 'login' || step() === 1) {
              @if (mode() === 'register') {
                <div class="field" [class.invalid]="showError('displayName')">
                  <input id="displayName" formControlName="displayName" placeholder=" " autocomplete="given-name" maxlength="80" />
                  <label for="displayName">¿Cómo te llamas?</label>
                </div>
              }
              <div class="field" [class.invalid]="showError('email')">
                <input id="email" type="email" formControlName="email" placeholder=" " autocomplete="email" inputmode="email" maxlength="254" />
                <label for="email">Correo</label>
                @if (showError('email')) { <span class="hint error">Escribe un correo válido.</span> }
              </div>
              <div class="field" [class.invalid]="showError('password')">
                <input id="password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder=" " maxlength="128"
                  [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" />
                <label for="password">Contraseña</label>
                <button type="button" class="suffix" (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">{{ showPassword() ? 'Ocultar' : 'Ver' }}</button>
                @if (mode() === 'register') {
                  <div class="meter" aria-hidden="true"><span [style.width.%]="strength() * 25" [attr.data-level]="strength()"></span></div>
                  <span class="hint">{{ strengthText() }}</span>
                }
              </div>
            } @else {
              <p class="muted intro">Así se verá en la pantalla de cocina. Podrás cambiarlo después en tu perfil.</p>
              <app-avatar-picker [selected]="avatar()" (selectedChange)="avatar.set($event)" />
            }

            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

            <button class="btn primary" type="submit" [disabled]="busy()">
              @if (busy()) { <span class="spinner" aria-hidden="true"></span> }
              {{ submitLabel() }}
            </button>
            @if (mode() === 'login') {
              <p class="switch">¿Aún no tienes cuenta? <button type="button" class="link" (click)="open('register')">Créala aquí</button></p>
            } @else if (step() === 1) {
              <p class="switch">¿Ya tienes cuenta? <button type="button" class="link" (click)="open('login')">Inicia sesión</button></p>
            }
          </form>
          @if (mode() === 'register') {
            <p class="legal">Tus alergias solo se guardan si das tu autorización expresa en tu perfil (Ley 1581 de 2012).</p>
          }
        </section>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .welcome {
      position: relative; min-height: 100dvh; overflow: hidden;
      background: var(--coral); color: #fff;
      display: flex; flex-direction: column;
    }
    .squiggle { position: absolute; left: 0; width: 100%; height: 34vh; pointer-events: none; }
    .squiggle path { fill: none; stroke-width: 11; stroke-linecap: round; opacity: 0.95; }
    .s-mango { stroke: var(--mango); } .s-durazno { stroke: var(--durazno); } .s-lavanda { stroke: var(--lavanda); } .s-menta { stroke: var(--menta); }
    .squiggle.top { top: 0; }
    .squiggle.bottom { bottom: 0; }
    .sheet-open .squiggle.bottom { opacity: 0; }
    .hero {
      position: relative; z-index: 1; flex: 1;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 32px 24px; text-align: center; transition: padding 0.3s;
    }
    .sheet-open .hero { flex: none; padding: 40px 24px 16px; }
    .brand { font-family: var(--font-display); font-size: clamp(2.6rem, 11vw, 3.6rem); font-weight: 600; margin: 12px 0 0; color: #fff; letter-spacing: 0.01em; }
    .sheet-open .brand { font-size: 2rem; margin-top: 4px; }
    .tagline { margin: 4px 0 0; color: var(--mango); font-weight: 800; font-size: 1.05rem; }
    .actions { display: flex; flex-direction: column; gap: 14px; width: min(100%, 340px); margin-top: 36px; }
    .actions .btn { min-height: 54px; font-size: 1.05rem; font-weight: 800; }
    .sheet {
      position: relative; z-index: 2; flex: 1;
      background: var(--surface); color: var(--text);
      border-radius: 28px 28px 0 0; padding: 22px 20px 28px;
      box-shadow: 0 -10px 30px rgb(80 20 10 / 18%);
      animation: up 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
      width: 100%; max-width: 520px; margin: 0 auto;
    }
    @keyframes up { from { transform: translateY(40px); opacity: 0; } }
    .sheet-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 18px; }
    .sheet-head h2 { margin: 2px 0 0; font-size: 1.45rem; }
    .back { border: 0; background: var(--surface-2); color: var(--text); width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; flex: none; }
    .steps { margin: 4px 0 0; color: var(--text-2); font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
    .steps span { width: 22px; height: 6px; border-radius: 3px; background: var(--line); }
    .steps span.on { background: var(--brand); }
    .stack { display: flex; flex-direction: column; gap: 14px; }
    .primary { min-height: 54px; font-size: 1.05rem; font-weight: 800; margin-top: 4px; box-shadow: 0 8px 20px color-mix(in srgb, var(--brand) 30%, transparent); }
    .spinner { width: 18px; height: 18px; border-radius: 50%; border: 3px solid rgb(255 255 255 / 40%); border-top-color: #fff; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .switch { text-align: center; margin: 2px 0 0; color: var(--text-2); }
    .link { border: 0; background: none; color: var(--brand); font: inherit; font-weight: 800; cursor: pointer; padding: 4px; }
    .hint.error { color: var(--danger); }
    .meter { height: 6px; border-radius: 3px; background: var(--surface-2); margin: 8px 4px 0; overflow: hidden; }
    .meter span { display: block; height: 100%; border-radius: 3px; transition: width 0.25s; background: var(--danger); }
    .meter span[data-level='2'] { background: var(--mango); }
    .meter span[data-level='3'], .meter span[data-level='4'] { background: var(--menta); }
    .intro { margin: 0; }
    .legal { margin: 18px 4px 0; font-size: 0.8rem; color: var(--text-2); text-align: center; }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileStore);

  protected readonly mode = signal<Mode>('welcome');
  protected readonly step = signal<1 | 2>(1);
  protected readonly avatar = signal<AvatarKind>('robot');
  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly submitted = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  private readonly password = signal('');

  protected readonly heroAvatar = computed(() => (this.mode() === 'register' ? this.avatar() : 'robot'));
  protected readonly strength = computed(() => passwordStrength(this.password()));
  protected readonly strengthText = computed(() =>
    ['Mínimo 10 caracteres.', 'Todavía corta.', 'Aceptable.', 'Buena contraseña.', '¡Muy segura!'][this.strength()],
  );
  protected readonly submitLabel = computed(() =>
    this.mode() === 'login' ? 'Entrar' : this.step() === 1 ? 'Continuar' : 'Crear mi cuenta',
  );

  constructor() {
    this.form.controls.password.valueChanges.subscribe((v) => this.password.set(v));
  }

  protected open(mode: Mode): void {
    this.mode.set(mode);
    this.step.set(1);
    this.error.set('');
    this.submitted.set(false);
  }

  protected back(): void {
    if (this.mode() === 'register' && this.step() === 2) {
      this.step.set(1);
    } else {
      this.open('welcome');
    }
  }

  protected showError(control: 'displayName' | 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return this.submitted() && c.invalid;
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set('');
    const { displayName, email, password } = this.form.getRawValue();
    if (this.form.controls.email.invalid || this.form.controls.password.invalid) {
      this.error.set('Revisa el correo y la contraseña.');
      return;
    }
    if (this.mode() === 'register' && this.step() === 1) {
      if (!displayName.trim()) {
        this.form.controls.displayName.setErrors({ required: true });
        this.error.set('Cuéntanos cómo te llamas.');
        return;
      }
      if (password.length < 10) {
        this.error.set('La contraseña debe tener al menos 10 caracteres.');
        return;
      }
      this.step.set(2);
      this.submitted.set(false);
      return;
    }
    this.busy.set(true);
    try {
      if (this.mode() === 'login') await this.auth.login(email, password);
      else await this.auth.register(email, password, displayName.trim(), this.avatar());
      await this.profile.load();
      await this.router.navigateByUrl('/cocina');
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      this.error.set(
        status === 401 ? 'Correo o contraseña incorrectos.'
          : status === 409 ? 'No pudimos crear la cuenta con ese correo.'
          : status === 429 ? 'Demasiados intentos. Espera un minuto.'
          : 'No pudimos conectarnos. Intenta de nuevo.',
      );
      if (status === 409) this.step.set(1);
    } finally {
      this.busy.set(false);
    }
  }
}

/** 0 a 4: longitud mínima, largo, mezcla de tipos de caracteres. */
export function passwordStrength(p: string): number {
  if (p.length < 10) return p.length === 0 ? 0 : 1;
  let score = 2;
  if (p.length >= 14) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /\d|[^A-Za-z]/.test(p)) score++;
  return Math.min(score, 4);
}
