import type { DocLine } from './types';

export interface Totals {
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineTotal(line: DocLine): number {
  return round2((Number(line.quantity) || 0) * (Number(line.unit_price) || 0));
}

export function computeTotals(lines: DocLine[], discountPct = 0, vatRate = 0): Totals {
  const subtotal = round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
  const discount = round2((subtotal * (Number(discountPct) || 0)) / 100);
  const net = round2(subtotal - discount);
  const vat = round2((net * (Number(vatRate) || 0)) / 100);
  return { subtotal, discount, net, vat, total: round2(net + vat) };
}

const formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 1500 -> "1 500 €" ; les espaces insécables sont remplacés par des espaces simples (compatibles PDF). */
export function euros(n: number): string {
  return formatter.format(n).replace(/[  ]/g, ' ');
}

export function frDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
