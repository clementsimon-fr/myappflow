-- MyAppFlow : espace client
-- A exécuter une fois dans l'éditeur SQL de Supabase (ou via `supabase db push`).
-- Principe de sécurité : un client ne voit que les projets et documents de SA société,
-- et seulement les documents rendus visibles par l'administrateur.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  siret text not null default '',
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  full_name text not null default '',
  role text not null default 'client' check (role in ('admin', 'client')),
  client_id uuid references public.clients (id) on delete set null,
  must_change_password boolean not null default true,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  constraint client_role_has_client check (role = 'admin' or client_id is not null)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  summary text not null default '',
  status text not null default 'en_cours' check (status in ('en_preparation', 'en_cours', 'livre', 'maintenance', 'archive')),
  -- [{ "name": "Suivi flotte", "description": "..." }]
  modules jsonb not null default '[]'::jsonb,
  -- { "phases": [{ "title", "objective", "start", "end", "status" }] }
  roadmap jsonb not null default '{"phases": []}'::jsonb,
  roadmap_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_client_id_idx on public.projects (client_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('devis', 'facture', 'contrat', 'autre')),
  number text not null default '',
  title text not null default '',
  module text not null default '',
  status text not null default 'brouillon',
  visible boolean not null default false,
  issue_date date not null default current_date,
  due_date date,
  -- [{ "title", "description", "quantity", "unit_price" }] (prix HT en euros)
  lines jsonb not null default '[]'::jsonb,
  discount_pct numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  vat_rate numeric(5, 2) not null default 0 check (vat_rate between 0 and 100),
  payment_terms text not null default '',
  notes text not null default '',
  body text not null default '',               -- texte libre (contrats)
  related_document_id uuid references public.documents (id) on delete set null, -- facture -> devis
  file_path text,                              -- PDF déposé par l'admin (remplace le PDF généré)
  signed_file_path text,                       -- devis signé déposé par le client
  signed_uploaded_at timestamptz,
  client_paid_declared_at timestamptz,         -- « règlement effectué » déclaré par le client
  acquitted_at date,                           -- facture acquittée
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint status_matches_kind check (
    (kind = 'devis'   and status in ('brouillon', 'a_signer', 'signe', 'refuse', 'archive')) or
    (kind = 'facture' and status in ('brouillon', 'a_regler', 'reglement_declare', 'acquittee', 'annulee')) or
    (kind = 'contrat' and status in ('brouillon', 'actif', 'termine')) or
    (kind = 'autre'   and status in ('brouillon', 'publie'))
  )
);
create index documents_project_id_idx on public.documents (project_id);
create unique index documents_number_uniq on public.documents (number) where number <> '';

-- Coordonnées de l'émetteur (une seule ligne), utilisées sur les PDF.
create table public.settings (
  id boolean primary key default true check (id),
  issuer_name text not null default '',
  issuer_address text not null default '',
  issuer_siren text not null default '',
  issuer_email text not null default '',
  issuer_phone text not null default '',
  bank_holder text not null default '',
  bank_name text not null default '',
  iban text not null default '',
  bic text not null default '',
  vat_mention text not null default 'TVA non applicable, art. 293 B du CGI',
  signature_data_url text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid() and role = 'client' and active;
$$;

-- Numéro suivant : DEV-2026-001, FAC-2026-001, CM-2026-001, DOC-2026-001
create or replace function public.next_document_number(p_kind text, p_year int default extract(year from current_date)::int)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_prefix text := case p_kind when 'devis' then 'DEV' when 'facture' then 'FAC' when 'contrat' then 'CM' else 'DOC' end;
  v_base text := v_prefix || '-' || p_year || '-';
  v_max int;
begin
  if not public.is_admin() then
    raise exception 'Réservé à l''administrateur';
  end if;
  select coalesce(max((regexp_match(number, '^' || v_base || '(\d+)$'))[1]::int), 0)
    into v_max from public.documents where number like v_base || '%';
  return v_base || lpad((v_max + 1)::text, 3, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Actions autorisées au client (tout le reste est en lecture seule pour lui)
-- ---------------------------------------------------------------------------

create or replace function public.try_uuid(p text) returns uuid
language sql immutable as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end;
$$;

-- Vérifie qu'un document visible appartient à la société du client connecté.
create or replace function public.client_owns_document(p_document_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d join public.projects p on p.id = d.project_id
    where d.id = p_document_id and d.visible and d.status <> 'brouillon'
      and p.client_id = public.my_client_id()
  );
$$;

create or replace function public.client_declare_payment(p_document_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.client_owns_document(p_document_id) then
    raise exception 'Document introuvable';
  end if;
  update public.documents
     set client_paid_declared_at = now(),
         status = case when status = 'a_regler' then 'reglement_declare' else status end
   where id = p_document_id and kind = 'facture' and status in ('a_regler', 'reglement_declare');
  if not found then
    raise exception 'Cette facture ne peut pas être déclarée réglée';
  end if;
end;
$$;

create or replace function public.client_attach_signed_devis(p_document_id uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.client_owns_document(p_document_id) then
    raise exception 'Document introuvable';
  end if;
  if p_path is null or p_path not like '%/' || p_document_id::text || '/signe-%' then
    raise exception 'Chemin de fichier invalide';
  end if;
  update public.documents
     set signed_file_path = p_path, signed_uploaded_at = now()
   where id = p_document_id and kind = 'devis' and status = 'a_signer';
  if not found then
    raise exception 'Ce devis n''attend pas de signature';
  end if;
end;
$$;

create or replace function public.mark_password_changed() returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

create or replace function public.touch_last_login() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_login_at = now() where id = auth.uid();
$$;

revoke execute on function public.next_document_number(text, int) from anon;
revoke execute on function public.client_declare_payment(uuid) from anon;
revoke execute on function public.client_attach_signed_devis(uuid, text) from anon;
revoke execute on function public.mark_password_changed() from anon;
revoke execute on function public.touch_last_login() from anon;

-- ---------------------------------------------------------------------------
-- Sécurité ligne par ligne (RLS)
-- ---------------------------------------------------------------------------

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.settings enable row level security;

create policy admin_all on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.documents for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy client_read_own on public.clients for select to authenticated
  using (id = public.my_client_id());
create policy self_read on public.profiles for select to authenticated
  using (id = auth.uid());
create policy client_read_own on public.projects for select to authenticated
  using (client_id = public.my_client_id());
create policy client_read_visible on public.documents for select to authenticated
  using (visible and status <> 'brouillon'
         and project_id in (select id from public.projects where client_id = public.my_client_id()));
-- Les clients ont besoin des coordonnées de l'émetteur pour générer leurs PDF.
create policy client_read on public.settings for select to authenticated
  using (public.my_client_id() is not null);

-- ---------------------------------------------------------------------------
-- Stockage des fichiers (bucket privé « documents »)
-- Chemin : <project_id>/<document_id>/<fichier>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy documents_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

create policy documents_client_read on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and public.client_owns_document(public.try_uuid((storage.foldername(name))[2])));

create policy documents_client_upload_signed on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and storage.filename(name) like 'signe-%'
              and public.client_owns_document(public.try_uuid((storage.foldername(name))[2])));
