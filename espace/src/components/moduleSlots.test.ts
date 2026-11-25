import { describe, expect, it } from 'vitest';
import { moduleSlots } from './ModuleMatrix';
import type { Doc } from '../lib/types';

const doc = (p: Partial<Doc>): Doc => ({ id: Math.random().toString(), kind: 'facture', number: '', title: '', module: 'Suivi flotte', status: 'a_regler', issue_date: '2026-06-01', visible: true, lines: [], discount_pct: 0, vat_rate: 0, ...p } as Doc);

describe('moduleSlots', () => {
  it('range devis, facture de lancement et facture de clôture', () => {
    const devis = doc({ kind: 'devis', status: 'a_signer', number: 'DEV1' });
    const lancement = doc({ number: 'FAC-1', title: 'Module Suivi flotte · lancement' });
    const cloture = doc({ number: 'FAC-1-B', title: 'Module Suivi flotte · clôture', issue_date: '2026-07-02' });
    const autre = doc({ module: 'Suivi activité', number: 'FAC-2' });
    const s = moduleSlots('suivi flotte ', [cloture, autre, lancement, devis]);
    expect(s.devis).toBe(devis);
    expect(s.lancement).toBe(lancement);
    expect(s.cloture).toBe(cloture);
  });
  it('sans mot « clôture », la 2e facture devient la clôture ; les annulées sont ignorées', () => {
    const a = doc({ number: 'A', issue_date: '2026-01-01' });
    const b = doc({ number: 'B', issue_date: '2026-02-01' });
    const c = doc({ number: 'C', status: 'annulee', issue_date: '2025-01-01' });
    const s = moduleSlots('Suivi flotte', [b, c, a]);
    expect(s.lancement).toBe(a);
    expect(s.cloture).toBe(b);
    expect(s.devis).toBeUndefined();
  });
});
