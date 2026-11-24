import { Fragment, useState } from 'react';
import type { Doc, Project } from '../lib/types';
import { StatusBadge } from './ui';

type Slot = 'devis' | 'lancement' | 'cloture';

const COLUMNS: { slot: Slot; title: string; pill: string }[] = [
  { slot: 'devis', title: 'Devis client', pill: 'Devis client' },
  { slot: 'lancement', title: 'Facture de lancement', pill: 'Facture' },
  { slot: 'cloture', title: 'Facture de clôture', pill: 'Facture' },
];

const norm = (s: string) => s.trim().toLowerCase();
const isCloture = (d: Doc) => /cl[oô]ture/i.test(`${d.title} ${d.number}`);

/** Range les devis et factures d'un module dans les trois cases du tableau. */
export function moduleSlots(moduleName: string, docs: Doc[]): Record<Slot, Doc | undefined> {
  const mine = docs.filter((d) => norm(d.module) === norm(moduleName));
  const byDate = (a: Doc, b: Doc) => a.issue_date.localeCompare(b.issue_date);
  const devis = mine.filter((d) => d.kind === 'devis' && d.status !== 'archive').sort(byDate).pop();
  const factures = mine.filter((d) => d.kind === 'facture' && d.status !== 'annulee').sort(byDate);
  const cloture = factures.find(isCloture);
  const others = factures.filter((d) => d !== cloture);
  return { devis, lancement: others[0], cloture: cloture ?? others[1] };
}

interface Props {
  modules: Project['modules'];
  docs: Doc[];
  onOpen: (doc: Doc) => void;
  busyId?: string | null;
}

export default function ModuleMatrix({ modules, docs, onOpen, busyId }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  if (!modules.length) return null;
  return (
    <div className="table-wrap">
      <table className="table-cards matrix">
        <thead>
          <tr>
            <th>Module</th>
            {COLUMNS.map((c) => <th key={c.slot}>{c.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {modules.map((m, i) => {
            const slots = moduleSlots(m.name, docs);
            return (
              <Fragment key={i}>
                <tr>
                  <td className="cell-title">
                    <button type="button" className="matrix-module" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                      {m.name} <span aria-hidden="true" className={`chevron${open === i ? ' open' : ''}`}>›</span>
                    </button>
                  </td>
                  {COLUMNS.map((c) => {
                    const d = slots[c.slot];
                    return (
                      <td key={c.slot} data-label={c.title}>
                        <span className="matrix-cell">
                          {d ? (
                            <button type="button" className="pill" disabled={busyId === d.id} onClick={() => onOpen(d)} title={d.number}>
                              {c.pill}
                            </button>
                          ) : (
                            <span className="pill pill-empty">{c.pill}</span>
                          )}
                          {d && <StatusBadge kind={d.kind} status={d.status} />}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {open === i && m.description && (
                  <tr className="matrix-desc">
                    <td colSpan={4}><p className="muted small" style={{ margin: 0, whiteSpace: 'pre-line' }}>{m.description.trim()}</p></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
