import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './config';
import {
  Allergy,
  Consent,
  GeneratePlanRequest,
  MealPlan,
  MealPlanSummary,
  NewRecipe,
  CookedEntry,
  Conversation,
  CookingTimer,
  Preference,
  Profile,
  RecipeDetail,
  RecipeSummary,
  ShoppingList,
  Store,
  StoredMessage,
  UserRecipe,
} from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api`;

  // Recetas
  searchRecipes(q: string, region?: string, maxMinutes?: number, page = 0, cuisine?: string): Observable<RecipeSummary[]> {
    let params = new HttpParams().set('page', page);
    if (q) params = params.set('q', q);
    if (cuisine) params = params.set('cuisine', cuisine);
    if (region) params = params.set('region', region);
    if (maxMinutes) params = params.set('maxMinutes', maxMinutes);
    return this.http.get<RecipeSummary[]>(`${this.base}/recipes`, { params });
  }
  regions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/recipes/regions`);
  }
  /** Cocinas del catálogo (para filtrar). */
  cuisines(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/recipes/cuisines`);
  }
  recipe(slug: string, servings?: number): Observable<RecipeDetail> {
    const params = servings ? new HttpParams().set('servings', servings) : undefined;
    return this.http.get<RecipeDetail>(`${this.base}/recipes/${encodeURIComponent(slug)}`, { params });
  }

  // Perfil y memoria
  profile(): Observable<Profile> {
    return this.http.get<Profile>(`${this.base}/me/profile`);
  }
  updateProfile(p: Profile): Observable<Profile> {
    return this.http.put<Profile>(`${this.base}/me/profile`, p);
  }
  consents(): Observable<Consent[]> {
    return this.http.get<Consent[]>(`${this.base}/me/consents`);
  }
  grantConsent(purpose: string): Observable<void> {
    return this.http.post<void>(`${this.base}/me/consents/${purpose}`, null);
  }
  revokeConsent(purpose: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/me/consents/${purpose}`);
  }
  allergies(): Observable<Allergy[]> {
    return this.http.get<Allergy[]>(`${this.base}/me/allergies`);
  }
  addAllergy(allergen: string, severity: string): Observable<void> {
    return this.http.post<void>(`${this.base}/me/allergies`, { allergen, severity });
  }
  deleteAllergy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/me/allergies/${id}`);
  }
  healthConditions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/me/health-conditions`);
  }
  addHealthCondition(code: string): Observable<void> {
    return this.http.post<void>(`${this.base}/me/health-conditions/${encodeURIComponent(code)}`, null);
  }
  removeHealthCondition(code: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/me/health-conditions/${encodeURIComponent(code)}`);
  }
  preferences(): Observable<Preference[]> {
    return this.http.get<Preference[]>(`${this.base}/me/preferences`);
  }
  deletePreference(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/me/preferences/${id}`);
  }
  exportData(): Observable<unknown> {
    return this.http.get<unknown>(`${this.base}/me/export`);
  }
  deleteAccount(password: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/me`, { body: { password } });
  }
  history(): Observable<CookedEntry[]> {
    return this.http.get<CookedEntry[]>(`${this.base}/me/history`);
  }
  markCooked(slug: string, servings?: number, rating?: number): Observable<void> {
    return this.http.post<void>(`${this.base}/me/history`, { slug, servings, rating });
  }

  // Favoritas, recetas propias y planes de comida
  favorites(): Observable<RecipeSummary[]> {
    return this.http.get<RecipeSummary[]>(`${this.base}/me/favorites`);
  }
  isFavorite(slug: string): Observable<{ favorite: boolean }> {
    return this.http.get<{ favorite: boolean }>(`${this.base}/me/favorites/${encodeURIComponent(slug)}`);
  }
  addFavorite(slug: string): Observable<void> {
    return this.http.put<void>(`${this.base}/me/favorites/${encodeURIComponent(slug)}`, null);
  }
  removeFavorite(slug: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/me/favorites/${encodeURIComponent(slug)}`);
  }
  myRecipes(): Observable<UserRecipe[]> {
    return this.http.get<UserRecipe[]>(`${this.base}/me/recipes`);
  }
  myRecipe(id: string): Observable<UserRecipe> {
    return this.http.get<UserRecipe>(`${this.base}/me/recipes/${encodeURIComponent(id)}`);
  }
  createRecipe(r: NewRecipe): Observable<UserRecipe> {
    return this.http.post<UserRecipe>(`${this.base}/me/recipes`, r);
  }
  deleteRecipe(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/me/recipes/${encodeURIComponent(id)}`);
  }
  mealPlans(): Observable<MealPlanSummary[]> {
    return this.http.get<MealPlanSummary[]>(`${this.base}/me/meal-plans`);
  }
  mealPlan(id: string): Observable<MealPlan> {
    return this.http.get<MealPlan>(`${this.base}/me/meal-plans/${encodeURIComponent(id)}`);
  }
  deleteMealPlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/me/meal-plans/${encodeURIComponent(id)}`);
  }
  /** Cocinas que se pueden pedir al generar un plan. */
  planCuisines(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/meal-plans/cuisines`);
  }
  /** La IA arma el plan: tarda de 40 s a 2 min. 429 si hay demasiados en la hora, 503 si la IA no está. */
  generateMealPlan(req: GeneratePlanRequest): Observable<MealPlan> {
    return this.http.post<MealPlan>(`${this.base}/me/meal-plans/generate`, req);
  }
  /** Lista de mercado con los ingredientes de todo el plan (400 si el plan no los tiene). */
  planShoppingList(id: string): Observable<ShoppingList> {
    return this.http.post<ShoppingList>(`${this.base}/me/meal-plans/${encodeURIComponent(id)}/shopping-list`, null);
  }

  // Temporizadores
  timers(): Observable<CookingTimer[]> {
    return this.http.get<CookingTimer[]>(`${this.base}/timers`);
  }
  startTimer(label: string, seconds: number): Observable<CookingTimer> {
    return this.http.post<CookingTimer>(`${this.base}/timers`, { label, seconds });
  }
  cancelTimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/timers/${id}`);
  }

  // Mercado
  shoppingLists(): Observable<ShoppingList[]> {
    return this.http.get<ShoppingList[]>(`${this.base}/shopping-lists`);
  }
  createShoppingList(slugs: string[], servings?: number): Observable<ShoppingList> {
    return this.http.post<ShoppingList>(`${this.base}/shopping-lists`, { slugs, servings });
  }
  checkItem(listId: string, itemId: string, checked: boolean): Observable<void> {
    return this.http.patch<void>(`${this.base}/shopping-lists/${listId}/items/${itemId}`, { checked });
  }
  deleteShoppingList(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/shopping-lists/${id}`);
  }
  stores(city?: string): Observable<Store[]> {
    const params = city ? new HttpParams().set('city', city) : undefined;
    return this.http.get<Store[]>(`${this.base}/stores`, { params });
  }

  // Conversaciones
  createConversation(channel: 'TEXT' | 'VOICE' = 'TEXT'): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/chat/conversations`, { channel });
  }
  conversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.base}/chat/conversations`);
  }
  messages(conversationId: string): Observable<StoredMessage[]> {
    return this.http.get<StoredMessage[]>(`${this.base}/chat/conversations/${conversationId}/messages`);
  }
}
