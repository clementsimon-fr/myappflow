import { BUCKET, supabase } from './supabase';
import type { Doc } from './types';

export function docFolder(doc: Pick<Doc, 'id' | 'project_id'>): string {
  return `${doc.project_id}/${doc.id}`;
}

function safeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);
}

export async function uploadDocFile(doc: Pick<Doc, 'id' | 'project_id'>, file: File, prefix = ''): Promise<string> {
  const path = `${docFolder(doc)}/${prefix}${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/pdf' });
  if (error) throw new Error(error.message);
  return path;
}

/** Télécharge un fichier du stockage privé (un window.open après un appel réseau serait bloqué par Safari). */
export async function openStoredFile(path: string, filename?: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? 'Fichier introuvable');
  const name = filename ?? path.split('/').pop()!.replace(/^(origine-|signe-)?\d*-?/, '');
  downloadBlob(data, name);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
