import { supabase } from './supabase';

/** Appelle la fonction serveur /api/admin-users (création et gestion des accès). */
export async function adminUsers(action: string, payload: Record<string, unknown>): Promise<{ id?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}
