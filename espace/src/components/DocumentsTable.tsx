import type { ReactNode } from 'react';
import { computeTotals, euros, frDate } from '../lib/money';
import { KIND_LABEL } from '../lib/labels';
import type { Doc } from '../lib/types';
import { Empty, StatusBadge } from './ui';

interface Props {
  docs: Doc[];
  actions?: (doc: Doc) => ReactNode;
  onRowClick?: (doc: Doc) => void;
  showKind?: boolean;
  empty?: string;
}

export function docAmount(doc: Doc): string {
  if (doc.kind !== 'devis' && doc.kind !== 'facture') return '';
  return euros(computeTotals(doc.lines, doc.discount_pct, doc.vat_rate).total);
}

export default function DocumentsTable({ docs, actions, onRowClick, showKind, empty = 'Aucun document.' }: Props) {
  if (!docs.length) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table className="table-cards">
        <thead>
          <tr>
            {showKind && <th>Type</th>}
            <th>Numéro</th>
            <th>Objet</th>
            <th>Date</th>
            <th className="num">Montant TTC</th>
            <th>Statut</th>
            {actions && <th className="num">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className={onRowClick ? 'clickable' : undefined} onClick={onRowClick ? () => onRowClick(d) : undefined}>
              {showKind && <td data-label="Type">{KIND_LABEL[d.kind]}</td>}
              <td className="cell-title"><strong>{d.number || '—'}</strong></td>
              <td data-label="Objet"><span>{d.title}{d.module && <span className="small muted" style={{ display: 'block' }}>{d.module}</span>}</span></td>
              <td data-label="Date">{frDate(d.issue_date)}</td>
              <td className="num" data-label="Montant TTC">{docAmount(d) || '—'}</td>
              <td data-label="Statut"><StatusBadge kind={d.kind} status={d.status} /></td>
              {actions && <td className="num cell-actions" onClick={(e) => e.stopPropagation()}><div className="row" style={{ justifyContent: 'flex-end' }}>{actions(d)}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
