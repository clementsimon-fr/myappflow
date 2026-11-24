import { Fragment, useState } from 'react';
import type { Doc, Project } from '../lib/types';
import { StatusBadge } from './ui';

type Slot = 'devis' | 'lancement' | 'cloture';

const COLUMNS: { slot: Slot; title: string; empty: string }[] = [
  { slot: 'devis', title: 'Devis', empty: 'Pas de devis' },
  { slot: 'lancement', title: 'Facture de lancement', empty: 'À venir' },
  { slot: 'cloture', title: 'Facture de clôture', empty: 'À venir' },
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

/** Documents qui apparaissent dans le tableau. */
export function matrixDocIds(modules: Project['modules'], docs: Doc[]): Set<string> {
  const ids = new Set<string>();
  for (const m of modules) for (const d of Object.values(moduleSlots(m.name, docs))) if (d) ids.add(d.id);
  return ids;
}

interface Props {
  modules: Project['modules'];
  docs: Doc[];
  onOpen: (doc: Doc) => void;
  /** Met en avant les documents qui attendent une action du client. */
  highlight?: (doc: Doc) => boolean;
}

export default function ModuleMatrix({ modules, docs, onOpen, highlight }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  if (!modules.length) return null;

  const cell = (d: Doc | undefined, empty: string) =>
    d ? (
      <button type="button" className={`doc-chip${highlight?.(d) ? ' doc-chip-todo' : ''}`} onClick={() => onOpen(d)}>
        <span className="doc-chip-ref">{d.number || 'Sans numéro'}</span>
        <StatusBadge kind={d.kind} status={d.status} />
      </button>
    ) : (
      <span className="doc-chip doc-chip-empty">{empty}</span>
    );

  return (
    <div className="table-wrap">
      <table className="table-cards matrix">
        <thead>
          <tr>
            <th className="matrix-col-module">Module</th>
            {COLUMNS.map((c) => <th key={c.slot}>{c.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {modules.map((m, i) => {
            const slots = moduleSlots(m.name, docs);
            return (
              <Fragment key={i}>
                <tr>
                  <td className="cell-title matrix-col-module">
                    <button type="button" className="matrix-module" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} title="Voir la description du module">
                      {m.name} <span aria-hidden="true" className={`chevron${open === i ? ' open' : ''}`}>›</span>
                    </button>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.slot} data-label={c.title}>{cell(slots[c.slot], c.empty)}</td>
                  ))}
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
