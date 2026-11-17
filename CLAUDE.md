# La Sazón: frontend (Angular 22 PWA + Android)

La documentación y la memoria del proyecto viven en el repositorio **recetas-ia-backend**
(`CLAUDE.md`, `docs/PROGRESO.md`, `docs/DECISIONES.md`). Clónalo al lado de este y léelos antes de empezar.

## Comandos
- `npm install` y `npx ng serve`: desarrollo en http://localhost:4200 (proxy de `/api` al backend en :8081).
- `npx ng test --watch=false`: pruebas unitarias.
- `npm run android`: build nativo, sincroniza Capacitor y abre Android Studio.

## Reglas
- El access token vive solo en memoria; el refresh va en cookie HttpOnly (web) o en el Keystore (`RefreshStore`, nativo).
- Nunca usar `innerHTML` ni `bypassSecurityTrust*`: el texto del LLM se pinta solo por interpolación.
- La URL de la API nativa (`src/environments/environment.native.ts`) y el `connect-src` de `src/index.native.html` van juntos.
