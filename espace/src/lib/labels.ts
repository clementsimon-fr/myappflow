import type { DocKind, PhaseStatus, Project } from './types';

export const KIND_LABEL: Record<DocKind, string> = {
  devis: 'Devis',
  facture: 'Facture',
  contrat: 'Contrat',
  autre: 'Document',
};

export const KIND_PLURAL: Record<DocKind, string> = {
  devis: 'Devis',
  facture: 'Factures',
  contrat: 'Contrats',
  autre: 'Autres documents',
};

export const STATUSES: Record<DocKind, { value: string; label: string }[]> = {
  devis: [
    { value: 'brouillon', label: 'Brouillon' },
    { value: 'a_signer', label: 'À signer' },
    { value: 'signe', label: 'Signé' },
    { value: 'refuse', label: 'Refusé' },
    { value: 'archive', label: 'Archivé' },
  ],
  facture: [
    { value: 'brouillon', label: 'Brouillon' },
    { value: 'a_regler', label: 'À régler' },
    { value: 'reglement_declare', label: 'Règlement déclaré' },
    { value: 'acquittee', label: 'Acquittée' },
    { value: 'annulee', label: 'Annulée' },
  ],
  contrat: [
    { value: 'brouillon', label: 'Brouillon' },
    { value: 'actif', label: 'Actif' },
    { value: 'termine', label: 'Terminé' },
  ],
  autre: [
    { value: 'brouillon', label: 'Brouillon' },
    { value: 'publie', label: 'Publié' },
  ],
};

export function statusLabel(kind: DocKind, status: string): string {
  return STATUSES[kind].find((s) => s.value === status)?.label ?? status;
}

/** Couleur de pastille : attention (action attendue), ok (terminé), neutre. */
export function statusTone(status: string): 'warn' | 'ok' | 'muted' | 'info' {
  if (['a_signer', 'a_regler'].includes(status)) return 'warn';
  if (['signe', 'acquittee', 'actif', 'publie'].includes(status)) return 'ok';
  if (status === 'reglement_declare') return 'info';
  return 'muted';
}

export const PROJECT_STATUS: Record<Project['status'], string> = {
  en_preparation: 'En préparation',
  en_cours: 'En cours',
  livre: 'Livré',
  maintenance: 'En maintenance',
  archive: 'Archivé',
};

export const PHASE_STATUS: Record<PhaseStatus, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  termine: 'Terminé',
};
