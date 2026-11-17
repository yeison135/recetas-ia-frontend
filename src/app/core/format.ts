/** Formato de cantidades para la cocina: fracciones caseras, gramos redondeados y plurales. */

const FRACTIONS: [number, string][] = [
  [0, ''],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [1, ''],
];

const PLURALS: Record<string, string> = {
  unidad: 'unidades',
  taza: 'tazas',
  cucharada: 'cucharadas',
  cucharadita: 'cucharaditas',
  diente: 'dientes',
  rama: 'ramas',
  hoja: 'hojas',
  pizca: 'pizcas',
};

/** Unidades de peso y volumen: se redondean, sin fracciones. */
const METRIC = new Set(['g', 'kg', 'ml', 'l']);

export function kitchenQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null || unit === 'al gusto') return 'al gusto';
  const u = unit ?? '';
  if (METRIC.has(u)) {
    return `${metric(quantity, u)} ${u}`.trim();
  }
  const whole = Math.floor(quantity);
  const rest = quantity - whole;
  // Fracción casera más cercana.
  const [value, symbol] = FRACTIONS.reduce((best, f) => (Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best));
  const n = whole + (value === 1 ? 1 : 0);
  const text = n > 0 ? `${n}${symbol ? ' ' + symbol : ''}` : symbol || '¼';
  const plural = n > 1 || (n === 1 && symbol !== '');
  return `${text} ${plural ? (PLURALS[u] ?? u) : u}`.trim();
}

function metric(q: number, unit: string): string {
  if (unit === 'g' || unit === 'ml') {
    const r = q >= 100 ? Math.round(q / 10) * 10 : q >= 20 ? Math.round(q / 5) * 5 : Math.round(q);
    return String(Math.max(1, r));
  }
  return String(Math.round(q * 100) / 100).replace('.', ',');
}
