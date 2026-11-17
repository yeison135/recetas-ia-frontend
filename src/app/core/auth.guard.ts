import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth';

/** Deja pasar si hay sesión o si se puede recuperar con el refresh token. */
export const authGuard: CanActivateFn = async () => {
  // inject() solo funciona antes del primer await.
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() || (await auth.refresh())) {
    return true;
  }
  return router.parseUrl('/entrar');
};
