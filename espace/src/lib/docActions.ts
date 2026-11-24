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

/** Ouvre le PDF déposé s'il existe, sinon génère le PDF à partir des données. */
export async function downloadDocument(doc: Doc, client: Client): Promise<void> {
  const { buildPdf, pdfFilename } = await import('./pdf');
  if (doc.file_path) return openStoredFile(doc.file_path, pdfFilename(doc, client));
  const pdf = buildPdf(doc, client, await getSettings());
  downloadBlob(pdf.output('blob'), pdfFilename(doc, client));
}
