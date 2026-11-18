import { MealPlan, RecipeDetail, ShoppingList, UserRecipe } from './models';
import { catalogRecipeText, mailtoUrl, mealPlanText, shoppingListText, userRecipeText, whatsappUrl } from './share';

const list: ShoppingList = {
  id: 'l1',
  title: 'Mercado: Ajiaco',
  createdAt: '2026-11-17T10:00:00Z',
  items: [
    { id: 'b', label: 'Guascas', quantity: null, unit: null, checked: false, position: 2 },
    { id: 'a', label: 'Papa criolla', quantity: 1.5, unit: 'kg', checked: true, position: 1 },
    { id: 'c', label: 'Mazorca', quantity: 3, unit: 'unidad', checked: false, position: 3 },
  ],
};

const own: UserRecipe = {
  id: 'r1',
  title: 'Arepa con huevo',
  summary: 'Desayuno rápido',
  servings: 2,
  minutes: 15,
  ingredients: [
    { name: 'arepa', quantity: 2, unit: 'unidad' },
    { name: 'leche', quantity: 166.67, unit: 'ml' },
    { name: 'sal', quantity: null, unit: null },
  ],
  steps: ['Calienta la arepa.', 'Fríe el huevo.'],
  tags: [],
  source: 'ASSISTANT',
  createdAt: '2026-11-17T10:00:00Z',
};

describe('textos para compartir', () => {
  it('arma la lista de mercado en orden y con cantidades de cocina', () => {
    expect(shoppingListText(list)).toBe(
      ['🧺 Mercado: Ajiaco', '', '✓ Papa criolla — 1,5 kg', '• Guascas', '• Mazorca — 3 unidades', '', 'Hecho con La Sazón 🍲'].join('\n'),
    );
  });

  it('arma una receta propia con ingredientes y pasos numerados', () => {
    const t = userRecipeText(own);
    expect(t).toContain('📖 Arepa con huevo\nDesayuno rápido\n2 porciones · 15 min');
    expect(t).toContain('• 2 unidades de arepa\n• 170 ml de leche\n• sal (al gusto)');
    expect(t).toContain('Preparación:\n1. Calienta la arepa.\n2. Fríe el huevo.');
  });

  it('arma una receta del catálogo con preparación y opcionales', () => {
    const r = {
      slug: 'ajiaco', title: 'Ajiaco', summary: 'Sopa bogotana', region: 'Andina', prepMinutes: 20, cookMinutes: 60,
      difficulty: 'MEDIUM', costLevel: 'MEDIUM', tags: [], servings: 4, baseServings: 4, substitutes: [], allergens: [],
      ingredients: [
        { name: 'papa sabanera', quantity: 0.5, unit: 'kg', preparation: 'en rodajas', optional: false, allergens: [] },
        { name: 'alcaparras', quantity: 2, unit: 'cucharada', preparation: null, optional: true, allergens: [] },
      ],
      steps: [
        { position: 2, instruction: 'Sirve.', timerSeconds: null },
        { position: 1, instruction: 'Cocina las papas.', timerSeconds: 600 },
      ],
    } as RecipeDetail;
    const t = catalogRecipeText(r);
    expect(t).toContain('4 porciones · 80 min');
    expect(t).toContain('• 0,5 kg de papa sabanera, en rodajas\n• 2 cucharadas de alcaparras (opcional)');
    expect(t).toContain('1. Cocina las papas.\n2. Sirve.');
  });

  it('arma el plan por días con notas', () => {
    const p: MealPlan = {
      id: 'p1', title: 'Semana sana', notes: 'Toma agua', createdAt: '',
      days: [{ day: 'Lunes', meals: [{ moment: 'Almuerzo', dish: 'Lentejas', note: 'con arroz' }, { moment: 'Cena', dish: 'Sopa', note: null }] }],
    };
    expect(mealPlanText(p)).toBe(
      ['🗓️ Semana sana', '', 'Lunes:', '• Almuerzo: Lentejas (con arroz)', '• Cena: Sopa', '', 'Notas: Toma agua', '', 'Hecho con La Sazón 🍲'].join('\n'),
    );
  });
});

describe('enlaces para compartir', () => {
  const text = 'Ajiaco & más\nPaso 1: ñame';

  it('codifica el texto de WhatsApp', () => {
    const url = whatsappUrl(text);
    expect(url).toBe('https://wa.me/?text=Ajiaco%20%26%20m%C3%A1s%0APaso%201%3A%20%C3%B1ame');
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(text);
  });

  it('codifica asunto y cuerpo del correo con saltos CRLF', () => {
    const url = mailtoUrl('Receta: Ajiaco & papas', text);
    expect(url).toBe(
      'mailto:?subject=Receta%3A%20Ajiaco%20%26%20papas&body=Ajiaco%20%26%20m%C3%A1s%0D%0APaso%201%3A%20%C3%B1ame',
    );
    // El & del texto no rompe los parámetros.
    expect(url.split('&')).toHaveLength(2);
  });
});
