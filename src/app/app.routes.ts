import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'entrar', loadComponent: () => import('./features/login/login').then((m) => m.Login), title: 'Entrar · La Sazón' },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'cocina' },
      { path: 'cocina', loadComponent: () => import('./features/chat/chat').then((m) => m.Chat), title: 'Cocina · La Sazón' },
      { path: 'recetas', loadComponent: () => import('./features/recipes/recipes').then((m) => m.Recipes), title: 'Recetas · La Sazón' },
      {
        path: 'recetas/mias/:id',
        loadComponent: () => import('./features/recipes/user-recipe').then((m) => m.UserRecipePage),
        title: 'Mi receta · La Sazón',
      },
      {
        path: 'planes/:id',
        loadComponent: () => import('./features/plans/plan-detail').then((m) => m.PlanDetailPage),
        title: 'Plan de comidas · La Sazón',
      },
      {
        path: 'recetas/:slug',
        loadComponent: () => import('./features/recipes/recipe-detail').then((m) => m.RecipeDetailPage),
        title: 'Receta · La Sazón',
      },
      { path: 'mercado', loadComponent: () => import('./features/shopping/shopping').then((m) => m.Shopping), title: 'Mercado · La Sazón' },
      { path: 'perfil', loadComponent: () => import('./features/profile/profile').then((m) => m.ProfilePage), title: 'Perfil · La Sazón' },
    ],
  },
  { path: '**', redirectTo: '' },
];
