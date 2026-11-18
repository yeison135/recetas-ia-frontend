/**
 * Textos para compartir (sin servidor de correo): lista de mercado, recetas y planes.
 * Funciones puras: arman texto plano que luego va a la Web Share API, a WhatsApp o a un mailto.
 */
import { kitchenQuantity } from './format';
import { MealPlan, RecipeDetail, SHOPPING_CATEGORIES, ShoppingItem, ShoppingList, UserRecipe } from './models';

const FIRMA = 'Hecho con La Sazón 🍲';

/** Forma común de una receta para compartirla (del catálogo o propia). */
interface ShareableRecipe {
  title: string;
  summary: string | null;
  servings: number;
  minutes: number | null;
  ingredients: { name: string; qty: string }[];
  steps: string[];
}

export interface ShoppingSection {
  name: string;
  items: ShoppingItem[];
}

/**
 * Agrupa los productos por sección del mercado en el orden de SHOPPING_CATEGORIES (y por posición
 * dentro de cada una). Lo que no trae categoría, o trae una desconocida, va a "Otros".
 */
export function groupByCategory(items: ShoppingItem[]): ShoppingSection[] {
  const known = new Set(SHOPPING_CATEGORIES);
  const sections = new Map<string, ShoppingItem[]>(SHOPPING_CATEGORIES.map((c) => [c, []]));
  for (const i of [...items].sort((a, b) => a.position - b.position)) {
    const c = i.category && known.has(i.category) ? i.category : 'Otros';
    sections.get(c)!.push(i);
  }
  return [...sections].filter(([, list]) => list.length).map(([name, list]) => ({ name, items: list }));
}

/** Una lista sin categorías (las de antes) se ve igual que siempre, sin encabezados. */
export function hasSections(sections: ShoppingSection[]): boolean {
  return sections.length > 1 || (sections.length === 1 && sections[0].name !== 'Otros');
}

export function shoppingListText(list: ShoppingList): string {
  const line = (i: ShoppingItem) => {
    const qty = i.quantity === null ? '' : kitchenQuantity(i.quantity, i.unit);
    return `${i.checked ? '✓' : '•'} ${i.label}${qty ? ` — ${qty}` : ''}`;
  };
  const sections = groupByCategory(list.items);
  const lines = [`🧺 ${list.title}`];
  if (hasSections(sections)) {
    for (const s of sections) lines.push('', `${s.name}:`, ...s.items.map(line));
  } else {
    lines.push('', ...sections.flatMap((s) => s.items.map(line)));
  }
  lines.push('', FIRMA);
  return lines.join('\n');
}

export function catalogRecipeText(r: RecipeDetail): string {
  return recipeText({
    title: r.title,
    summary: r.summary,
    servings: r.servings,
    minutes: r.prepMinutes + r.cookMinutes,
    ingredients: r.ingredients.map((i) => ({
      name: `${i.name}${i.preparation ? `, ${i.preparation}` : ''}${i.optional ? ' (opcional)' : ''}`,
      qty: kitchenQuantity(i.quantity, i.unit),
    })),
    steps: [...r.steps].sort((a, b) => a.position - b.position).map((s) => s.instruction),
  });
}

export function userRecipeText(r: UserRecipe): string {
  return recipeText({
    ...r,
    ingredients: r.ingredients.map((i) => ({ name: i.name, qty: kitchenQuantity(i.quantity, i.unit) })),
  });
}

function recipeText(r: ShareableRecipe): string {
  const facts = [`${r.servings} ${r.servings === 1 ? 'porción' : 'porciones'}`];
  if (r.minutes) facts.push(`${r.minutes} min`);
  const lines = [`📖 ${r.title}`];
  if (r.summary) lines.push(r.summary);
  lines.push(facts.join(' · '), '', 'Ingredientes:');
  for (const i of r.ingredients) lines.push(i.qty === 'al gusto' ? `• ${i.name} (al gusto)` : `• ${i.qty} de ${i.name}`);
  lines.push('', 'Preparación:');
  r.steps.forEach((s, n) => lines.push(`${n + 1}. ${s}`));
  lines.push('', FIRMA);
  return lines.join('\n');
}

export function mealPlanText(p: MealPlan): string {
  const lines = [`🗓️ ${p.title}`];
  for (const d of p.days) {
    lines.push('', `${d.day}:`);
    for (const m of d.meals) lines.push(`• ${m.moment}: ${m.dish}${m.note ? ` (${m.note})` : ''}`);
  }
  if (p.notes) lines.push('', `Notas: ${p.notes}`);
  lines.push('', FIRMA);
  return lines.join('\n');
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** mailto según RFC 6068: todo codificado y los saltos de línea del cuerpo como CRLF. */
export function mailtoUrl(subject: string, body: string): string {
  const crlf = body.replace(/\r?\n/g, '\r\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlf)}`;
}
