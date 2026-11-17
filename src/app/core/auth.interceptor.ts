import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth';
import { isApiUrl } from './config';

/** Rutas de sesión que no llevan access token (uno vencido haría fallar el refresh). */
const PUBLIC_AUTH = /\/api\/auth\/(login|register|refresh|logout)$/;

/**
 * Añade el access token solo a nuestra API y, ante un 401, intenta renovar la sesión una sola vez.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isApi = isApiUrl(req.url);
  const isPublicAuth = PUBLIC_AUTH.test(req.url);

  const withToken = (r: HttpRequest<unknown>) => {
    const token = auth.accessToken();
    return token && isApi && !isPublicAuth ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;
  };

  return next(withToken(req)).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !isApi || isPublicAuth) {
        return throwError(() => err);
      }
      return from(auth.refresh()).pipe(
        switchMap((ok) => {
          if (!ok) {
            void router.navigateByUrl('/entrar');
            return throwError(() => err);
          }
          return next(withToken(req));
        }),
      );
    }),
  );
};
