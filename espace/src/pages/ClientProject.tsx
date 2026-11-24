import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { must, useAsync } from '../lib/useAsync';
import { downloadDocument } from '../lib/docActions';
import { openStoredFile, uploadDocFile } from '../lib/files';
import { KIND_PLURAL, PROJECT_STATUS } from '../lib/labels';
import type { Client, Doc, DocKind, Project } from '../lib/types';
import DocumentsTable from '../components/DocumentsTable';
import Roadmap from '../components/Roadmap';
import { ErrorBox } from '../components/ui';

const KINDS: DocKind[] = ['devis', 'facture', 'contrat', 'autre'];

export default function ClientProject() {
  const { projectId } = useParams();
  const [tab, setTab] = useState<'documents' | 'projet' | 'roadmap'>('documents');
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<Doc | null>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const [project, client, docs] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId!).maybeSingle(),
      supabase.from('clients').select('*').maybeSingle(),
      supabase.from('documents').select('*').eq('project_id', projectId!).order('issue_date', { ascending: false }),
    ]);
    return { project: must(project) as Project | null, client: must(client) as Client, docs: must(docs) as Doc[] };
  }, [projectId]);

  const run = async (doc: Doc, fn: () => Promise<void>, success?: string) => {
    setActionError(null);
    setNotice(null);
    setBusyId(doc.id);
    try {
      await fn();
      if (success) setNotice(success);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const onFileChosen = async (file: File | undefined) => {
    const doc = uploadTarget.current;
    if (!file || !doc) return;
    if (file.size > 10 * 1024 * 1024) return setActionError('Fichier trop lourd (10 Mo maximum).');
    await run(doc, async () => {
      const path = await uploadDocFile(doc, file, 'signe-');
      const { error: err } = await supabase.rpc('client_attach_signed_devis', { p_document_id: doc.id, p_path: path });
      if (err) throw new Error(err.message);
      await reload();
    }, 'Merci, votre devis signé a bien été transmis.');
    if (fileInput.current) fileInput.current.value = '';
  };

  if (loading) return <p className="muted">Chargement…</p>;
  if (!data?.project) return <><ErrorBox error={error} /><p>Projet introuvable. <Link to="/">Retour</Link></p></>;
  const { project, client, docs } = data;

  const actions = (d: Doc) => (
    <>
      <button className="btn btn-sm" disabled={busyId === d.id} onClick={() => run(d, () => downloadDocument(d, client))}>PDF</button>
      {d.kind === 'devis' && d.status === 'a_signer' && !d.signed_file_path && (
        <button className="btn btn-sm btn-primary" disabled={busyId === d.id} onClick={() => { uploadTarget.current = d; fileInput.current?.click(); }}>Déposer le devis signé</button>
      )}
      {d.signed_file_path && (
        <button className="btn btn-sm" onClick={() => run(d, () => openStoredFile(d.signed_file_path!))}>Devis signé</button>
      )}
      {d.kind === 'facture' && d.status === 'a_regler' && (
        <button
          className="btn btn-sm btn-primary"
          disabled={busyId === d.id}
          onClick={() => {
            if (!window.confirm(`Confirmez-vous avoir réglé la facture ${d.number} ?`)) return;
            run(d, async () => {
              const { error: err } = await supabase.rpc('client_declare_payment', { p_document_id: d.id });
              if (err) throw new Error(err.message);
              await reload();
            }, 'Merci, votre règlement a été signalé. La facture acquittée sera disponible après vérification.');
          }}
        >
          Règlement effectué
        </button>
      )}
    </>
  );

  const pending = docs.filter((d) => ['a_signer', 'a_regler'].includes(d.status) && !d.signed_file_path);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumbs"><Link to="/">Mes projets</Link> / {client.name}</p>
          <h1>{project.name}</h1>
        </div>
        <span className="badge badge-ok">{PROJECT_STATUS[project.status]}</span>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'documents'} className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>
        <button role="tab" aria-selected={tab === 'projet'} className={tab === 'projet' ? 'active' : ''} onClick={() => setTab('projet')}>Le projet</button>
        {project.roadmap_visible && <button role="tab" aria-selected={tab === 'roadmap'} className={tab === 'roadmap' ? 'active' : ''} onClick={() => setTab('roadmap')}>Feuille de route</button>}
      </div>

      <ErrorBox error={actionError || error} />
      {notice && <div className="alert alert-ok">{notice}</div>}
      <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => onFileChosen(e.target.files?.[0])} />

      {tab === 'documents' && (
        <div className="stack">
          {pending.length > 0 && (
            <div className="alert alert-info">
              {pending.length === 1 ? 'Un document attend' : `${pending.length} documents attendent`} une action de votre part : {pending.map((d) => d.number).join(', ')}.
            </div>
          )}
          {KINDS.map((k) => {
            const list = docs.filter((d) => d.kind === k);
            if (!list.length) return null;
            return (
              <section key={k} className="card">
                <div className="card-head"><h2>{KIND_PLURAL[k]}</h2></div>
                <DocumentsTable docs={list} actions={actions} />
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
                <h3>{m.name}</h3>
                <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{m.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'roadmap' && project.roadmap_visible && (
        <div className="card"><Roadmap phases={project.roadmap?.phases ?? []} /></div>
      )}
    </>
  );
}
