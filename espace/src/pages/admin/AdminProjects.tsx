import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { must, useAsync } from '../../lib/useAsync';
import { PROJECT_STATUS } from '../../lib/labels';
import type { Doc, Project } from '../../lib/types';
import { Empty, ErrorBox } from '../../components/ui';

type ProjectRow = Project & { clients: { name: string } | null };

/** Ce que l'administrateur doit traiter sur un document (signature reçue, paiement déclaré…). */
export function adminTodo(d: Pick<Doc, 'kind' | 'status' | 'signed_file_path'>): boolean {
  return d.status === 'reglement_declare' || (d.kind === 'devis' && d.status === 'a_signer' && !!d.signed_file_path);
}

/** Page d'accueil de l'administrateur : la liste des projets. */
export default function AdminProjects() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { data, error, loading } = useAsync(async () => {
    const [projects, docs] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').order('created_at'),
      supabase.from('documents').select('project_id, kind, status, signed_file_path'),
    ]);
    return { projects: must(projects) as ProjectRow[], docs: must(docs) as (Pick<Doc, 'kind' | 'status' | 'signed_file_path'> & { project_id: string })[] };
  }, []);

  const createClient = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { data: c, error: e2 } = await supabase.from('clients').insert({ name: name.trim() }).select().single();
    if (e2) return setErr(e2.message);
    navigate(`/clients/${c.id}`);
  };

  if (loading) return <p className="muted">Chargement…</p>;
  const projects = (data?.projects ?? []).filter((p) => p.status !== 'archive');
  const archived = (data?.projects ?? []).filter((p) => p.status === 'archive');
  const todo = (id: string) => (data?.docs ?? []).filter((d) => d.project_id === id && adminTodo(d)).length;

  const tile = (p: ProjectRow) => {
    const n = todo(p.id);
    return (
      <Link key={p.id} to={`/projets/${p.id}`} className="card tile project-tile">
        <span className="small muted">{p.clients?.name}</span>
        <h3>{p.name}</h3>
        <div className="row">
          <span className="badge badge-ok">{PROJECT_STATUS[p.status]}</span>
          {n > 0 && <span className="badge badge-warn">{n} à traiter</span>}
        </div>
      </Link>
    );
  };

  return (
    <>
      <div className="page-head"><h1>Projets</h1></div>
      <ErrorBox error={error || err} />
      {projects.length ? <div className="grid grid-2">{projects.map(tile)}</div> : <Empty>Aucun projet.</Empty>}
      {archived.length > 0 && (
        <details className="fold">
          <summary>Projets archivés ({archived.length})</summary>
          <div className="grid grid-2">{archived.map(tile)}</div>
        </details>
      )}
      <details className="fold">
        <summary>Nouveau client</summary>
        <form className="row" onSubmit={createClient}>
          <input placeholder="Nom de la société cliente" value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 1, minWidth: 200 }} />
          <button className="btn btn-primary">Créer le client</button>
        </form>
        <p className="small muted">Vous pourrez ensuite créer son projet et ses accès depuis sa fiche.</p>
      </details>
    </>
  );
}
