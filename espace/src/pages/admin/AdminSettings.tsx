import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { must, useAsync } from '../../lib/useAsync';
import { clearSettingsCache } from '../../lib/docActions';
import type { Settings } from '../../lib/types';
import { ErrorBox, Field } from '../../components/ui';

export default function AdminSettings() {
  const [form, setForm] = useState<Settings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { data, error } = useAsync(async () => must(await supabase.from('settings').select('*').single()) as Settings, []);
  useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return <><ErrorBox error={error} /><p className="muted">Chargement…</p></>;

  const set = (k: keyof Settings) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const { error: e2 } = await supabase.from('settings').update(form).eq('id', true);
    if (e2) return setErr(e2.message);
    clearSettingsCache();
    setMsg('Réglages enregistrés.');
  };

  const onSignature = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 300_000) return setErr('Image trop lourde (300 Ko maximum).');
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, signature_data_url: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={save}>
      <div className="page-head"><h1>Réglages</h1><button className="btn btn-primary">Enregistrer</button></div>
      <ErrorBox error={err} />
      {msg && <div className="alert alert-ok">{msg}</div>}
      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>Émetteur (en-tête des PDF)</h2></div>
          <div className="form-grid">
            <Field label="Nom"><input value={form.issuer_name} onChange={set('issuer_name')} placeholder="Clément SIMON" /></Field>
            <Field label="SIREN"><input value={form.issuer_siren} onChange={set('issuer_siren')} /></Field>
            <Field label="Adresse" full><textarea value={form.issuer_address} onChange={set('issuer_address')} rows={2} /></Field>
            <Field label="E-mail"><input value={form.issuer_email} onChange={set('issuer_email')} /></Field>
            <Field label="Téléphone"><input value={form.issuer_phone} onChange={set('issuer_phone')} /></Field>
            <Field label="Mention TVA (si TVA à 0 %)" full><input value={form.vat_mention} onChange={set('vat_mention')} /></Field>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Coordonnées bancaires (factures)</h2></div>
          <div className="form-grid">
            <Field label="Titulaire"><input value={form.bank_holder} onChange={set('bank_holder')} /></Field>
            <Field label="Banque"><input value={form.bank_name} onChange={set('bank_name')} /></Field>
            <Field label="IBAN"><input value={form.iban} onChange={set('iban')} /></Field>
            <Field label="BIC"><input value={form.bic} onChange={set('bic')} /></Field>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Signature (factures acquittées)</h2></div>
          <div className="row">
            {form.signature_data_url && <img src={form.signature_data_url} alt="Signature" style={{ maxHeight: 70, background: '#fff', borderRadius: 8, padding: 6 }} />}
            <input type="file" accept="image/png" onChange={(e) => onSignature(e.target.files?.[0])} style={{ maxWidth: 320 }} />
            {form.signature_data_url && <button type="button" className="btn btn-sm btn-danger" onClick={() => setForm({ ...form, signature_data_url: '' })}>Retirer</button>}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>Image PNG sur fond transparent ou blanc.</p>
        </section>
      </div>
    </form>
  );
}
