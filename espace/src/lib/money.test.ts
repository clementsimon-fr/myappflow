import { describe, expect, it } from 'vitest';
import { computeTotals, euros, frDate } from './money';

describe('computeTotals', () => {
  it('reproduit le devis Suivi flotte (remise 40 %, sans TVA)', () => {
    const lines = [
      { title: 'Analyser', description: '', quantity: 1, unit_price: 0 },
      { title: 'Prototyper', description: '', quantity: 1, unit_price: 300 },
      { title: 'Expérimenter', description: '', quantity: 1, unit_price: 300 },
      { title: 'Déployer', description: '', quantity: 1, unit_price: 900 },
    ];
    expect(computeTotals(lines, 40, 0)).toEqual({ subtotal: 1500, discount: 600, net: 900, vat: 0, total: 900 });
  });

  it('applique la TVA après remise et arrondit au centime', () => {
    const t = computeTotals([{ title: 'x', description: '', quantity: 3, unit_price: 33.33 }], 10, 20);
    expect(t).toEqual({ subtotal: 99.99, discount: 10, net: 89.99, vat: 18, total: 107.99 });
  });

  it('ignore les valeurs vides', () => {
    expect(computeTotals([{ title: '', description: '', quantity: NaN, unit_price: 10 }]).total).toBe(0);
  });
});

describe('format', () => {
  it('formate les euros sans espace insécable', () => {
    expect(euros(1500)).toBe('1 500 €');
    expect(euros(12.5)).toBe('12,5 €');
  });
  it('formate une date ISO', () => {
    expect(frDate('2026-06-02')).toBe('02/06/2026');
    expect(frDate(null)).toBe('');
  });
});
