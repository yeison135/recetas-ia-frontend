import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { API_BASE, IS_NATIVE } from './config';
import { TokenResponse } from './models';

const NATIVE_REFRESH_KEY = 'sazon.rt';

/**
 * Sesión: el access token vive solo en memoria. El refresh token lo guarda el navegador
 * en una cookie HttpOnly (web) o el almacenamiento seguro del dispositivo (app nativa).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly token = signal<string | null>(null);
  private refreshing: Promise<boolean> | null = null;

  readonly isLoggedIn = computed(() => this.token() !== null);

  accessToken(): string | null {
    return this.token();
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<TokenResponse>(`${API_BASE}/api/auth/login`, { email, password }, this.authOptions()),
    );
    this.accept(res);
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<TokenResponse>(
        `${API_BASE}/api/auth/register`,
        { email, password, displayName },
        this.authOptions(),
      ),
    );
    this.accept(res);
  }

  /** Intenta renovar la sesión. Varias llamadas simultáneas comparten la misma petición. */
  refresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => (this.refreshing = null));
    }
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${API_BASE}/api/auth/logout`, this.nativeBody(), this.authOptions()),
      );
    } catch {
      // Aunque falle la red, se cierra la sesión local.
    }
    this.clear();
    await this.router.navigateByUrl('/entrar');
  }

  clear(): void {
    this.token.set(null);
    if (IS_NATIVE) {
      localStorage.removeItem(NATIVE_REFRESH_KEY);
    }
  }

  private async doRefresh(): Promise<boolean> {
    if (IS_NATIVE && !localStorage.getItem(NATIVE_REFRESH_KEY)) {
      return false;
    }
    try {
      const res = await firstValueFrom(
        this.http.post<TokenResponse>(`${API_BASE}/api/auth/refresh`, this.nativeBody(), this.authOptions()),
      );
      this.accept(res);
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  private accept(res: TokenResponse): void {
    this.token.set(res.accessToken);
    if (IS_NATIVE && res.refreshToken) {
      // TODO(capacitor): mover a almacenamiento seguro (Android Keystore) al empaquetar el APK.
      localStorage.setItem(NATIVE_REFRESH_KEY, res.refreshToken);
    }
  }

  private nativeBody(): object | null {
    return IS_NATIVE ? { refreshToken: localStorage.getItem(NATIVE_REFRESH_KEY) } : null;
  }

  private authOptions() {
    let headers = new HttpHeaders({ 'X-Requested-With': 'XMLHttpRequest' });
    if (IS_NATIVE) {
      headers = headers.set('X-Client', 'native');
    }
    return { headers, withCredentials: true };
  }
}
