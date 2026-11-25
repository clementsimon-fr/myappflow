import { useEffect, useRef } from 'react';
import { computeTotals, euros, frDate, lineTotal } from '../lib/money';
import { KIND_LABEL } from '../lib/labels';
import type { Client, Doc, Settings } from '../lib/types';
import { StatusBadge } from './ui';

interface Props {
  doc: Doc;
  client: Client;
  settings: Settings | null;
  /** Le devis (pour une facture) ou le contrat auquel le document est rattaché. */
  related?: Doc;
  busy: boolean;
  error?: string | null;
  /** Vue client de l'administrateur : on montre tout mais on n'agit pas. */
  readOnly?: boolean;
  onClose: () => void;
  onDownload: (variant: 'plain' | 'acquitted') => void;
  onUploadSigned: () => void;
  onOpenSigned: () => void;
}

export const docTotal = (d: Doc) => computeTotals(d.lines, d.discount_pct, d.vat_rate).total;

const DETAIL: Record<Doc['kind'], string> = {
  devis: 'Détail du devis',
  facture: 'Détail de la facture',
  contrat: 'Contrat de maintenance',
  autre: 'Document',
};

/** Fiche d'un document, présentée comme le document lui-même, avec les actions du client en bas. */
export default function DocPanel({ doc, client, settings, related, busy, error, readOnly, onClose, onDownload, onUploadSigned, onOpenSigned }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const priced = doc.kind === 'devis' || doc.kind === 'facture';
  const totals = computeTotals(doc.lines, doc.discount_pct, doc.vat_rate);
  const noAction = readOnly ? 'Action du client, désactivée en vue client' : undefined;
  const heading = doc.title || KIND_LABEL[doc.kind];
  const acquitted = doc.status === 'acquittee';

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2 id="panel-title" className="panel-title">{heading}</h2>
            <p className="small muted" style={{ margin: 0 }}>{DETAIL[doc.kind]}</p>
          </div>
          <button ref={closeRef} className="btn-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="panel-meta">
          <span><b>N° :</b> {doc.number || '—'}</span>
          {related && <span><b>{KIND_LABEL[related.kind]} :</b> {related.number}</span>}
          <span><b>Émis le :</b> {frDate(doc.issue_date)}</span>
          {doc.due_date && doc.kind !== 'contrat' && <span><b>{doc.kind === 'devis' ? 'Valable jusqu’au' : 'Échéance'} :</b> {frDate(doc.due_date)}</span>}
          <StatusBadge kind={doc.kind} status={doc.status} />
        </div>

        <div className="panel-box">
          <p className="panel-box-label">Émetteur</p>
          <strong>{settings?.issuer_name || 'MyAppFlow'}</strong>
          <div className="small muted">
            {settings?.issuer_address && <div>{settings.issuer_address}</div>}
            {settings?.issuer_siren && <div>SIREN : {settings.issuer_siren}</div>}
            {(settings?.issuer_email || settings?.issuer_phone) && <div>{[settings?.issuer_email, settings?.issuer_phone].filter(Boolean).join(' · ')}</div>}
          </div>
        </div>

        <div className="panel-box">
          <p className="panel-box-label">Client</p>
          <strong>{client.name}</strong>
          {client.address && <div className="small muted">{client.address}</div>}
        </div>

        {priced && (
          <div className="panel-box panel-lines">
            <table>
              <thead>
                <tr><th>Désignation</th><th className="num">Qté</th><th className="num">P.U. HT</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => (
                  <tr key={i}>
                    <td><strong>{l.title}</strong>{l.description && <span className="small muted line-desc">{l.description}</span>}</td>
                    <td className="num">{l.quantity}</td>
                    <td className="num">{euros(Number(l.unit_price) || 0)}</td>
                    <td className="num"><strong>{euros(lineTotal(l))}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="panel-totals">
              <div><span>Sous-total HT</span><span>{euros(totals.subtotal)}</span></div>
              {totals.discount > 0 && <div><span>Remise ({doc.discount_pct} %)</span><span>− {euros(totals.discount)}</span></div>}
              <div><span>TVA : {Number(doc.vat_rate) || 0} %</span><span className="small muted">{Number(doc.vat_rate) ? euros(totals.vat) : settings?.vat_mention || ''}</span></div>
              <div className="grand"><span>Total TTC</span><span>{euros(totals.total)}</span></div>
            </div>
          </div>
        )}

        {doc.kind === 'contrat' && doc.body && <div className="panel-box panel-body">{doc.body}</div>}
        {doc.kind === 'contrat' && (
          <div className="panel-box panel-sign">
            <div>
              <p className="panel-box-label">Le Prestataire</p>
              <strong>{settings?.issuer_name || 'MyAppFlow'}</strong>
              {settings?.signature_data_url && <img src={settings.signature_data_url} alt="Signature du prestataire" />}
            </div>
            <div>
              <p className="panel-box-label">Le Client</p>
              <strong>{client.name}</strong>
            </div>
          </div>
        )}

        {(doc.payment_terms || doc.notes) && (
          <div className="panel-box panel-notes">
            {doc.payment_terms && <><p className="panel-box-label">Échéancier</p><p>{doc.payment_terms}</p></>}
            {doc.notes && <><p className="panel-box-label">Notes</p><p>{doc.notes}</p></>}
          </div>
        )}

        {doc.kind === 'facture' && !acquitted && settings?.iban && (
          <div className="panel-box panel-notes">
            <p className="panel-box-label">Règlement par virement</p>
            <dl className="bank">
              {settings.bank_holder && <><dt>Titulaire</dt><dd>{settings.bank_holder}</dd></>}
              {settings.bank_name && <><dt>Banque</dt><dd>{settings.bank_name}</dd></>}
              <dt>IBAN</dt><dd className="mono">{settings.iban}</dd>
              {settings.bic && <><dt>BIC</dt><dd className="mono">{settings.bic}</dd></>}
              <dt>Référence</dt><dd className="mono">{doc.number}</dd>
            </dl>
          </div>
        )}

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="panel-actions">
          <button className="btn btn-block" onClick={() => onDownload('plain')} disabled={busy}>Télécharger {doc.kind === 'facture' ? 'la facture' : doc.kind === 'devis' ? 'le devis' : doc.kind === 'contrat' ? 'le contrat' : 'le document'}</button>

          {doc.kind === 'facture' && (
            <>
              {doc.status === 'reglement_declare' && <p className="panel-hint">Règlement signalé le {frDate(doc.client_paid_declared_at)}, en cours de vérification.</p>}
              <button className="btn btn-block" onClick={() => onDownload('acquitted')} disabled={busy || !acquitted}>
                {acquitted ? 'Télécharger la facture acquittée' : 'Facture acquittée (disponible après réception du paiement)'}
              </button>
            </>
          )}

          {doc.kind === 'devis' && doc.status === 'a_signer' && !doc.signed_file_path && (
            <>
              <p className="panel-hint">Pour accepter ce devis : téléchargez-le, signez-le avec la mention « Bon pour accord », puis envoyez-le ici (PDF ou photo).</p>
              <button className="btn btn-primary btn-block" onClick={onUploadSigned} disabled={busy || readOnly} title={noAction}>Envoyer le devis signé</button>
            </>
          )}
          {doc.kind === 'devis' && doc.signed_file_path && (
            <>
              {doc.status === 'a_signer' && <p className="panel-hint">Devis signé reçu le {frDate(doc.signed_uploaded_at)}, merci. Il sera validé très prochainement.</p>}
              <button className="btn btn-block" onClick={onOpenSigned} disabled={busy}>Voir le devis signé envoyé</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
