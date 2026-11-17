import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth';

/**
 * Añade el access token a /api/** (salvo /api/auth/**, donde un token vencido haría fallar el refresh)
 * y, ante un 401, intenta renovar la sesión una sola vez.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isApi = req.url.includes('/api/');
  const isAuth = req.url.includes('/api/auth/');

  const withToken = (r: HttpRequest<unknown>) => {
    const token = auth.accessToken();
    return token && isApi && !isAuth ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;
  };

  return next(withToken(req)).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !isApi || isAuth) {
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
