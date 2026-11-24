import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { ErrorBox, Field } from '../components/ui';

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(username, password));
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit}>
        <div>
          <a className="logo" href="/">My<span>AppFlow</span></a>
          <p className="muted small" style={{ textAlign: 'center', margin: 0 }}>Espace client</p>
        </div>
        <ErrorBox error={error} />
        <Field label="Identifiant">
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
        </Field>
        <Field label="Mot de passe">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>
          Identifiants perdus ? Écrivez à <a href="mailto:clement.simon@cabinetcs.fr">clement.simon@cabinetcs.fr</a>
        </p>
      </form>
    </div>
  );
}
