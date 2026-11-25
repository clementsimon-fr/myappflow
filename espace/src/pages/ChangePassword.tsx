import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ErrorBox, Field } from '../components/ui';

export default function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères.');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setBusy(false);
      return setError(err.message.includes('different') ? 'Choisissez un mot de passe différent du précédent.' : err.message);
    }
    await supabase.rpc('mark_password_changed');
    await refreshProfile();
    setBusy(false);
    setDone(true);
    if (forced) navigate('/', { replace: true });
  };

  const form = (
    <form className="card auth-card stack" onSubmit={submit}>
      {forced && (
        <div>
          <span className="logo">My<span>AppFlow</span></span>
          <p className="muted small" style={{ textAlign: 'center' }}>Bienvenue ! Choisissez votre mot de passe personnel pour continuer.</p>
        </div>
      )}
      {!forced && <h2>Changer mon mot de passe</h2>}
      <ErrorBox error={error} />
      {done && <div className="alert alert-ok">Mot de passe modifié.</div>}
      <Field label="Nouveau mot de passe (6 caractères minimum)">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </Field>
      <Field label="Confirmer">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </Field>
      <button className="btn btn-primary" disabled={busy}>Enregistrer</button>
      {forced && <button type="button" className="btn-link small" onClick={signOut}>Se déconnecter</button>}
    </form>
  );
  return forced ? <div className="auth-wrap">{form}</div> : form;
}
