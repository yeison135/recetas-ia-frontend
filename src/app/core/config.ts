import { environment } from '../../environments/environment';

/**
 * URL base de la API. En la web es el mismo origen (en desarrollo, proxy.conf.json la redirige al backend).
 * En la app nativa (Capacitor) viene de environment.native.ts.
 */
export const API_BASE = environment.apiBase;

/** En la app nativa el refresh token viaja en el cuerpo (ver DECISIONES.md). */
export const IS_NATIVE = typeof window !== 'undefined' && 'Capacitor' in window;
