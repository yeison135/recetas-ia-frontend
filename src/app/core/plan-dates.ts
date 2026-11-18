/**
 * Fechas de los planes de comida. Se trabaja siempre con la fecha local (YYYY-MM-DD), nunca con
 * toISOString(), que pasa a UTC y en Colombia (UTC−5) cambia de día después de las 7 p. m.
 */

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 'YYYY-MM-DD' de una fecha en hora local. */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lee 'YYYY-MM-DD' como fecha local; null si no es válida. */
export function parseIsoDate(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** El lunes que viene (hoy mismo si hoy es lunes): así el plan arranca con la semana. */
export function nextMonday(today: Date): Date {
  return addDays(today, (8 - today.getDay()) % 7);
}

/** "Lun 24" */
export function shortDay(d: Date): string {
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()}`;
}

/** "24 de noviembre" */
export function longDate(d: Date): string {
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}
