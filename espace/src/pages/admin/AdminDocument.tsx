import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { supabase, BUCKET } from '../../lib/supabase';
import { must, useAsync } from '../../lib/useAsync';
import { computeTotals, euros, lineTotal } from '../../lib/money';
import { KIND_LABEL, STATUSES } from '../../lib/labels';
import { getSettings } from '../../lib/docActions';
import { downloadBlob, openStoredFile, uploadDocFile } from '../../lib/files';
import type { Client, Doc, DocLine, Project } from '../../lib/types';
import { ErrorBox, Field, StatusBadge } from '../../components/ui';

const today = () => new Date().toISOString().slice(0, 10);

export default function AdminDocument() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const d = must(await supabase.from('documents').select('*').eq('id', documentId!).single()) as Doc;
    const project = must(await supabase.from('projects').select('*').eq('id', d.project_id).single()) as Project;
    const [client, related] = await Promise.all([
      supabase.from('clients').select('*').eq('id', project.client_id).single(),
      supabase.from('documents').select('id, kind, number, title').eq('project_id', d.project_id).neq('id', d.id),
    ]);
    return { doc: d, project, client: must(client) as Client, related: must(related) as Pick<Doc, 'id' | 'kind' | 'number' | 'title'>[] };
  }, [documentId]);

  useEffect(() => {
    if (data) {
      setDoc({ ...data.doc, lines: data.doc.lines ?? [] });
      setDirty(false);
    }
  }, [data]);

  if (loading || !doc || !data) return <><ErrorBox error={error} /><p className="muted">Chargement…</p></>;
  const { project, client } = data;
  const priced = doc.kind === 'devis' || doc.kind === 'facture';
  const totals = computeTotals(doc.lines, doc.discount_pct, doc.vat_rate);

  const patch = (p: Partial<Doc>) => {
    setDoc({ ...doc, ...p });
    setDirty(true);
  };
  const setLine = (i: number, p: Partial<DocLine>) => patch({ lines: doc.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const moveLine = (i: number, delta: number) => {
    const lines = [...doc.lines];
    const [l] = lines.splice(i, 1);
    lines.splice(i + delta, 0, l);
    patch({ lines });
  };

  const wrap = async (fn: () => Promise<void>, success?: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      if (success) setMsg(success);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const persist = async (extra: Partial<Doc> = {}) => {
    const next = { ...doc, ...extra };
    const { id, created_at, updated_at, project_id, kind, ...fields } = next;
    void created_at; void updated_at; void project_id; void kind;
    const lines = fields.lines.map((l) => ({ ...l, quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0 }));
    must(await supabase.from('documents').update({ ...fields, lines, due_date: fields.due_date || null, acquitted_at: fields.acquitted_at || null }).eq('id', id).select());
    await reload();
  };

  const save = () => wrap(() => persist(), 'Document enregistré.');

  const send = () =>
    wrap(
      () => persist({ visible: true, status: doc.kind === 'devis' ? 'a_signer' : doc.kind === 'facture' ? 'a_regler' : doc.kind === 'contrat' ? 'actif' : 'publie' }),
      'Document publié dans l\'espace du client.',
    );

  const acquit = () =>
    wrap(() => persist({ status: 'acquittee', acquitted_at: today() }), 'Facture acquittée : le client voit désormais la facture acquittée.');

  const validateSignature = () => wrap(() => persist({ status: 'signe' }), 'Devis marqué comme signé.');

  const preview = () =>
    wrap(async () => {
      const { buildPdf, pdfFilename } = await import('../../lib/pdf');
      const pdf = buildPdf(doc, client, await getSettings(true));
      downloadBlob(pdf.output('blob'), pdfFilename(doc, client));
    });

  const createInvoice = () =>
    wrap(async () => {
      if (dirty) await persist();
      const { data: number, error: e1 } = await supabase.rpc('next_document_number', { p_kind: 'facture' });
      if (e1) throw new Error(e1.message);
      const due = new Date();
      due.setDate(due.getDate() + 30);
      const inv = must(
        await supabase
          .from('documents')
          .insert({
            project_id: doc.project_id,
            kind: 'facture',
            number,
            title: doc.title,
            module: doc.module,
            lines: doc.lines,
            discount_pct: doc.discount_pct,
            vat_rate: doc.vat_rate,
            related_document_id: doc.id,
            notes: '',
            due_date: due.toISOString().slice(0, 10),
          })
          .select()
          .single(),
      ) as Doc;
      navigate(`/documents/${inv.id}`);
    });

  const onFile = (file: File | undefined) => {
    if (!file) return;
    wrap(async () => {
      const path = await uploadDocFile(doc, file);
      if (doc.file_path) await supabase.storage.from(BUCKET).remove([doc.file_path]);
      await persist({ file_path: path });
    }, 'PDF déposé : il remplace le PDF généré pour ce document.');
    if (fileInput.current) fileInput.current.value = '';
  };

  const removeFile = () =>
    wrap(async () => {
      if (doc.file_path) await supabase.storage.from(BUCKET).remove([doc.file_path]);
      await persist({ file_path: null });
    }, 'PDF déposé retiré : le PDF sera de nouveau généré à partir des données.');

  const remove = () => {
    if (!window.confirm(`Supprimer définitivement ${KIND_LABEL[doc.kind].toLowerCase()} ${doc.number} ?`)) return;
    wrap(async () => {
      const files = [doc.file_path, doc.signed_file_path].filter(Boolean) as string[];
      if (files.length) await supabase.storage.from(BUCKET).remove(files);
      must(await supabase.from('documents').delete().eq('id', doc.id).select());
      navigate(`/projets/${doc.project_id}`);
    });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumbs">
            <Link to={`/clients/${client.id}`}>{client.name}</Link> / <Link to={`/projets/${project.id}`}>{project.name}</Link>
          </p>
          <h1>{KIND_LABEL[doc.kind]} {doc.number}</h1>
        </div>
        <div className="row">
          <StatusBadge kind={doc.kind} status={data.doc.status} />
          {data.doc.visible && data.doc.status !== 'brouillon' ? <span className="badge badge-ok">Visible par le client</span> : <span className="badge">Non visible</span>}
        </div>
      </div>
      <ErrorBox error={err} />
      {msg && <div className="alert alert-ok">{msg}</div>}

      {doc.signed_file_path && (
        <div className="alert alert-info row">
          <span>Le client a déposé son devis signé.</span>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => wrap(() => openStoredFile(doc.signed_file_path!))}>Ouvrir</button>
          {doc.status === 'a_signer' && <button className="btn btn-sm btn-primary" onClick={validateSignature}>Valider la signature</button>}
        </div>
      )}
      {doc.client_paid_declared_at && doc.status === 'reglement_declare' && (
        <div className="alert alert-info row">
          <span>Le client a déclaré avoir réglé cette facture. Vérifiez la réception du virement.</span>
          <span className="spacer" />
          <button className="btn btn-sm btn-primary" onClick={acquit}>Acquitter la facture</button>
        </div>
      )}

      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Actions</h2>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={save} disabled={!dirty}>Enregistrer</button>
            {doc.status === 'brouillon' && <button className="btn btn-primary" onClick={send}>Publier pour le client</button>}
            <button className="btn" onClick={preview}>Aperçu PDF</button>
            {(doc.kind === 'devis' || doc.kind === 'contrat') && <button className="btn" onClick={createInvoice}>Créer la facture de ce {doc.kind}</button>}
            {doc.kind === 'facture' && ['a_regler', 'reglement_declare'].includes(doc.status) && <button className="btn" onClick={acquit}>Acquitter</button>}
            <button className="btn" onClick={() => fileInput.current?.click()}>{doc.file_path ? 'Remplacer le PDF déposé' : 'Déposer un PDF existant'}</button>
            {doc.file_path && <button className="btn" onClick={() => wrap(() => openStoredFile(doc.file_path!))}>Voir le PDF déposé</button>}
            {doc.file_path && <button className="btn btn-danger btn-sm" onClick={removeFile}>Retirer le PDF déposé</button>}
            <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          {doc.file_path && <p className="small muted" style={{ marginTop: 10 }}>Un PDF déposé est utilisé à la place du PDF généré (pratique pour les documents de l'ancien site).</p>}
        </section>

        <section className="card">
          <div className="card-head"><h2>Informations</h2></div>
          <div className="form-grid">
            <Field label="Numéro"><input value={doc.number} onChange={(e) => patch({ number: e.target.value })} /></Field>
            <Field label="Objet"><input value={doc.title} onChange={(e) => patch({ title: e.target.value })} placeholder="ex. Module Suivi flotte" /></Field>
            <Field label="Module">
              <input list="modules" value={doc.module} onChange={(e) => patch({ module: e.target.value })} />
              <datalist id="modules">{project.modules.map((m) => <option key={m.name} value={m.name} />)}</datalist>
            </Field>
            <Field label="Statut">
              <select value={doc.status} onChange={(e) => patch({ status: e.target.value })}>
                {STATUSES[doc.kind].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label={doc.kind === 'facture' ? "Date d'émission" : 'Date'}><input type="date" value={doc.issue_date} onChange={(e) => patch({ issue_date: e.target.value })} /></Field>
            {doc.kind !== 'contrat' && doc.kind !== 'autre' && (
              <Field label={doc.kind === 'devis' ? "Valide jusqu'au" : 'Échéance'}><input type="date" value={doc.due_date ?? ''} onChange={(e) => patch({ due_date: e.target.value })} /></Field>
            )}
            {doc.kind === 'facture' && (
              <>
                <Field label="Devis lié">
                  <select value={doc.related_document_id ?? ''} onChange={(e) => patch({ related_document_id: e.target.value || null })}>
                    <option value="">Aucun</option>
                    {data.related.filter((r) => r.kind === 'devis').map((r) => <option key={r.id} value={r.id}>{r.number} {r.title}</option>)}
                  </select>
                </Field>
                <Field label="Acquittée le"><input type="date" value={doc.acquitted_at ?? ''} onChange={(e) => patch({ acquitted_at: e.target.value })} /></Field>
              </>
            )}
            <label className="check full"><input type="checkbox" checked={doc.visible} onChange={(e) => patch({ visible: e.target.checked })} /> Visible dans l'espace du client (hors brouillon)</label>
          </div>
        </section>

        {priced && (
          <section className="card">
            <div className="card-head">
              <h2>Lignes</h2>
              <button className="btn btn-sm" onClick={() => patch({ lines: [...doc.lines, { title: '', description: '', quantity: 1, unit_price: 0 }] })}>+ Ligne</button>
            </div>
            {doc.lines.map((l, i) => (
              <div key={i} className="line-editor">
                <div className="stack" style={{ gap: 6 }}>
                  <input value={l.title} onChange={(e) => setLine(i, { title: e.target.value })} placeholder="Désignation (ex. Prototyper)" />
                  <textarea value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description" />
                </div>
                <Field label="Qté"><input type="number" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value as unknown as number })} /></Field>
                <Field label="P.U. HT (€)"><input type="number" step="any" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value as unknown as number })} /></Field>
                <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                  <strong className="small">{euros(lineTotal(l))}</strong>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-sm" disabled={i === 0} onClick={() => moveLine(i, -1)} aria-label="Monter">↑</button>
                    <button className="btn btn-sm" disabled={i === doc.lines.length - 1} onClick={() => moveLine(i, 1)} aria-label="Descendre">↓</button>
                    <button className="btn btn-sm btn-danger" onClick={() => patch({ lines: doc.lines.filter((_, j) => j !== i) })} aria-label="Supprimer la ligne">✕</button>
                  </div>
                </div>
              </div>
            ))}
            <div className="form-grid" style={{ marginTop: 16 }}>
              <Field label="Remise (%)"><input type="number" min={0} max={100} step="any" value={doc.discount_pct} onChange={(e) => patch({ discount_pct: e.target.value as unknown as number })} /></Field>
              <Field label="TVA (%) — 0 = non applicable"><input type="number" min={0} max={100} step="any" value={doc.vat_rate} onChange={(e) => patch({ vat_rate: e.target.value as unknown as number })} /></Field>
            </div>
            <div className="totals" style={{ marginTop: 16 }}>
              <div><span>Sous-total HT</span><span>{euros(totals.subtotal)}</span></div>
              {totals.discount > 0 && <div><span>Remise</span><span>-{euros(totals.discount)}</span></div>}
              {totals.discount > 0 && <div><span>Total HT après remise</span><span>{euros(totals.net)}</span></div>}
              {totals.vat > 0 && <div><span>TVA</span><span>{euros(totals.vat)}</span></div>}
              <div className="grand"><span>Total TTC</span><span>{euros(totals.total)}</span></div>
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-head"><h2>{priced ? 'Conditions et notes' : 'Contenu'}</h2></div>
          <div className="form-grid">
            {!priced && <Field label="Texte du document" full><textarea value={doc.body} onChange={(e) => patch({ body: e.target.value })} rows={18} /></Field>}
            {priced && <Field label={doc.kind === 'devis' ? 'Échéancier de paiement' : 'Conditions de paiement'} full><textarea value={doc.payment_terms} onChange={(e) => patch({ payment_terms: e.target.value })} placeholder="ex. 300 € au démarrage, 600 € à la livraison" /></Field>}
            <Field label="Notes (imprimées sur le PDF)" full><textarea value={doc.notes} onChange={(e) => patch({ notes: e.target.value })} /></Field>
          </div>
        </section>

        <div className="row">
          <button className="btn btn-primary" onClick={save} disabled={!dirty}>Enregistrer</button>
          <span className="spacer" />
          <button className="btn btn-danger btn-sm" onClick={remove}>Supprimer le document</button>
        </div>
      </div>
    </>
  );
}
