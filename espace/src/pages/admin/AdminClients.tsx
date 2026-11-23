import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { must, useAsync } from '../../lib/useAsync';
import type { Client } from '../../lib/types';
import { Empty, ErrorBox } from '../../components/ui';

type ClientRow = Client & { projects: { id: string }[]; profiles: { id: string }[] };

export default function AdminClients() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { data, error, loading } = useAsync(async () => must(await supabase.from('clients').select('*, projects(id), profiles(id)').order('name')) as ClientRow[], []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { data: c, error: e2 } = await supabase.from('clients').insert({ name: name.trim() }).select().single();
    if (e2) return setErr(e2.message);
    navigate(`/clients/${c.id}`);
  };

  return (
    <>
      <div className="page-head"><h1>Clients</h1></div>
      <ErrorBox error={error || err} />
      <form className="card row" onSubmit={create} style={{ marginBottom: 16 }}>
        <input placeholder="Nom de la société cliente" value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-primary">Ajouter un client</button>
      </form>
      <section className="card">
        {loading ? <p className="muted">Chargement…</p> : !data?.length ? <Empty>Aucun client.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Contact</th><th className="num">Projets</th><th className="num">Accès</th></tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/clients/${c.id}`)}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.contact_name}<div className="small muted">{c.contact_email}</div></td>
                    <td className="num">{c.projects.length}</td>
                    <td className="num">{c.profiles.length}</td>
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
