import { describe, expect, it } from 'vitest';
// @ts-expect-error module JavaScript de la fonction serveur
import { monthlyTitle, nextInvoiceNumber, parisToday, periodNotes, planMonthlyInvoices } from '../../../api/_monthly.js';

const contract = { id: 'c1', kind: 'contrat', status: 'actif', number: 'CM1' };
const model = {
  id: 'f6', kind: 'facture', number: 'FAC-2026-006', status: 'a_regler', project_id: 'p1', related_document_id: 'c1',
  issue_date: '2026-11-24', title: 'Contrat de maintenance · mensualité', module: '', lines: [{ title: 'x', quantity: 1, unit_price: 75 }],
  discount_pct: 0, vat_rate: 0, payment_terms: 'Payable à réception', notes: '',
};

describe('mensualités de contrat', () => {
  it('crée la facture du mois à partir de la dernière', () => {
    const { plan } = planMonthlyInvoices([contract], [model, { number: 'FAC-2026-007', issue_date: '2026-11-25', status: 'a_regler' }], '2026-12-01');
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      number: 'FAC-2026-008', title: 'Contrat de maintenance · mensualité · mois de décembre 2026', notes: 'Période facturée : mois de décembre 2026.', issue_date: '2026-12-01',
      due_date: '2026-12-31', status: 'a_regler', visible: true, related_document_id: 'c1', lines: model.lines,
    });
  });

  it('ne crée rien si la facture du mois existe ou si le contrat est terminé', () => {
    expect(planMonthlyInvoices([contract], [model], '2026-11-30').plan).toHaveLength(0);
    expect(planMonthlyInvoices([{ ...contract, status: 'termine' }], [model], '2026-12-01').plan).toHaveLength(0);
    expect(planMonthlyInvoices([contract], [{ ...model, status: 'annulee' }], '2026-12-01').plan).toHaveLength(0);
  });

  it('numérote par année et renomme le mois', () => {
    expect(nextInvoiceNumber(['FAC-2026-009', 'DEV-2027-004'], '2027')).toBe('FAC-2027-001');
    expect(monthlyTitle('Maintenance · mois de décembre 2026', '2027-01-01')).toBe('Maintenance · mois de janvier 2027');
    expect(monthlyTitle('Maintenance de décembre 2026', '2027-01-01')).toBe('Maintenance · mois de janvier 2027');
    expect(periodNotes('Période facturée : mois de décembre 2026.\nMerci', '2027-01-01')).toBe('Période facturée : mois de janvier 2027.\nMerci');
    expect(parisToday(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01');
  });
});
