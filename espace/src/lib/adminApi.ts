import { supabase } from './supabase';

/** Appelle la fonction serveur /api/admin-users (création et gestion des accès). */
export async function adminUsers(action: string, payload: Record<string, unknown>): Promise<{ id?: string }> {
  return callApi('/api/admin-users', { action, ...payload });
}

/** Crée la facture du mois pour un contrat (même logique que la tâche planifiée du 1er du mois). */
export function createMonthlyInvoice(contractId: string): Promise<{ created: { id: string; number: string }[]; skipped: { contract: string; reason: string }[] }> {
  return callApi('/api/monthly-invoices', { contract_id: contractId });
}

async function callApi<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}
