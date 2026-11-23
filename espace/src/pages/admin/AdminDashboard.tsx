import { Link, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { must, useAsync } from '../../lib/useAsync';
import { KIND_LABEL } from '../../lib/labels';
import { frDate } from '../../lib/money';
import type { Doc } from '../../lib/types';
import { docAmount } from '../../components/DocumentsTable';
import { Empty, ErrorBox, StatusBadge } from '../../components/ui';

type DocRow = Doc & { projects: { name: string; clients: { name: string } | null } | null };

function todo(d: DocRow, today: string): string | null {
  if (d.status === 'reglement_declare') return 'Règlement déclaré par le client : vérifier puis acquitter';
  if (d.kind === 'devis' && d.status === 'a_signer' && d.signed_file_path) return 'Devis signé reçu : vérifier puis valider';
  if (d.kind === 'facture' && d.status === 'a_regler' && d.due_date && d.due_date < today) return 'Échéance dépassée';
  if (d.status === 'brouillon') return 'Brouillon non envoyé';
  return null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data, error, loading } = useAsync(async () => {
    const [clients, projects, docs] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }).neq('status', 'archive'),
      supabase.from('documents').select('*, projects(name, clients(name))').order('updated_at', { ascending: false }),
    ]);
    if (clients.error) throw new Error(clients.error.message);
    return { clients: clients.count ?? 0, projects: projects.count ?? 0, docs: must(docs) as DocRow[] };
  }, []);

  if (loading) return <p className="muted">Chargement…</p>;
  const today = new Date().toISOString().slice(0, 10);
  const docs = data?.docs ?? [];
  const items = docs.map((d) => ({ d, why: todo(d, today) })).filter((x) => x.why);
  const toSign = docs.filter((d) => d.kind === 'devis' && d.status === 'a_signer').length;
  const toPay = docs.filter((d) => d.kind === 'facture' && ['a_regler', 'reglement_declare'].includes(d.status)).length;

  return (
    <>
      <div className="page-head"><h1>Tableau de bord</h1><Link to="/clients" className="btn btn-primary">Gérer les clients</Link></div>
      <ErrorBox error={error} />
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card"><div className="muted small">Clients</div><div className="stat">{data?.clients}</div></div>
        <div className="card"><div className="muted small">Projets actifs</div><div className="stat">{data?.projects}</div></div>
        <div className="card"><div className="muted small">Devis à signer</div><div className="stat">{toSign}</div></div>
        <div className="card"><div className="muted small">Factures non réglées</div><div className="stat">{toPay}</div></div>
      </div>
      <section className="card">
        <div className="card-head"><h2>À traiter</h2></div>
        {items.length === 0 ? <Empty>Rien à traiter pour le moment.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Document</th><th>Client · projet</th><th>Date</th><th className="num">Montant</th><th>Statut</th><th>À faire</th></tr></thead>
              <tbody>
                {items.map(({ d, why }) => (
                  <tr key={d.id} className="clickable" onClick={() => navigate(`/documents/${d.id}`)}>
                    <td><strong>{KIND_LABEL[d.kind]} {d.number}</strong><div className="small muted">{d.title}</div></td>
                    <td>{d.projects?.clients?.name}<div className="small muted">{d.projects?.name}</div></td>
                    <td>{frDate(d.issue_date)}</td>
                    <td className="num">{docAmount(d)}</td>
                    <td><StatusBadge kind={d.kind} status={d.status} /></td>
                    <td className="small">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
