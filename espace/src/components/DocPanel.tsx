import { useEffect, useRef, type ReactNode } from 'react';
import { computeTotals, euros, frDate } from '../lib/money';
import { KIND_LABEL } from '../lib/labels';
import type { Doc, Project, Settings } from '../lib/types';
import { StatusBadge } from './ui';

interface Props {
  doc: Doc;
  project: Project;
  settings: Settings | null;
  busy: boolean;
  error?: string | null;
  /** Vue client de l'administrateur : on montre tout mais on n'agit pas. */
  readOnly?: boolean;
  onClose: () => void;
  onDownload: () => void;
  onUploadSigned: () => void;
  onDeclarePayment: () => void;
  onOpenSigned: () => void;
}

export const docTotal = (d: Doc) => computeTotals(d.lines, d.discount_pct, d.vat_rate).total;

function Step({ n, done, children }: { n: number; done?: boolean; children: ReactNode }) {
  return (
    <li className={`step${done ? ' step-done' : ''}`}>
      <span className="step-num" aria-hidden="true">{done ? '✓' : n}</span>
      <div>{children}</div>
    </li>
  );
}

/** Fiche d'un document : ce que c'est, où on en est, et ce que le client doit faire. */
export default function DocPanel({ doc, project, settings, busy, error, readOnly, onClose, onDownload, onUploadSigned, onDeclarePayment, onOpenSigned }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const amount = doc.kind === 'devis' || doc.kind === 'facture' ? docTotal(doc) : null;
  const disabledTitle = readOnly ? 'Action du client, désactivée en vue client' : undefined;
  const subs = project.modules.filter((m) => Number(m.monthly_fee) > 0);
  const monthly = subs.reduce((s, m) => s + Number(m.monthly_fee), 0);
  const bank = settings?.iban ? settings : null;

  let body: ReactNode = null;
  if (doc.kind === 'devis') {
    if (doc.status === 'a_signer' && !doc.signed_file_path) {
      body = (
        <>
          <p className="panel-lead">Ce devis attend votre accord. Trois étapes :</p>
          <ol className="steps">
            <Step n={1}>
              Téléchargez le devis.
              <div><button className="btn btn-sm" onClick={onDownload} disabled={busy}>Télécharger le devis (PDF)</button></div>
            </Step>
            <Step n={2}>Imprimez-le ou ouvrez-le, puis signez-le avec la mention « Bon pour accord ».</Step>
            <Step n={3}>
              Envoyez-nous le devis signé (PDF ou photo).
              <div><button className="btn btn-primary" onClick={onUploadSigned} disabled={busy || readOnly} title={disabledTitle}>Envoyer le devis signé</button></div>
            </Step>
          </ol>
        </>
      );
    } else if (doc.status === 'a_signer') {
      body = <p className="panel-lead ok">Merci, nous avons bien reçu votre devis signé le {frDate(doc.signed_uploaded_at)}. Il sera validé très prochainement.</p>;
    } else if (doc.status === 'signe') {
      body = <p className="panel-lead ok">Devis signé : merci pour votre confiance.</p>;
    } else if (doc.status === 'refuse') {
      body = <p className="panel-lead">Ce devis n'a pas été retenu.</p>;
    }
  } else if (doc.kind === 'facture') {
    if (doc.status === 'a_regler') {
      body = (
        <>
          <p className="panel-lead">
            Montant à régler : <strong>{euros(amount ?? 0)}</strong>{doc.due_date && <> avant le <strong>{frDate(doc.due_date)}</strong></>}.
          </p>
          <ol className="steps">
            <Step n={1}>
              Effectuez le paiement{bank ? ' par virement :' : '.'}
              {bank && (
                <dl className="bank">
                  {bank.bank_holder && <><dt>Titulaire</dt><dd>{bank.bank_holder}</dd></>}
                  <dt>IBAN</dt><dd className="mono">{bank.iban}</dd>
                  {bank.bic && <><dt>BIC</dt><dd className="mono">{bank.bic}</dd></>}
                  <dt>Référence</dt><dd className="mono">{doc.number}</dd>
                </dl>
              )}
              {doc.payment_terms && <p className="small muted" style={{ whiteSpace: 'pre-line', margin: '6px 0 0' }}>{doc.payment_terms}</p>}
            </Step>
            <Step n={2}>
              Prévenez-nous une fois le paiement fait.
              <div><button className="btn btn-primary" onClick={onDeclarePayment} disabled={busy || readOnly} title={disabledTitle}>J'ai effectué le règlement</button></div>
            </Step>
          </ol>
        </>
      );
    } else if (doc.status === 'reglement_declare') {
      body = <p className="panel-lead">Vous nous avez signalé votre règlement le {frDate(doc.client_paid_declared_at)}. Il est en cours de vérification ; la facture acquittée sera ensuite disponible ici.</p>;
    } else if (doc.status === 'acquittee') {
      body = <p className="panel-lead ok">Facture réglée{doc.acquitted_at && <> le {frDate(doc.acquitted_at)}</>}. Merci ! Le PDF porte la mention « acquittée ».</p>;
    } else if (doc.status === 'annulee') {
      body = <p className="panel-lead">Cette facture a été annulée : vous n'avez rien à payer.</p>;
    }
  } else if (doc.kind === 'contrat') {
    body = (
      <>
        <p className="panel-lead">{doc.status === 'actif' ? 'Votre contrat de maintenance est en cours.' : 'Contrat de maintenance.'}</p>
        {subs.length > 0 && (
          <table className="subs">
            <tbody>
              {subs.map((m) => <tr key={m.name}><td>{m.name}</td><td className="num">{euros(Number(m.monthly_fee))} / mois</td></tr>)}
              <tr className="subs-total"><td>Total</td><td className="num">{euros(monthly)} / mois</td></tr>
            </tbody>
          </table>
        )}
      </>
    );
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <p className="small muted" style={{ margin: 0 }}>{KIND_LABEL[doc.kind]} {doc.number}</p>
            <h2 id="panel-title" style={{ margin: '2px 0 6px' }}>{doc.title || KIND_LABEL[doc.kind]}</h2>
            <div className="row">
              <StatusBadge kind={doc.kind} status={doc.status} />
              {doc.module && <span className="small muted">{doc.module}</span>}
            </div>
          </div>
          <button ref={closeRef} className="btn btn-sm" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="panel-facts">
          {amount !== null && <div><span>Montant</span><strong>{euros(amount)}</strong></div>}
          <div><span>Date</span><strong>{frDate(doc.issue_date)}</strong></div>
          {doc.due_date && doc.kind === 'facture' && <div><span>Échéance</span><strong>{frDate(doc.due_date)}</strong></div>}
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {body}

        <div className="panel-foot">
          <button className="btn" onClick={onDownload} disabled={busy}>Télécharger le PDF</button>
          {doc.signed_file_path && <button className="btn" onClick={onOpenSigned} disabled={busy}>Voir le devis signé envoyé</button>}
        </div>
      </div>
    </div>
  );
}
