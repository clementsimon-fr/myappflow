// Crée (une seule fois) le compte administrateur de l'espace client.
// Usage : SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.mjs <identifiant> <mot-de-passe> ["Nom affiché"]
import { createClient } from '@supabase/supabase-js';

const [username, password, fullName = ''] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !username || !password) {
  console.error('Usage : SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.mjs <identifiant> <mot-de-passe> ["Nom affiché"]');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Mot de passe trop court (10 caractères minimum).');
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.createUser({
  email: `${username.toLowerCase()}@espace.myappflow.local`,
  password,
  email_confirm: true,
});
if (error) {
  console.error(error.message);
  process.exit(1);
}
const { error: e2 } = await admin.from('profiles').insert({
  id: data.user.id,
  username: username.toLowerCase(),
  full_name: fullName,
  role: 'admin',
  must_change_password: false,
});
if (e2) {
  console.error(e2.message);
  await admin.auth.admin.deleteUser(data.user.id);
  process.exit(1);
}
console.log(`Administrateur « ${username.toLowerCase()} » créé.`);
