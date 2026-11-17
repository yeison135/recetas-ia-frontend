import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App Android (y luego iOS) con el mismo código de la PWA.
 * Construir con: npm run build:native && npx cap sync android && npx cap open android
 */
const config: CapacitorConfig = {
  appId: 'co.cocina.lasazon',
  appName: 'La Sazón',
  webDir: 'dist/frontend/browser',
  android: {
    // El WebView sirve la app desde https://localhost: la API debe permitir ese origen en CORS.
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#b5462a',
    },
  },
};

export default config;
