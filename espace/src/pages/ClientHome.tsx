import { Link, Navigate, useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { must, useAsync } from '../lib/useAsync';
import { PROJECT_STATUS } from '../lib/labels';
import type { Client, Doc, Project } from '../lib/types';
import { Empty, ErrorBox } from '../components/ui';
import PreviewBanner, { clientVisible } from '../components/PreviewBanner';

export default function ClientHome({ preview = false }: { preview?: boolean }) {
  const { clientId } = useParams();
  const { data, error, loading } = useAsync(async () => {
    // Côté client, la base ne renvoie que sa société ; en vue client, l'administrateur filtre sur le client choisi.
    let clientQ = supabase.from('clients').select('*');
    let projectsQ = supabase.from('projects').select('*').neq('status', 'archive').order('created_at');
    if (preview) {
      clientQ = clientQ.eq('id', clientId!);
      projectsQ = projectsQ.eq('client_id', clientId!);
    }
    const [client, projects] = await Promise.all([clientQ.maybeSingle(), projectsQ]);
    const projectList = must(projects) as Project[];
    let docs = must(await supabase.from('documents').select('id, project_id, status, visible').in('project_id', projectList.map((p) => p.id))) as Pick<Doc, 'id' | 'project_id' | 'status' | 'visible'>[];
    if (preview) docs = clientVisible(docs);
    return { client: must(client) as Client | null, projects: projectList, docs };
  }, [preview, clientId]);

  if (loading) return <p className="muted">Chargement…</p>;
  // Un seul projet : on y va directement, sans page intermédiaire.
  if (data && data.projects.length === 1) return <Navigate to={preview ? `/apercu/projets/${data.projects[0].id}` : `/projets/${data.projects[0].id}`} replace />;
  return (
    <>
      {preview && <PreviewBanner clientName={data?.client?.name ?? ''} backTo={`/clients/${clientId}`} />}
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
            <Link key={p.id} to={preview ? `/apercu/projets/${p.id}` : `/projets/${p.id}`} className="card tile">
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
