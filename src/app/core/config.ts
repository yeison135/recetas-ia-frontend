import { Capacitor } from '@capacitor/core';

import { environment } from '../../environments/environment';

/**
 * URL base de la API. En la web es el mismo origen (en desarrollo, proxy.conf.json la redirige al backend).
 * En la app nativa (Capacitor) viene de environment.native.ts.
 */
export const API_BASE = environment.apiBase;

/**
 * Solo es nativo dentro del APK. `'Capacitor' in window` no sirve: @capacitor/core define ese global
 * también en la web en cuanto se importa.
 */
export const IS_NATIVE = Capacitor.isNativePlatform();

/** ¿La URL va a nuestra API? Evita adjuntar el token a peticiones a otros orígenes. */
export function isApiUrl(url: string): boolean {
  if (API_BASE) {
    return url.startsWith(`${API_BASE}/api/`);
  }
  return url.startsWith('/api/');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID.test(value);
}

/** Datos locales de la sesión que se borran al salir. */
export const LOCAL_KEYS = { conversation: 'sazon.conversation' };
