import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="page login">
      <header>
        <div class="logo" aria-hidden="true">🍲</div>
        <h1>La Sazón</h1>
        <p class="muted">Tu asistente de cocina colombiana. Te acompaño paso a paso, con recetas de toda Colombia.</p>
      </header>

      <div class="card">
        <div class="switch" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="mode() === 'login'" [class.on]="mode() === 'login'" (click)="mode.set('login')">Entrar</button>
          <button type="button" role="tab" [attr.aria-selected]="mode() === 'register'" [class.on]="mode() === 'register'" (click)="mode.set('register')">Crear cuenta</button>
        </div>

        <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
          @if (mode() === 'register') {
            <label>¿Cómo te llamas?
              <input formControlName="displayName" autocomplete="given-name" maxlength="80" />
            </label>
          }
          <label>Correo
            <input formControlName="email" type="email" autocomplete="email" maxlength="254" />
          </label>
          <label>Contraseña
            <input formControlName="password" type="password" maxlength="128"
              [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" />
            @if (mode() === 'register') {
              <span class="muted small">Mínimo 10 caracteres.</span>
            }
          </label>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <button class="btn" type="submit" [disabled]="busy()">
            {{ mode() === 'login' ? 'Entrar' : 'Crear cuenta' }}
          </button>
        </form>
      </div>
      <p class="muted small legal">
        Al crear tu cuenta aceptas el tratamiento de tus datos para darte el servicio. Tus alergias solo se guardan
        si nos das tu autorización expresa en tu perfil.
      </p>
    </div>
  `,
  styles: `
    .login { max-width: 440px; padding-top: 48px; }
    header { text-align: center; margin-bottom: 20px; }
    .logo { font-size: 3rem; }
    .switch { display: grid; grid-template-columns: 1fr 1fr; background: var(--surface-2); border-radius: 999px; padding: 4px; margin-bottom: 16px; }
    .switch button { border: 0; background: transparent; font: inherit; font-weight: 600; padding: 8px; border-radius: 999px; color: var(--text-2); cursor: pointer; min-height: 40px; }
    .switch button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
    .legal { text-align: center; margin-top: 16px; }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    const { displayName, email, password } = this.form.getRawValue();
    if (this.form.invalid) {
      this.error.set('Revisa el correo y la contraseña.');
      return;
    }
    if (this.mode() === 'register' && (!displayName.trim() || password.length < 10)) {
      this.error.set('Escribe tu nombre y una contraseña de al menos 10 caracteres.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.mode() === 'login') await this.auth.login(email, password);
      else await this.auth.register(email, password, displayName);
      await this.router.navigateByUrl('/cocina');
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      this.error.set(
        status === 401 ? 'Correo o contraseña incorrectos.'
          : status === 409 ? 'No pudimos crear la cuenta con ese correo.'
          : status === 429 ? 'Demasiados intentos. Espera un minuto.'
          : 'No pudimos conectarnos. Intenta de nuevo.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
