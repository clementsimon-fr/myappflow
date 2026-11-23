import { createClient } from '@supabase/supabase-js';

// VITE_* en local ; NEXT_PUBLIC_* sont injectées automatiquement par l'intégration Supabase de Vercel.
const env = import.meta.env;
const url = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const anonKey = (env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'myappflow-espace' },
});

export const BUCKET = 'documents';
