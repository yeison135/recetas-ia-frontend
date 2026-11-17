import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';

import { API_BASE, IS_NATIVE, LOCAL_KEYS } from './config';
import { TokenResponse } from './models';
import { RefreshStore } from './refresh-store';

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
  /** Avisa al cerrar sesión para que cada módulo borre su estado (chat, temporizadores…). */
  readonly loggedOut = new Subject<void>();

  accessToken(): string | null {
    return this.token();
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<TokenResponse>(`${API_BASE}/api/auth/login`, { email, password }, await this.authOptions()),
    );
    await this.accept(res);
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<TokenResponse>(
        `${API_BASE}/api/auth/register`,
        { email, password, displayName },
        await this.authOptions(),
      ),
    );
    await this.accept(res);
  }

  /**
   * Intenta renovar la sesión. Las llamadas simultáneas de esta pestaña comparten la petición y,
   * con Web Locks, las demás pestañas esperan su turno (así no parece un reuso del refresh token).
   */
  refresh(): Promise<boolean> {
    if (!this.refreshing) {
      const run = () => this.doRefresh();
      const locked = typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request('sazon-refresh', run)
        : run();
      this.refreshing = locked.finally(() => (this.refreshing = null));
    }
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${API_BASE}/api/auth/logout`, await this.nativeBody(), await this.authOptions()),
      );
    } catch {
      // Aunque falle la red, se cierra la sesión local.
    }
    await this.clear();
    await this.router.navigateByUrl('/entrar');
  }

  /** Borra todo rastro local de la sesión. */
  async clear(): Promise<void> {
    this.token.set(null);
    localStorage.removeItem(LOCAL_KEYS.conversation);
    this.loggedOut.next();
    await RefreshStore.clear().catch(() => undefined);
  }

  private async doRefresh(): Promise<boolean> {
    const body = await this.nativeBody();
    if (IS_NATIVE && !body) {
      return false;
    }
    try {
      const res = await firstValueFrom(
        this.http.post<TokenResponse>(`${API_BASE}/api/auth/refresh`, body, await this.authOptions()),
      );
      await this.accept(res);
      return true;
    } catch (e) {
      // Solo un 401/403 significa que la sesión ya no vale. Sin red, 429 o 5xx se conserva para reintentar.
      if (e instanceof HttpErrorResponse && (e.status === 401 || e.status === 403)) {
        await this.clear();
      }
      return false;
    }
  }

  private async accept(res: TokenResponse): Promise<void> {
    this.token.set(res.accessToken);
    if (IS_NATIVE && res.refreshToken) {
      await RefreshStore.set(res.refreshToken);
    }
  }

  private async nativeBody(): Promise<{ refreshToken: string } | null> {
    if (!IS_NATIVE) return null;
    const refreshToken = await RefreshStore.get();
    return refreshToken ? { refreshToken } : null;
  }

  private async authOptions() {
    let headers = new HttpHeaders({ 'X-Requested-With': 'XMLHttpRequest' });
    if (IS_NATIVE) {
      headers = headers.set('X-Client', 'native');
    }
    return { headers, withCredentials: !IS_NATIVE };
  }
}
