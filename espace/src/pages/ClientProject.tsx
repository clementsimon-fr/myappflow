import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { must, useAsync } from '../lib/useAsync';
import { downloadDocument, getSettings } from '../lib/docActions';
import { openStoredFile, uploadDocFile } from '../lib/files';
import { euros, frDate } from '../lib/money';
import { KIND_PLURAL, PROJECT_STATUS } from '../lib/labels';
import type { Client, Doc, DocKind, Project, Settings } from '../lib/types';
import DocumentsTable from '../components/DocumentsTable';
import ModuleMatrix, { matrixDocIds } from '../components/ModuleMatrix';
import DocPanel, { docTotal } from '../components/DocPanel';
import PreviewBanner, { clientVisible } from '../components/PreviewBanner';
import Roadmap from '../components/Roadmap';
import { ErrorBox } from '../components/ui';

const KINDS: DocKind[] = ['devis', 'facture', 'contrat', 'autre'];

/** Ce que le client doit faire, document par document. */
const needsAction = (d: Doc) => (d.kind === 'devis' && d.status === 'a_signer' && !d.signed_file_path) || (d.kind === 'facture' && d.status === 'a_regler');

export default function ClientProject({ preview = false }: { preview?: boolean }) {
  const { projectId } = useParams();
  const [tab, setTab] = useState<'documents' | 'projet' | 'roadmap'>('documents');
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
  const openDoc = docs.find((d) => d.id === openId) ?? null;

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
    if (!window.confirm(`Confirmez-vous avoir réglé la facture ${d.number} (${euros(docTotal(d))}) ?`)) return;
    run(async () => {
      const { error: err } = await supabase.rpc('client_declare_payment', { p_document_id: d.id });
      if (err) throw new Error(err.message);
      await reload();
    }, `Merci, votre règlement de la facture ${d.number} a été signalé. Nous le vérifions.`);
  };

  // Avec des modules, le tableau par module remplace les listes ; seuls les documents hors tableau restent listés.
  const useMatrix = project.modules.length > 0;
  const inMatrix = useMatrix ? matrixDocIds(project.modules, docs) : new Set<string>();
  const todo = docs.filter(needsAction).sort((a, b) => (a.due_date ?? a.issue_date).localeCompare(b.due_date ?? b.issue_date));
  const invoices = docs.filter((d) => d.kind === 'facture');
  const paid = invoices.filter((d) => d.status === 'acquittee').reduce((s, d) => s + docTotal(d), 0);
  const due = invoices.filter((d) => ['a_regler', 'reglement_declare'].includes(d.status)).reduce((s, d) => s + docTotal(d), 0);
  const monthly = project.modules.reduce((s, m) => s + (Number(m.monthly_fee) || 0), 0);

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

      <ErrorBox error={actionError || error} />
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => onFileChosen(e.target.files?.[0])} />

      <section className={`card todo${todo.length ? '' : ' todo-done'}`}>
        {todo.length === 0 ? (
          <p style={{ margin: 0 }}><strong>Tout est à jour.</strong> <span className="muted">Vous n'avez rien à faire pour le moment.</span></p>
        ) : (
          <>
            <h2 className="todo-title">À faire <span className="badge badge-warn">{todo.length}</span></h2>
            <ul className="todo-list">
              {todo.map((d) => (
                <li key={d.id}>
                  <div>
                    <strong>{d.kind === 'devis' ? 'Signer le devis' : 'Régler la facture'} {d.number}</strong>
                    <span className="small muted">
                      {d.module || d.title} · {euros(docTotal(d))}{d.kind === 'facture' && d.due_date ? ` · avant le ${frDate(d.due_date)}` : ''}
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setOpenId(d.id)}>{d.kind === 'devis' ? 'Signer' : 'Régler'}</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {(paid > 0 || due > 0 || monthly > 0) && (
        <div className="kpis">
          <div className="kpi"><span>Déjà réglé</span><strong>{euros(paid)}</strong></div>
          <div className="kpi"><span>Reste à régler</span><strong className={due > 0 ? 'warn' : ''}>{euros(due)}</strong></div>
          {monthly > 0 && <div className="kpi"><span>Abonnement</span><strong>{euros(monthly)} / mois</strong></div>}
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'documents'} className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Mes documents</button>
        <button role="tab" aria-selected={tab === 'projet'} className={tab === 'projet' ? 'active' : ''} onClick={() => setTab('projet')}>Mon application</button>
        {project.roadmap_visible && <button role="tab" aria-selected={tab === 'roadmap'} className={tab === 'roadmap' ? 'active' : ''} onClick={() => setTab('roadmap')}>Planning</button>}
      </div>

      {tab === 'documents' && (
        <div className="stack">
          {useMatrix && (
            <section className="card">
              <p className="small muted" style={{ marginTop: 0 }}>Cliquez sur une référence pour voir le document, le télécharger ou faire l'action demandée.</p>
              <ModuleMatrix modules={project.modules} docs={docs} onOpen={(d) => setOpenId(d.id)} highlight={needsAction} />
            </section>
          )}
          {KINDS.map((k) => {
            const list = docs.filter((d) => d.kind === k && !inMatrix.has(d.id));
            if (!list.length) return null;
            return (
              <section key={k} className="card">
                <div className="card-head"><h2>{KIND_PLURAL[k]}</h2></div>
                <DocumentsTable docs={list} onRowClick={(d) => setOpenId(d.id)} />
              </section>
            );
          })}
          {docs.length === 0 && <div className="card"><p className="empty">Aucun document pour le moment.</p></div>}
        </div>
      )}

      {tab === 'projet' && (
        <div className="stack">
          {project.summary && <div className="card"><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{project.summary}</p></div>}
          <div className="grid grid-2">
            {project.modules.map((m, i) => (
              <div key={i} className="card">
                <div className="card-head" style={{ marginBottom: 8 }}>
                  <h3>{m.name}</h3>
                  {Number(m.monthly_fee) > 0 && <span className="badge">{euros(Number(m.monthly_fee))} / mois</span>}
                </div>
                <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{m.description.trim()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'roadmap' && project.roadmap_visible && (
        <div className="card"><Roadmap phases={project.roadmap?.phases ?? []} /></div>
      )}

      {openDoc && (
        <DocPanel
          doc={openDoc}
          project={project}
          settings={settings}
          busy={busy}
          error={actionError}
          readOnly={preview}
          onClose={() => setOpenId(null)}
          onDownload={() => run(() => downloadDocument(openDoc, client))}
          onOpenSigned={() => run(() => openStoredFile(openDoc.signed_file_path!))}
          onUploadSigned={() => fileInput.current?.click()}
          onDeclarePayment={() => declarePayment(openDoc)}
        />
      )}
    </>
  );
}
