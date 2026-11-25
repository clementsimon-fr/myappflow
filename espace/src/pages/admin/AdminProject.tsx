import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { must, useAsync } from '../../lib/useAsync';
import { KIND_LABEL, PHASE_STATUS, PROJECT_STATUS } from '../../lib/labels';
import type { Client, Doc, DocKind, PhaseStatus, Project } from '../../lib/types';
import DocumentsTable from '../../components/DocumentsTable';
import ModuleMatrix from '../../components/ModuleMatrix';
import { ErrorBox, Field } from '../../components/ui';

const NEW_KINDS: DocKind[] = ['devis', 'facture', 'contrat', 'autre'];

export default function AdminProject() {
  const { projectId } = useParams();
  const navigate = useNavigate();
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
    if (data) setForm({ ...data.project, roadmap: { phases: data.project.roadmap?.phases ?? [] } });
  }, [data]);

  if (loading || !form || !data) return <><ErrorBox error={error} /><p className="muted">Chargement…</p></>;

  const save = async () => {
    setErr(null);
    setMsg(null);
    const { name, summary, status, modules, roadmap, roadmap_visible, architecture } = form;
    // La colonne « architecture » n'est envoyée que si elle existe déjà en base (migration 20261124000000).
    const patch = { name, summary, status, modules, roadmap, roadmap_visible, ...('architecture' in data.project ? { architecture } : {}) };
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
    navigate(`/clients/${form.client_id}`);
  };

  const phases = form.roadmap.phases;
  const setPhase = (i: number, patch: Partial<(typeof phases)[number]>) =>
    setForm({ ...form, roadmap: { phases: phases.map((p, j) => (j === i ? { ...p, ...patch } : p)) } });
  const setModule = (i: number, patch: Partial<Project['modules'][number]>) =>
    setForm({ ...form, modules: form.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumbs"><Link to="/clients">Clients</Link> / <Link to={`/clients/${data.client.id}`}>{data.client.name}</Link></p>
          <h1>{data.project.name}</h1>
        </div>
        <div className="row">
          <Link to={`/apercu/projets/${data.project.id}`} className="btn">Vue client</Link>
          <button className="btn btn-primary" onClick={save}>Enregistrer le projet</button>
        </div>
      </div>
      <ErrorBox error={err} />
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>Documents</h2>
            <div className="row">
              {NEW_KINDS.map((k) => <button key={k} className="btn btn-sm" onClick={() => newDocument(k)}>+ {KIND_LABEL[k]}</button>)}
            </div>
          </div>
          {data.project.modules.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <ModuleMatrix modules={data.project.modules} docs={data.docs} onOpen={(d) => navigate(`/documents/${d.id}`)} />
            </div>
          )}
          <DocumentsTable docs={data.docs} showKind onRowClick={(d) => navigate(`/documents/${d.id}`)} empty="Aucun document. Créez un devis pour commencer." />
          <p className="small muted" style={{ marginTop: 10 }}>Le client ne voit que les documents marqués « visible » et qui ne sont plus en brouillon.</p>
        </section>

        <section className="card">
          <div className="card-head"><h2>Présentation</h2></div>
          <div className="form-grid">
            <Field label="Nom du projet"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Statut">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}>
                {Object.entries(PROJECT_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Résumé affiché au client" full><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Modules</h2>
            <button className="btn btn-sm" onClick={() => setForm({ ...form, modules: [...form.modules, { name: '', description: '' }] })}>+ Module</button>
          </div>
          {form.modules.map((m, i) => (
            <div key={i} className="form-grid" style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <Field label="Nom"><input value={m.name} onChange={(e) => setModule(i, { name: e.target.value })} /></Field>
              <div className="row" style={{ alignItems: 'flex-end' }}><button className="btn btn-sm btn-danger" onClick={() => setForm({ ...form, modules: form.modules.filter((_, j) => j !== i) })}>Retirer</button></div>
              <Field label="Description" full><textarea value={m.description} onChange={(e) => setModule(i, { description: e.target.value })} rows={2} /></Field>
            </div>
          ))}
          {!form.modules.length && <p className="muted small">Aucun module.</p>}
        </section>

        <section className="card">
          <div className="card-head"><h2>Architecture</h2></div>
{'architecture' in data.project ? (
          <Field label="Texte du bloc « Architecture » affiché au client (hébergement, accès, sauvegardes…)" full>
            <textarea rows={8} value={form.architecture ?? ''} onChange={(e) => setForm({ ...form, architecture: e.target.value })} placeholder="Laissez vide : le client verra « Informations bientôt disponibles »." />
          </Field>
          ) : <p className="small muted">Ce champ sera disponible une fois la base mise à jour (colonne « architecture »).</p>}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Feuille de route</h2>
            <div className="row">
              <label className="check"><input type="checkbox" checked={form.roadmap_visible} onChange={(e) => setForm({ ...form, roadmap_visible: e.target.checked })} /> Visible par le client</label>
              <button className="btn btn-sm" onClick={() => setForm({ ...form, roadmap: { phases: [...phases, { title: '', objective: '', start: '', end: '', status: 'a_venir' }] } })}>+ Phase</button>
            </div>
          </div>
          {phases.map((ph, i) => (
            <div key={i} className="form-grid" style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <Field label="Titre"><input value={ph.title} onChange={(e) => setPhase(i, { title: e.target.value })} /></Field>
              <Field label="Statut">
                <select value={ph.status} onChange={(e) => setPhase(i, { status: e.target.value as PhaseStatus })}>
                  {Object.entries(PHASE_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Début"><input type="date" value={ph.start} onChange={(e) => setPhase(i, { start: e.target.value })} /></Field>
              <Field label="Fin"><input type="date" value={ph.end} onChange={(e) => setPhase(i, { end: e.target.value })} /></Field>
              <Field label="Objectif" full><textarea value={ph.objective} onChange={(e) => setPhase(i, { objective: e.target.value })} rows={2} /></Field>
              <div className="full"><button className="btn btn-sm btn-danger" onClick={() => setForm({ ...form, roadmap: { phases: phases.filter((_, j) => j !== i) } })}>Retirer la phase</button></div>
            </div>
          ))}
          {!phases.length && <p className="muted small">Aucune phase.</p>}
        </section>

        <div className="row">
          <button className="btn btn-primary" onClick={save}>Enregistrer le projet</button>
          <span className="spacer" />
          <button className="btn btn-danger btn-sm" onClick={deleteProject}>Supprimer le projet</button>
        </div>
      </div>
    </>
  );
}
