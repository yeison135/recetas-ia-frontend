import { kitchenQuantity } from './format';

describe('kitchenQuantity', () => {
  it('usa fracciones caseras y plurales', () => {
    expect(kitchenQuantity(3.33, 'cucharada')).toBe('3 ⅓ cucharadas');
    expect(kitchenQuantity(1.67, 'unidad')).toBe('1 ⅔ unidades');
    expect(kitchenQuantity(0.5, 'taza')).toBe('½ taza');
    expect(kitchenQuantity(1, 'diente')).toBe('1 diente');
    expect(kitchenQuantity(2.9, 'unidad')).toBe('3 unidades');
  });

  it('redondea gramos y mililitros', () => {
    expect(kitchenQuantity(166.67, 'ml')).toBe('170 ml');
    expect(kitchenQuantity(33.3, 'g')).toBe('35 g');
    expect(kitchenQuantity(1.25, 'kg')).toBe('1,25 kg');
  });

  it('respeta "al gusto"', () => {
    expect(kitchenQuantity(null, 'al gusto')).toBe('al gusto');
  });
});
