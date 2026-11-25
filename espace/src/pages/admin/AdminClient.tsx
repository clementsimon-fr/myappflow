import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { must, useAsync } from '../../lib/useAsync';
import { adminUsers } from '../../lib/adminApi';
import { generatePassword, isValidUsername, normalizeUsername } from '../../lib/username';
import { PROJECT_STATUS } from '../../lib/labels';
import { frDate } from '../../lib/money';
import type { Client, Profile, Project } from '../../lib/types';
import { Empty, ErrorBox, Field } from '../../components/ui';
import ProjectBar from '../../components/ProjectBar';

const PORTAL_URL = 'https://myappflow.vercel.app/espace';

function welcomeMessage(client: Client, username: string, password: string) {
  return `Bonjour,

Votre espace client MyAppFlow est disponible : vous y retrouverez vos devis, factures et contrats.

Adresse : ${PORTAL_URL}
Identifiant : ${username}
Mot de passe provisoire : ${password}

Il vous sera demandé de choisir votre propre mot de passe à la première connexion.

Bien à vous,
Clément Simon`.replace('Bonjour,', `Bonjour${client.contact_name ? ` ${client.contact_name}` : ''},`);
}

export default function AdminClient() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Client | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: '', full_name: '' });
  const [projectName, setProjectName] = useState('');

  const { data, error, loading, reload } = useAsync(async () => {
    const [client, profiles, projects] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId!).single(),
      supabase.from('profiles').select('*').eq('client_id', clientId!).order('created_at'),
      supabase.from('projects').select('*').eq('client_id', clientId!).order('created_at'),
    ]);
    return { client: must(client) as Client, profiles: must(profiles) as Profile[], projects: must(projects) as Project[] };
  }, [clientId]);

  useEffect(() => {
    if (data) setForm(data.client);
  }, [data]);

  // Arrivée depuis la page projet (« Accès client », « Fiche client ») : on descend au bon bloc.
  const { hash } = useLocation();
  useEffect(() => {
    if (form && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [form, hash]);

  const wrap = async (fn: () => Promise<void>, success?: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      if (success) setMsg(success);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const { name, address, siret, contact_name, contact_email, contact_phone } = form;
    wrap(async () => {
      must(await supabase.from('clients').update({ name, address, siret, contact_name, contact_email, contact_phone }).eq('id', form.id).select());
    }, 'Fiche client enregistrée.');
  };

  const createAccess = (e: FormEvent) => {
    e.preventDefault();
    const username = normalizeUsername(newUser.username);
    if (!isValidUsername(username)) return setErr('Identifiant invalide : 3 à 40 caractères, lettres, chiffres, point, tiret.');
    const password = generatePassword();
    wrap(async () => {
      await adminUsers('create', { username, full_name: newUser.full_name, client_id: clientId, password });
      setCredentials(welcomeMessage(data!.client, username, password));
      setNewUser({ username: '', full_name: '' });
      await reload();
    });
  };

  const resetPassword = (p: Profile) => {
    if (!window.confirm(`Générer un nouveau mot de passe provisoire pour ${p.username} ?`)) return;
    const password = generatePassword();
    wrap(async () => {
      await adminUsers('reset_password', { user_id: p.id, password });
      setCredentials(welcomeMessage(data!.client, p.username, password));
      await reload();
    });
  };

  const toggleActive = (p: Profile) =>
    wrap(async () => {
      await adminUsers('set_active', { user_id: p.id, active: !p.active });
      await reload();
    }, p.active ? `Accès ${p.username} désactivé.` : `Accès ${p.username} réactivé.`);

  const removeAccess = (p: Profile) => {
    if (!window.confirm(`Supprimer définitivement l'accès ${p.username} ?`)) return;
    wrap(async () => {
      await adminUsers('delete', { user_id: p.id });
      await reload();
    }, 'Accès supprimé.');
  };

  const createProject = (e: FormEvent) => {
    e.preventDefault();
    wrap(async () => {
      const p = must(await supabase.from('projects').insert({ client_id: clientId, name: projectName.trim() }).select().single()) as Project;
      navigate(`/projets/${p.id}`);
    });
  };

  const deleteClient = () => {
    if (!window.confirm('Supprimer ce client, ses projets et tous ses documents ? Cette action est définitive.')) return;
    wrap(async () => {
      if (data!.profiles.length) throw new Error("Supprimez d'abord les accès de ce client.");
      must(await supabase.from('clients').delete().eq('id', clientId!).select());
      navigate('/');
    });
  };

  if (loading || !form) return <p className="muted">Chargement…</p>;
  const set = (k: keyof Client) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const mainProject = data!.projects.find((p) => p.status !== 'archive') ?? data!.projects[0];
  return (
    <>
      {mainProject && <ProjectBar project={mainProject} client={data!.client} />}
      <div className="page-head">
        <div>
          <p className="crumbs"><Link to="/">Projets</Link></p>
          <h1>{data!.client.name}</h1>
        </div>
        <Link to={`/apercu/clients/${data!.client.id}`} className="btn">Vue client</Link>
      </div>
      <ErrorBox error={error || err} />
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>Projets</h2></div>
          {data!.projects.length === 0 ? <Empty>Aucun projet.</Empty> : (
            <div className="grid grid-2" style={{ marginBottom: 14 }}>
              {data!.projects.map((p) => (
                <Link key={p.id} to={`/projets/${p.id}`} className="card tile">
                  <span className="badge badge-ok">{PROJECT_STATUS[p.status]}</span>
                  <h3 style={{ margin: '8px 0 0' }}>{p.name}</h3>
                </Link>
              ))}
            </div>
          )}
          <form className="row" onSubmit={createProject}>
            <input placeholder="Nom du nouveau projet (ex. MyTelencia)" value={projectName} onChange={(e) => setProjectName(e.target.value)} required style={{ flex: 1, minWidth: 200 }} />
            <button className="btn btn-primary">Créer le projet</button>
          </form>
        </section>

        <section className="card" id="acces">
          <div className="card-head"><h2>Accès à l'espace client</h2></div>
          {credentials && (
            <div className="alert alert-info">
              <p><strong>Identifiants à transmettre au client.</strong> Le mot de passe ne sera plus affiché ensuite.</p>
              <textarea readOnly value={credentials} rows={11} onFocus={(e) => e.target.select()} />
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(credentials)}>Copier le message</button>
                <button type="button" className="btn btn-sm" onClick={() => setCredentials(null)}>Masquer</button>
              </div>
            </div>
          )}
          {data!.profiles.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table>
                <thead><tr><th>Identifiant</th><th>Nom</th><th>Dernière connexion</th><th>État</th><th className="num">Actions</th></tr></thead>
                <tbody>
                  {data!.profiles.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.username}</strong></td>
                      <td>{p.full_name}</td>
                      <td>{p.last_login_at ? frDate(p.last_login_at) : <span className="muted">Jamais</span>}</td>
                      <td>{!p.active ? <span className="badge">Désactivé</span> : p.must_change_password ? <span className="badge badge-warn">Mot de passe provisoire</span> : <span className="badge badge-ok">Actif</span>}</td>
                      <td className="num">
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm" onClick={() => resetPassword(p)}>Nouveau mot de passe</button>
                          <button className="btn btn-sm" onClick={() => toggleActive(p)}>{p.active ? 'Désactiver' : 'Réactiver'}</button>
                          <button className="btn btn-sm btn-danger" onClick={() => removeAccess(p)}>Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form className="form-grid" onSubmit={createAccess}>
            <Field label="Identifiant"><input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="ex. telencia" required /></Field>
            <Field label="Nom de la personne (facultatif)"><input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} /></Field>
            <div className="full"><button className="btn btn-primary">Créer l'accès et générer le mot de passe</button></div>
          </form>
        </section>

        <form className="card" id="fiche" onSubmit={save}>
          <div className="card-head"><h2>Fiche client</h2><button className="btn btn-primary">Enregistrer</button></div>
          <div className="form-grid">
            <Field label="Raison sociale"><input value={form.name} onChange={set('name')} required /></Field>
            <Field label="SIRET"><input value={form.siret} onChange={set('siret')} /></Field>
            <Field label="Adresse" full><textarea value={form.address} onChange={set('address')} rows={2} /></Field>
            <Field label="Contact"><input value={form.contact_name} onChange={set('contact_name')} /></Field>
            <Field label="E-mail du contact"><input type="email" value={form.contact_email} onChange={set('contact_email')} /></Field>
            <Field label="Téléphone"><input value={form.contact_phone} onChange={set('contact_phone')} /></Field>
          </div>
        </form>

        <div><button className="btn btn-danger btn-sm" onClick={deleteClient}>Supprimer ce client</button></div>
      </div>
    </>
  );
}
