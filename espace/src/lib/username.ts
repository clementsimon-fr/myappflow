// Les clients se connectent avec un identifiant, pas un e-mail.
// Supabase Auth exige un e-mail : on dérive donc une adresse interne, jamais utilisée pour écrire.
export const LOGIN_DOMAIN = 'espace.myappflow.local';

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,40}$/.test(username);
}

export function usernameToEmail(raw: string): string {
  return `${normalizeUsername(raw)}@${LOGIN_DOMAIN}`;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Mot de passe provisoire lisible (sans 0/O, 1/l/I), 12 caractères. */
export function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
