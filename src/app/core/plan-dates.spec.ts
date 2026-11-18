import { addDays, isoDate, longDate, nextMonday, parseIsoDate, shortDay } from './plan-dates';

describe('fechas de los planes', () => {
  it('usa la fecha local, no la UTC', () => {
    // 17 nov a las 11 p. m.: en UTC ya sería 18.
    expect(isoDate(new Date(2026, 10, 17, 23, 30))).toBe('2026-11-17');
  });

  it('lee YYYY-MM-DD y rechaza lo demás', () => {
    expect(isoDate(parseIsoDate('2026-11-24')!)).toBe('2026-11-24');
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate('24/11/2026')).toBeNull();
  });

  it('busca el lunes que viene (o hoy si es lunes)', () => {
    expect(isoDate(nextMonday(new Date(2026, 10, 17)))).toBe('2026-11-23'); // martes → lunes 23
    expect(isoDate(nextMonday(new Date(2026, 10, 22)))).toBe('2026-11-23'); // domingo → lunes 23
    expect(isoDate(nextMonday(new Date(2026, 10, 23)))).toBe('2026-11-23'); // lunes → hoy
  });

  it('suma días cruzando el mes y arma las etiquetas', () => {
    const d = addDays(new Date(2026, 10, 29), 2);
    expect(isoDate(d)).toBe('2026-12-01');
    expect(shortDay(d)).toBe('Mar 1');
    expect(longDate(d)).toBe('1 de diciembre');
  });
});
