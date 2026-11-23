import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { must, useAsync } from '../lib/useAsync';
import { PROJECT_STATUS } from '../lib/labels';
import type { Client, Doc, Project } from '../lib/types';
import { Empty, ErrorBox } from '../components/ui';

export default function ClientHome() {
  const { data, error, loading } = useAsync(async () => {
    const [client, projects, docs] = await Promise.all([
      supabase.from('clients').select('*').maybeSingle(),
      supabase.from('projects').select('*').neq('status', 'archive').order('created_at'),
      supabase.from('documents').select('id, project_id, status'),
    ]);
    return { client: must(client) as Client | null, projects: must(projects) as Project[], docs: must(docs) as Pick<Doc, 'id' | 'project_id' | 'status'>[] };
  }, []);

  if (loading) return <p className="muted">Chargement…</p>;
  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumbs">{data?.client?.name}</p>
          <h1>Mes projets</h1>
        </div>
      </div>
      <ErrorBox error={error} />
      {data && data.projects.length === 0 && <div className="card"><Empty>Aucun projet pour le moment.</Empty></div>}
      <div className="grid grid-2">
        {data?.projects.map((p) => {
          const pending = data.docs.filter((d) => d.project_id === p.id && ['a_signer', 'a_regler'].includes(d.status)).length;
          return (
            <Link key={p.id} to={`/projets/${p.id}`} className="card tile">
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="badge badge-ok">{PROJECT_STATUS[p.status]}</span>
                {pending > 0 && <span className="badge badge-warn">{pending} action{pending > 1 ? 's' : ''} en attente</span>}
              </div>
              <h2>{p.name}</h2>
              {p.summary && <p className="muted" style={{ margin: 0 }}>{p.summary}</p>}
            </Link>
          );
        })}
      </div>
    </>
  );
}
