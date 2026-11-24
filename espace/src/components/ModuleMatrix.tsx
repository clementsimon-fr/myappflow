import { Fragment, useState } from 'react';
import { euros } from '../lib/money';
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

/** Le contrat de maintenance du projet : l'actif s'il existe, sinon le plus récent. */
export function projectContract(docs: Doc[]): Doc | undefined {
  const contracts = docs.filter((d) => d.kind === 'contrat').sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  return contracts.find((d) => d.status === 'actif') ?? contracts[0];
}

export const hasSubscriptions = (modules: Project['modules']) => modules.some((m) => Number(m.monthly_fee) > 0);

/** Documents qui apparaissent dans le tableau (les autres sont listés à part). */
export function matrixDocIds(modules: Project['modules'], docs: Doc[]): Set<string> {
  const ids = new Set<string>();
  for (const m of modules) for (const d of Object.values(moduleSlots(m.name, docs))) if (d) ids.add(d.id);
  const contract = projectContract(docs);
  if (contract && hasSubscriptions(modules)) ids.add(contract.id);
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
  const contract = projectContract(docs);
  const showSubs = hasSubscriptions(modules) || Boolean(contract);

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
            {showSubs && <th>Abonnement</th>}
          </tr>
        </thead>
        <tbody>
          {modules.map((m, i) => {
            const slots = moduleSlots(m.name, docs);
            const fee = Number(m.monthly_fee) || 0;
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
                  {showSubs && (
                    <td data-label="Abonnement">
                      {fee > 0 && contract ? (
                        <button type="button" className="doc-chip" onClick={() => onOpen(contract)} title={`Inclus dans le contrat ${contract.number}`}>
                          <span className="doc-chip-ref">{euros(fee)} / mois</span>
                          <span className="small muted">{contract.number}</span>
                        </button>
                      ) : (
                        <span className="doc-chip doc-chip-empty">{fee > 0 ? `${euros(fee)} / mois` : 'Aucun'}</span>
                      )}
                    </td>
                  )}
                </tr>
                {open === i && m.description && (
                  <tr className="matrix-desc">
                    <td colSpan={showSubs ? 5 : 4}><p className="muted small" style={{ margin: 0, whiteSpace: 'pre-line' }}>{m.description.trim()}</p></td>
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
