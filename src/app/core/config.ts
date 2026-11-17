/**
 * URL base de la API. En la web es el mismo origen (en desarrollo, proxy.conf.json la redirige a :8080).
 * En la app nativa (Capacitor) se define en tiempo de build con la URL pública del backend.
 */
export const API_BASE = '';

/** En la app nativa el refresh token viaja en el cuerpo (ver DECISIONES.md). */
export const IS_NATIVE = typeof window !== 'undefined' && 'Capacitor' in window;
