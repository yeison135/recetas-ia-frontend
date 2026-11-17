# La Sazón: frontend (Angular 22 PWA + Android)

Interfaz del asistente de cocina colombiana con IA: chat con cara animada y voz, recetas con modo cocina
paso a paso, temporizadores, lista de mercado y perfil con alergias.

El backend, la documentación y la memoria del proyecto están en
[recetas-ia-backend](https://github.com/yeison135/recetas-ia-backend). Clónalos uno al lado del otro.

## Desarrollo
```bash
npm install
npx ng serve            # http://localhost:4200, proxy de /api al backend en :8081 (proxy.conf.json)
npx ng test --watch=false
```

## Producción (PWA)
`npx ng build` genera `dist/frontend/browser`. La imagen Docker (`Dockerfile`) la sirve con Nginx
(`nginx.conf` + `security-headers.conf`: CSP, HSTS y demás cabeceras) y hace de proxy de `/api` al backend.

## App Android
1. Pon la URL pública del backend en `src/environments/environment.native.ts` y en el `connect-src` de `src/index.native.html`.
2. Agrega `https://localhost` a `CORS_ORIGINS` del backend.
3. `npm run android` compila, sincroniza Capacitor y abre Android Studio para generar el APK o el AAB.

Voz: en la web usa la Web Speech API; en Android, los plugins nativos de reconocimiento y lectura de voz.
