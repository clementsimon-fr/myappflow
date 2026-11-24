import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { must, useAsync } from '../lib/useAsync';
import { downloadDocument, getSettings } from '../lib/docActions';
import { openStoredFile, uploadDocFile } from '../lib/files';
import { euros } from '../lib/money';
import { PROJECT_STATUS } from '../lib/labels';
import type { Client, Doc, Project, Settings } from '../lib/types';
import ModuleMatrix, { matrixDocIds } from '../components/ModuleMatrix';
import DocPanel, { docTotal } from '../components/DocPanel';
import PreviewBanner, { clientVisible } from '../components/PreviewBanner';
import Roadmap from '../components/Roadmap';
import { ErrorBox, StatusBadge } from '../components/ui';

/** Documents qui attendent une action du client (mis en évidence dans le tableau). */
const needsAction = (d: Doc) => (d.kind === 'devis' && d.status === 'a_signer' && !d.signed_file_path) || (d.kind === 'facture' && d.status === 'a_regler');

function DocChip({ doc, onOpen, sub }: { doc: Doc; onOpen: (d: Doc) => void; sub?: string }) {
  return (
    <button type="button" className={`doc-chip${needsAction(doc) ? ' doc-chip-todo' : ''}`} onClick={() => onOpen(doc)}>
      <span className="doc-chip-ref">{doc.number || 'Sans numéro'}</span>
      {sub && <span className="small muted">{sub}</span>}
      <StatusBadge kind={doc.kind} status={doc.status} />
    </button>
  );
}

export default function ClientProject({ preview = false }: { preview?: boolean }) {
  const { projectId } = useParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const [projectRes, docsRes, countRes, settings] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId!).maybeSingle(),
      supabase.from('documents').select('*').eq('project_id', projectId!).order('issue_date', { ascending: false }),
      supabase.from('projects').select('id', { count: 'exact', head: true }).neq('status', 'archive'),
      getSettings().catch(() => null as Settings | null),
    ]);
    const project = must(projectRes) as Project | null;
    const client = project ? (must(await supabase.from('clients').select('*').eq('id', project.client_id).maybeSingle()) as Client) : null;
    const docs = must(docsRes) as Doc[];
    // En vue client, l'administrateur voit tout : on applique ici les mêmes règles que pour le client.
    return { project, client, settings, docs: preview ? clientVisible(docs) : docs, manyProjects: preview || (countRes.count ?? 0) > 1 };
  }, [projectId, preview]);

  const run = async (fn: () => Promise<void>, success?: string) => {
    setActionError(null);
    setNotice(null);
    setBusy(true);
    try {
      await fn();
      if (success) {
        setNotice(success);
        setOpenId(null);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="muted">Chargement…</p>;
  if (!data?.project || !data.client) return <><ErrorBox error={error} /><p>Projet introuvable. <Link to="/">Retour</Link></p></>;
  const { project, client, docs, settings } = data;
  const home = preview ? `/apercu/clients/${client.id}` : '/';
  const byId = new Map(docs.map((d) => [d.id, d]));
  const openDoc = openId ? byId.get(openId) ?? null : null;
  const open = (d: Doc) => {
    setActionError(null);
    setOpenId(d.id);
  };

  const onFileChosen = async (file: File | undefined) => {
    const doc = openDoc;
    if (fileInput.current) fileInput.current.value = '';
    if (!file || !doc) return;
    if (file.size > 10 * 1024 * 1024) return setActionError('Fichier trop lourd (10 Mo maximum).');
    await run(async () => {
      const path = await uploadDocFile(doc, file, 'signe-');
      const { error: err } = await supabase.rpc('client_attach_signed_devis', { p_document_id: doc.id, p_path: path });
      if (err) throw new Error(err.message);
      await reload();
    }, `Merci, votre devis ${doc.number} signé a bien été envoyé.`);
  };

  const declarePayment = (d: Doc) => {
    if (!window.confirm(`Confirmez-vous avoir payé la facture ${d.number} (${euros(docTotal(d))}) ?`)) return;
    run(async () => {
      const { error: err } = await supabase.rpc('client_declare_payment', { p_document_id: d.id });
      if (err) throw new Error(err.message);
      await reload();
    }, `Merci, votre paiement de la facture ${d.number} a été signalé. Nous le vérifions.`);
  };

  // Bloc Contrat : les contrats, et les factures rattachées à un contrat.
  const contracts = docs.filter((d) => d.kind === 'contrat').sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  const contractInvoices = docs
    .filter((d) => d.kind === 'facture' && d.related_document_id && byId.get(d.related_document_id)?.kind === 'contrat')
    .sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  const monthly = contractInvoices[0] ? docTotal(contractInvoices[0]) : 0;
  // Ce qui n'entre ni dans le tableau ni dans le contrat (rare) reste accessible en dessous.
  const placed = new Set([...matrixDocIds(project.modules, docs), ...contracts.map((d) => d.id), ...contractInvoices.map((d) => d.id)]);
  const others = docs.filter((d) => !placed.has(d.id));
  const todo = docs.filter(needsAction).length;

  return (
    <>
      {preview && <PreviewBanner clientName={client.name} backTo={`/projets/${project.id}`} />}
      <div className="page-head">
        <div>
          <p className="crumbs">{data.manyProjects ? <><Link to={home}>Mes projets</Link> / </> : null}{client.name}</p>
          <h1>{project.name}</h1>
        </div>
        <span className="badge badge-ok">{PROJECT_STATUS[project.status]}</span>
      </div>

      <ErrorBox error={openDoc ? null : actionError || error} />
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {todo > 0 && (
        <p className="todo-hint">
          <span className="todo-dot" aria-hidden="true" />
          {todo === 1 ? 'Un document attend' : `${todo} documents attendent`} une action de votre part : ils sont encadrés en orange. Cliquez dessus pour signer ou payer.
        </p>
      )}
      <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => onFileChosen(e.target.files?.[0])} />

      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>Modules</h2></div>
          {project.modules.length ? (
            <ModuleMatrix modules={project.modules} docs={docs} onOpen={open} highlight={needsAction} />
          ) : (
            <p className="empty">Aucun module pour le moment.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Contrat</h2>
            {monthly > 0 && <span className="badge badge-ok">{euros(monthly)} / mois</span>}
          </div>
          {contracts.length === 0 ? (
            <p className="empty">Pas encore de contrat de maintenance.</p>
          ) : (
            <div className="contract-grid">
              <div>
                <p className="panel-box-label">Contrat</p>
                <div className="row">{contracts.map((d) => <DocChip key={d.id} doc={d} onOpen={open} sub={d.title} />)}</div>
              </div>
              <div>
                <p className="panel-box-label">Factures du contrat</p>
                {contractInvoices.length ? (
                  <div className="row">{contractInvoices.map((d) => <DocChip key={d.id} doc={d} onOpen={open} sub={`${euros(docTotal(d))}`} />)}</div>
                ) : (
                  <span className="doc-chip doc-chip-empty">À venir</span>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Architecture</h2></div>
          {project.architecture?.trim() ? (
            <div className="architecture">{project.architecture}</div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Informations bientôt disponibles : hébergement de votre application, accès, sauvegarde de vos données.</p>
          )}
        </section>

        {others.length > 0 && (
          <section className="card">
            <div className="card-head"><h2>Autres documents</h2></div>
            <div className="row">{others.map((d) => <DocChip key={d.id} doc={d} onOpen={open} sub={d.title} />)}</div>
          </section>
        )}

        {project.roadmap_visible && (project.roadmap?.phases ?? []).length > 0 && (
          <section className="card">
            <div className="card-head"><h2>Planning</h2></div>
            <Roadmap phases={project.roadmap.phases} />
          </section>
        )}
      </div>

      {openDoc && (
        <DocPanel
          doc={openDoc}
          client={client}
          settings={settings}
          related={openDoc.related_document_id ? byId.get(openDoc.related_document_id) : undefined}
          busy={busy}
          error={actionError}
          readOnly={preview}
          onClose={() => setOpenId(null)}
          onDownload={(variant) => run(() => downloadDocument(openDoc, client, variant))}
          onOpenSigned={() => run(() => openStoredFile(openDoc.signed_file_path!))}
          onUploadSigned={() => fileInput.current?.click()}
          onDeclarePayment={() => declarePayment(openDoc)}
        />
      )}
    </>
  );
}
