import { describe, expect, it } from 'vitest';
import { generatePassword, isValidUsername, normalizeUsername, usernameToEmail } from './username';

describe('identifiants', () => {
  it('normalise accents, espaces et majuscules', () => {
    expect(normalizeUsername('  Jérôme Dupont ')).toBe('jerome.dupont');
    expect(normalizeUsername('TELENCIA')).toBe('telencia');
  });
  it('valide le format', () => {
    expect(isValidUsername('telencia')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a b')).toBe(false);
  });
  it('dérive un e-mail interne', () => {
    expect(usernameToEmail('Telencia')).toBe('telencia@espace.myappflow.local');
  });
  it('génère un mot de passe de 12 caractères sans caractères ambigus', () => {
    const p = generatePassword();
    expect(p).toHaveLength(12);
    expect(p).not.toMatch(/[0O1lI]/);
  });
});
