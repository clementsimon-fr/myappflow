// Fonction serverless Vercel : crée chaque mois la facture des contrats de maintenance actifs.
// Appelée par la tâche planifiée Vercel (vercel.json, le 1er du mois) avec CRON_SECRET,
// ou par l'administrateur depuis la fiche d'un contrat (bouton « Créer la mensualité du mois »).
import { createClient } from '@supabase/supabase-js';
import { parisToday, planMonthlyInvoices } from './_monthly.js';

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return send(res, 500, { error: 'Supabase non configuré sur le serveur' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return send(res, 401, { error: 'Non autorisé' });
  let only;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && token === cronSecret) {
    // Tâche planifiée : tous les contrats actifs.
  } else {
    if (req.method !== 'POST') return send(res, 401, { error: 'Non autorisé' });
    const { data: caller, error } = await admin.auth.getUser(token);
    if (error || !caller?.user) return send(res, 401, { error: 'Session invalide' });
    const { data: profile } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).maybeSingle();
    if (!profile || profile.role !== 'admin' || !profile.active) return send(res, 403, { error: 'Accès refusé' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    only = body.contract_id ? String(body.contract_id) : undefined;
  }

  try {
    const [contractsRes, invoicesRes] = await Promise.all([
      admin.from('documents').select('*').eq('kind', 'contrat'),
      admin.from('documents').select('*').eq('kind', 'facture'),
    ]);
    if (contractsRes.error) throw contractsRes.error;
    if (invoicesRes.error) throw invoicesRes.error;
    const { plan, skipped } = planMonthlyInvoices(contractsRes.data, invoicesRes.data, parisToday(), only);
    const created = [];
    for (const row of plan) {
      const { data, error } = await admin.from('documents').insert(row).select('id, number').single();
      if (error) throw error;
      created.push(data);
    }
    return send(res, 200, { created, skipped });
  } catch (e) {
    return send(res, 500, { error: e.message || String(e) });
  }
}
