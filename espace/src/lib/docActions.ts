import { downloadBlob, openStoredFile } from './files';
import { supabase } from './supabase';
import type { Client, Doc, Settings } from './types';

let settingsCache: Settings | null = null;

export async function getSettings(force = false): Promise<Settings> {
  if (settingsCache && !force) return settingsCache;
  const { data, error } = await supabase.from('settings').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  settingsCache = (data as Settings) ?? ({} as Settings);
  return settingsCache;
}

export function clearSettingsCache() {
  settingsCache = null;
}

/**
 * Ouvre le PDF déposé s'il existe, sinon génère le PDF à partir des données.
 * variant « plain » : pour une facture acquittée, la facture d'origine (sans mention ni signature) ;
 * variant « acquitted » : toujours la version acquittée générée, avec signature.
 */
export async function downloadDocument(doc: Doc, client: Client, variant: 'auto' | 'plain' | 'acquitted' = 'auto'): Promise<void> {
  const { buildPdf, pdfFilename } = await import('./pdf');
  let target = doc;
  if (variant === 'plain' && doc.kind === 'facture' && doc.status === 'acquittee') target = { ...doc, status: 'a_regler', acquitted_at: null };
  if (variant !== 'acquitted' && doc.file_path) return openStoredFile(doc.file_path, pdfFilename(target, client));
  const pdf = buildPdf(target, client, await getSettings());
  downloadBlob(pdf.output('blob'), pdfFilename(target, client));
}
