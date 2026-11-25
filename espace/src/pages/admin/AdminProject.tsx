import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { must, useAsync } from '../../lib/useAsync';
import { euros } from '../../lib/money';
import { KIND_LABEL, PROJECT_STATUS } from '../../lib/labels';
import type { Client, Doc, DocKind, Project } from '../../lib/types';
import ModuleMatrix, { matrixDocIds } from '../../components/ModuleMatrix';
import { docTotal } from '../../components/DocPanel';
import { ErrorBox, Field, StatusBadge } from '../../components/ui';
import { adminTodo } from './AdminProjects';
import ProjectBar from '../../components/ProjectBar';

function Chip({ doc, sub, onOpen }: { doc: Doc; sub?: string; onOpen: (d: Doc) => void }) {
  return (
    <button type="button" className={`doc-chip${adminTodo(doc) ? ' doc-chip-todo' : ''}`} onClick={() => onOpen(doc)}>
      <span className="doc-chip-ref">{doc.number || 'Sans numéro'}</span>
      {sub && <span className="small muted">{sub}</span>}
      <StatusBadge kind={doc.kind} status={doc.status} />
    </button>
  );
}

export default function AdminProject() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [form, setForm] = useState<Project | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, error, loading } = useAsync(async () => {
    const project = must(await supabase.from('projects').select('*').eq('id', projectId!).single()) as Project;
    const [client, docs] = await Promise.all([
      supabase.from('clients').select('*').eq('id', project.client_id).single(),
      supabase.from('documents').select('*').eq('project_id', projectId!).order('issue_date', { ascending: false }),
    ]);
    return { project, client: must(client) as Client, docs: must(docs) as Doc[] };
  }, [projectId]);

  useEffect(() => {
    if (data) setForm({ ...data.project });
  }, [data]);

  useEffect(() => {
    if (form && hash === '#reglages') document.getElementById('reglages')?.scrollIntoView({ block: 'start' });
  }, [form, hash]);

  if (loading || !form || !data) return <><ErrorBox error={error} /><p className="muted">Chargement…</p></>;
  const has = (col: string) => col in data.project;

  const save = async () => {
    setErr(null);
    setMsg(null);
    const { name, status, modules, architecture, app_url } = form;
    // Les colonnes « architecture » et « app_url » ne sont envoyées que si elles existent déjà en base.
    const patch = { name, status, modules, ...(has('architecture') ? { architecture } : {}), ...(has('app_url') ? { app_url } : {}) };
    const { error: e } = await supabase.from('projects').update(patch).eq('id', form.id);
    if (e) setErr(e.message);
    else setMsg('Projet enregistré.');
  };

  const newDocument = async (kind: DocKind) => {
    setErr(null);
    const { data: number, error: e1 } = await supabase.rpc('next_document_number', { p_kind: kind });
    if (e1) return setErr(e1.message);
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const { data: doc, error: e2 } = await supabase
      .from('documents')
      .insert({
        project_id: form.id,
        kind,
        number,
        title: kind === 'contrat' ? 'Contrat de maintenance' : '',
        due_date: kind === 'devis' || kind === 'facture' ? due.toISOString().slice(0, 10) : null,
      })
      .select()
      .single();
    if (e2) return setErr(e2.message);
    navigate(`/documents/${doc.id}`);
  };

  const deleteProject = async () => {
    if (!window.confirm(`Supprimer le projet ${form.name} et tous ses documents ? Cette action est définitive.`)) return;
    const { error: e } = await supabase.from('projects').delete().eq('id', form.id);
    if (e) return setErr(e.message);
    navigate('/');
  };

  const setModule = (i: number, patch: Partial<Project['modules'][number]>) =>
    setForm({ ...form, modules: form.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  const docs = data.docs;
  const open = (d: Doc) => navigate(`/documents/${d.id}`);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const contracts = docs.filter((d) => d.kind === 'contrat');
  const contractInvoices = docs.filter((d) => d.kind === 'facture' && d.related_document_id && byId.get(d.related_document_id)?.kind === 'contrat');
  const placed = new Set([...matrixDocIds(data.project.modules, docs), ...contracts.map((d) => d.id), ...contractInvoices.map((d) => d.id)]);
  const others = docs.filter((d) => !placed.has(d.id));

  return (
    <>
      <ProjectBar project={data.project} client={data.client} />
      <div className="page-head">
        <div>
          <p className="crumbs"><Link to="/">Projets</Link> / {data.client.name}</p>
          <h1>{data.project.name}</h1>
        </div>
      </div>
      <ErrorBox error={err} />
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Modules</h2>
            <div className="row">
              <button className="btn btn-sm" onClick={() => newDocument('devis')}>+ Devis</button>
              <button className="btn btn-sm" onClick={() => newDocument('facture')}>+ Facture</button>
            </div>
          </div>
          {data.project.modules.length ? <ModuleMatrix modules={data.project.modules} docs={docs} onOpen={open} highlight={adminTodo} /> : <p className="empty">Aucun module.</p>}
          <details className="fold">
            <summary>Modifier les modules</summary>
            {form.modules.map((m, i) => (
              <div key={i} className="form-grid" style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <Field label="Nom"><input value={m.name} onChange={(e) => setModule(i, { name: e.target.value })} /></Field>
                <div className="row" style={{ alignItems: 'flex-end' }}><button className="btn btn-sm btn-danger" onClick={() => setForm({ ...form, modules: form.modules.filter((_, j) => j !== i) })}>Retirer</button></div>
                <Field label="Description" full><textarea value={m.description} onChange={(e) => setModule(i, { description: e.target.value })} rows={2} /></Field>
              </div>
            ))}
            <div className="row">
              <button className="btn btn-sm" onClick={() => setForm({ ...form, modules: [...form.modules, { name: '', description: '' }] })}>+ Module</button>
              <button className="btn btn-sm btn-primary" onClick={save}>Enregistrer les modules</button>
            </div>
          </details>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Contrat</h2>
            {contracts.length === 0 && <button className="btn btn-sm" onClick={() => newDocument('contrat')}>+ Contrat</button>}
          </div>
          {contracts.length === 0 ? (
            <p className="empty">Pas encore de contrat de maintenance.</p>
          ) : (
            <div className="contract-grid">
              <div>
                <p className="panel-box-label">Contrat</p>
                <div className="row">{contracts.map((d) => <Chip key={d.id} doc={d} onOpen={open} sub={d.title} />)}</div>
              </div>
              <div>
                <p className="panel-box-label">Factures du contrat</p>
                {contractInvoices.length ? (
                  <div className="row">{contractInvoices.map((d) => <Chip key={d.id} doc={d} onOpen={open} sub={euros(docTotal(d))} />)}</div>
                ) : (
                  <span className="doc-chip doc-chip-empty">Aucune : ouvrez le contrat puis « Créer la facture de ce contrat »</span>
                )}
              </div>
            </div>
          )}
          <p className="small muted" style={{ margin: '12px 0 0' }}>Cliquez sur un document pour le modifier. Les mensualités se créent toutes seules le 1er du mois.</p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Architecture</h2>
            {has('architecture') && <button className="btn btn-sm btn-primary" onClick={save}>Enregistrer</button>}
          </div>
          {has('architecture') ? (
            <textarea rows={6} value={form.architecture ?? ''} onChange={(e) => setForm({ ...form, architecture: e.target.value })} placeholder="Laissez vide : le client verra « À venir »." style={{ width: '100%' }} />
          ) : (
            <p className="small muted" style={{ margin: 0 }}>À venir. Le champ sera disponible une fois la base mise à jour.</p>
          )}
        </section>

        {others.length > 0 && (
          <details className="fold">
            <summary>Autres documents ({others.length}) : masqués, brouillons ou hors tableau</summary>
            <div className="row">{others.map((d) => <Chip key={d.id} doc={d} onOpen={open} sub={`${KIND_LABEL[d.kind]}${d.title ? ` · ${d.title}` : ''}${d.visible ? '' : ' · masqué'}`} />)}</div>
          </details>
        )}

        <details className="fold" id="reglages" open={hash === '#reglages' || undefined}>
          <summary>Réglages du projet</summary>
          <div className="form-grid">
            <Field label="Nom du projet"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Statut">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}>
                {Object.entries(PROJECT_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            {has('app_url') ? (
              <Field label="Adresse de l'application (bouton « Application »)" full><input type="url" value={form.app_url ?? ''} onChange={(e) => setForm({ ...form, app_url: e.target.value })} placeholder="https://…" /></Field>
            ) : (
              <p className="small muted full">L'adresse de l'application pourra être saisie une fois la base mise à jour.</p>
            )}
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={save}>Enregistrer</button>
            <span className="spacer" />
            <button className="btn btn-danger btn-sm" onClick={deleteProject}>Supprimer le projet</button>
          </div>
        </details>
      </div>
    </>
  );
}
