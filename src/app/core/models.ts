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
  avatar: string;
  dietType?: DietType;
  goal?: Goal;
}

export type DietType = 'OMNIVORE' | 'VEGETARIAN' | 'VEGAN' | 'PESCATARIAN';
export type Goal = 'NONE' | 'HEALTHY' | 'LOSE_WEIGHT' | 'GAIN_MUSCLE' | 'MORE_ENERGY';

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
  /** Cocina del mundo (Colombiana, Italiana…); puede faltar en respuestas viejas. */
  cuisine?: string | null;
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
  /** Sección del mercado (ver SHOPPING_CATEGORIES); las listas viejas no la traen. */
  category?: string | null;
}

/** Orden de las secciones del mercado; lo que no tiene categoría (o una desconocida) va a "Otros". */
export const SHOPPING_CATEGORIES: readonly string[] = [
  'Frutas y verduras',
  'Proteínas',
  'Lácteos y huevos',
  'Granos y cereales',
  'Panadería',
  'Despensa',
  'Condimentos',
  'Bebidas',
  'Otros',
];

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

/** Condiciones de salud (dato sensible: requiere la autorización HEALTH_DATA, igual que las alergias). */
export const HEALTH_CONDITIONS: { code: string; label: string }[] = [
  { code: 'DIABETES', label: 'Diabetes' },
  { code: 'HIPERTENSION', label: 'Hipertensión' },
  { code: 'COLESTEROL', label: 'Colesterol alto' },
  { code: 'RENAL', label: 'Enfermedad renal' },
  { code: 'GASTRITIS', label: 'Gastritis' },
  { code: 'EMBARAZO', label: 'Embarazo' },
];

export interface UserRecipeIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

/** Receta propia: inventada por la asistente o escrita por la persona. */
export interface UserRecipe {
  id: string;
  title: string;
  summary: string | null;
  servings: number;
  minutes: number | null;
  ingredients: UserRecipeIngredient[];
  steps: string[];
  tags: string[];
  source: 'ASSISTANT' | 'USER';
  createdAt: string;
}

export type NewRecipe = Omit<UserRecipe, 'id' | 'source' | 'createdAt'>;

export interface MealPlanSummary {
  id: string;
  title: string;
  days: number;
  /** Fecha del primer día (YYYY-MM-DD); los planes viejos no la traen. */
  startDate?: string | null;
  createdAt: string;
}

export interface PlanIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
}

export interface Meal {
  moment: string;
  dish: string;
  note: string | null;
  /** Los planes viejos no traen cocina ni ingredientes. */
  cuisine?: string | null;
  ingredients?: PlanIngredient[];
}

export interface MealPlan {
  id: string;
  title: string;
  notes: string | null;
  days: { day: string; meals: Meal[] }[];
  startDate?: string | null;
  householdSize?: number | null;
  createdAt: string;
}

/** Pedido para que la IA arme un plan (tarda de 40 s a 2 min). */
export interface GeneratePlanRequest {
  days: number;
  /** Vacía = cocinas variadas ("Sorpréndeme"). */
  cuisines: string[];
  notes?: string;
  startDate?: string;
}
