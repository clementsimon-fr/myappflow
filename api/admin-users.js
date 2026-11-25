// Fonction serverless Vercel : gestion des accès clients (réservée à l'administrateur).
// Elle utilise la clé « service_role » de Supabase, qui ne doit jamais être envoyée au navigateur.
import { createClient } from '@supabase/supabase-js';

const LOGIN_DOMAIN = 'espace.myappflow.local';
const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return send(res, 500, { error: 'Supabase non configuré sur le serveur' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Vérifier que l'appelant est un administrateur actif
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return send(res, 401, { error: 'Non connecté' });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return send(res, 401, { error: 'Session invalide' });
  const { data: callerProfile } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).maybeSingle();
  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.active) return send(res, 403, { error: 'Accès refusé' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { action } = body;

  try {
    if (action === 'create') {
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = body.role === 'admin' ? 'admin' : 'client';
      if (!USERNAME_RE.test(username)) return send(res, 400, { error: 'Identifiant invalide (3 à 40 caractères : lettres, chiffres, . _ -)' });
      if (password.length < 6) return send(res, 400, { error: 'Mot de passe trop court (6 caractères minimum)' });
      if (role === 'client' && !body.client_id) return send(res, 400, { error: 'Client manquant' });

      const { data: created, error } = await admin.auth.admin.createUser({
        email: `${username}@${LOGIN_DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { username },
      });
      if (error) return send(res, 400, { error: error.message.includes('already') ? 'Cet identifiant existe déjà' : error.message });

      const { error: profErr } = await admin.from('profiles').insert({
        id: created.user.id,
        username,
        full_name: String(body.full_name || ''),
        role,
        client_id: role === 'client' ? body.client_id : null,
        must_change_password: true,
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return send(res, 400, { error: profErr.message });
      }
      return send(res, 200, { id: created.user.id });
    }

    if (action === 'reset_password') {
      const password = String(body.password || '');
      if (password.length < 6) return send(res, 400, { error: 'Mot de passe trop court (6 caractères minimum)' });
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password });
      if (error) return send(res, 400, { error: error.message });
      await admin.from('profiles').update({ must_change_password: true }).eq('id', body.user_id);
      return send(res, 200, { ok: true });
    }

    if (action === 'set_active') {
      if (body.user_id === caller.user.id) return send(res, 400, { error: 'Vous ne pouvez pas désactiver votre propre compte' });
      const active = Boolean(body.active);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { ban_duration: active ? 'none' : '876000h' });
      if (error) return send(res, 400, { error: error.message });
      await admin.from('profiles').update({ active }).eq('id', body.user_id);
      return send(res, 200, { ok: true });
    }

    if (action === 'delete') {
      if (body.user_id === caller.user.id) return send(res, 400, { error: 'Vous ne pouvez pas supprimer votre propre compte' });
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) return send(res, 400, { error: error.message });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'Action inconnue' });
  } catch (e) {
    return send(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}
