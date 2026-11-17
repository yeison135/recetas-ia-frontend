/** Tipos de la API del backend (ver docs/ESQUEMA.md). */

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string | null;
}

export interface Profile {
  displayName: string;
  cookingLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  householdSize: number;
  budgetLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  city: string | null;
  regionPreference: string | null;
}

export interface Allergy {
  id: string;
  allergen: string;
  severity: 'INTOLERANCE' | 'ALLERGY' | 'SEVERE';
}

export interface Preference {
  id: string;
  kind: string;
  value: string;
  source: 'USER' | 'ASSISTANT';
  createdAt: string;
  expiresAt: string | null;
}

export interface Consent {
  purpose: string;
  policyVersion: string;
  grantedAt: string;
}

export interface RecipeSummary {
  slug: string;
  title: string;
  summary: string;
  region: string;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  costLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  tags: string[];
}

export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string;
  preparation: string | null;
  optional: boolean;
  allergens: string[];
}

export interface Step {
  position: number;
  instruction: string;
  timerSeconds: number | null;
}

export interface RecipeDetail extends Omit<RecipeSummary, never> {
  servings: number;
  baseServings: number;
  ingredients: Ingredient[];
  steps: Step[];
  substitutes: { ingredient: string; substitute: string; note: string | null }[];
  allergens: string[];
}

export interface CookingTimer {
  id: string;
  label: string;
  durationSeconds: number;
  startedAt: string;
  endsAt: string;
  status: 'RUNNING' | 'DONE' | 'CANCELLED';
}

export interface ShoppingItem {
  id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  position: number;
}

export interface ShoppingList {
  id: string;
  title: string;
  createdAt: string;
  items: ShoppingItem[];
}

export interface Store {
  id: string;
  name: string;
  city: string;
  neighborhood: string | null;
  address: string | null;
  kind: 'PLAZA' | 'SUPERMERCADO' | 'TIENDA';
  notes: string | null;
}

export interface Conversation {
  id: string;
  channel: 'TEXT' | 'VOICE';
  startedAt: string;
  lastMessageAt: string;
}

export interface StoredMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export interface CookedEntry {
  slug: string;
  title: string;
  cookedAt: string;
  servings: number | null;
  rating: number | null;
}

export const ALLERGENS: { code: string; label: string }[] = [
  { code: 'gluten', label: 'Gluten (trigo, cebada, avena)' },
  { code: 'lactosa', label: 'Lácteos / lactosa' },
  { code: 'huevo', label: 'Huevo' },
  { code: 'mani', label: 'Maní' },
  { code: 'frutos_secos', label: 'Frutos secos' },
  { code: 'mariscos', label: 'Mariscos' },
  { code: 'pescado', label: 'Pescado' },
  { code: 'soya', label: 'Soya' },
];

export const DIFFICULTY_LABEL: Record<string, string> = { EASY: 'Fácil', MEDIUM: 'Media', HARD: 'Difícil' };
export const COST_LABEL: Record<string, string> = { LOW: '$', MEDIUM: '$$', HIGH: '$$$' };
