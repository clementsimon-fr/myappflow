export type Role = 'admin' | 'client';
export type DocKind = 'devis' | 'facture' | 'contrat' | 'autre';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  client_id: string | null;
  must_change_password: boolean;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  address: string;
  siret: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  created_at: string;
}

export interface ProjectModule {
  name: string;
  description: string;
}

export type PhaseStatus = 'a_venir' | 'en_cours' | 'termine';

export interface RoadmapPhase {
  title: string;
  objective: string;
  start: string;
  end: string;
  status: PhaseStatus;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  summary: string;
  status: 'en_preparation' | 'en_cours' | 'livre' | 'maintenance' | 'archive';
  modules: ProjectModule[];
  roadmap: { phases: RoadmapPhase[] };
  roadmap_visible: boolean;
  /** Bloc « Architecture » : hébergement, accès, sauvegardes… (texte libre). */
  architecture: string;
  created_at: string;
}

export interface DocLine {
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Doc {
  id: string;
  project_id: string;
  kind: DocKind;
  number: string;
  title: string;
  module: string;
  status: string;
  visible: boolean;
  issue_date: string;
  due_date: string | null;
  lines: DocLine[];
  discount_pct: number;
  vat_rate: number;
  payment_terms: string;
  notes: string;
  body: string;
  related_document_id: string | null;
  file_path: string | null;
  signed_file_path: string | null;
  signed_uploaded_at: string | null;
  client_paid_declared_at: string | null;
  acquitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  issuer_name: string;
  issuer_address: string;
  issuer_siren: string;
  issuer_email: string;
  issuer_phone: string;
  bank_holder: string;
  bank_name: string;
  iban: string;
  bic: string;
  vat_mention: string;
  signature_data_url: string;
}
