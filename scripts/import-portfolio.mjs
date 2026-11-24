// Importe un client, son projet et ses documents (avec leurs PDF d'origine) dans l'espace client.
// Les données viennent d'un fichier « manifest » JSON préparé à part (jamais committé : il contient des données client).
//
// Usage :
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-portfolio.mjs chemin/manifest.json [--dry-run]
//
// Format du manifest :
// {
//   "settings": { "issuer_name": "...", ... },                 // facultatif, ne remplace que les champs vides
//   "client":   { "name": "...", "contact_name": "...", ... },
//   "project":  { "name": "...", "summary": "...", "status": "en_cours", "modules": [...], "roadmap": {"phases": [...]}, "roadmap_visible": true },
//   "documents": [
//     { "kind": "devis", "number": "DEV-...", "title": "...", "module": "...", "status": "a_signer", "visible": true,
//       "issue_date": "2026-06-02", "due_date": "2026-07-02", "lines": [...], "discount_pct": 40, "payment_terms": "...",
//       "notes": "...", "body": "...", "acquitted_at": null, "pdf": "fichier.pdf" }   // pdf : relatif au manifest
//   ]
// }
// Le script est idempotent : un client existant (même nom) et des documents existants (même numéro) sont mis à jour.
import { readFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const [manifestPath, flag] = process.argv.slice(2);
const dryRun = flag === '--dry-run';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!manifestPath || (!dryRun && (!url || !key))) {
  console.error('Usage : SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-portfolio.mjs manifest.json [--dry-run]');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const baseDir = dirname(resolve(manifestPath));
for (const d of manifest.documents) {
  if (d.pdf) readFileSync(resolve(baseDir, d.pdf)); // vérifie que chaque PDF existe avant de commencer
}
console.log(`${manifest.client.name} · ${manifest.project.name} · ${manifest.documents.length} documents`);
if (dryRun) {
  for (const d of manifest.documents) console.log(`  ${d.kind.padEnd(8)} ${String(d.number).padEnd(16)} ${d.status.padEnd(18)} ${d.visible ? 'visible' : 'caché  '} ${d.pdf ?? ''}`);
  process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
const safe = (s) => basename(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');

if (manifest.settings) {
  const current = must(await db.from('settings').select('*').single());
  const patch = Object.fromEntries(Object.entries(manifest.settings).filter(([k, v]) => v && !current[k]));
  if (Object.keys(patch).length) must(await db.from('settings').update(patch).eq('id', true).select());
  console.log(`Réglages : ${Object.keys(patch).length ? Object.keys(patch).join(', ') : 'déjà remplis, inchangés'}`);
}

let client = must(await db.from('clients').select('*').eq('name', manifest.client.name).maybeSingle());
client = client
  ? must(await db.from('clients').update(manifest.client).eq('id', client.id).select().single())
  : must(await db.from('clients').insert(manifest.client).select().single());

let project = must(await db.from('projects').select('*').eq('client_id', client.id).eq('name', manifest.project.name).maybeSingle());
project = project
  ? must(await db.from('projects').update(manifest.project).eq('id', project.id).select().single())
  : must(await db.from('projects').insert({ ...manifest.project, client_id: client.id }).select().single());
console.log(`Client ${client.name} et projet ${project.name} prêts.`);

for (const { pdf, ...fields } of manifest.documents) {
  const row = { ...fields, project_id: project.id };
  let doc = must(await db.from('documents').select('id, file_path').eq('project_id', project.id).eq('number', fields.number).maybeSingle());
  doc = doc
    ? must(await db.from('documents').update(row).eq('id', doc.id).select().single())
    : must(await db.from('documents').insert(row).select().single());
  if (pdf) {
    const path = `${project.id}/${doc.id}/origine-${safe(pdf)}`;
    must(await db.storage.from('documents').upload(path, readFileSync(resolve(baseDir, pdf)), { contentType: 'application/pdf', upsert: true }));
    must(await db.from('documents').update({ file_path: path }).eq('id', doc.id).select());
  }
  console.log(`  ✓ ${fields.kind} ${fields.number}${pdf ? ' (+ PDF)' : ''}`);
}
console.log('Import terminé.');
