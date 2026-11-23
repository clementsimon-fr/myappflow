-- Lancer sur un PostgreSQL vide (pas sur Supabase) :
--   psql -d test -f supabase/rls-tests/stubs.sql -f supabase/migrations/20261123000000_espace_client.sql -f supabase/rls-tests/rls_test.sql
-- Chaque contrôle affiche « ok : ... » ; le script s'arrête à la première erreur.
-- Scénario : un admin, deux clients (A et B). Vérifie que chacun ne voit que ce qu'il doit voir.
\set ON_ERROR_STOP on
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1');
insert into public.clients (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Client A'), ('10000000-0000-0000-0000-00000000000b', 'Client B');
insert into public.profiles (id, username, role, client_id) values
  ('00000000-0000-0000-0000-00000000000a', 'clement', 'admin', null),
  ('00000000-0000-0000-0000-0000000000a1', 'alice', 'client', '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob', 'client', '10000000-0000-0000-0000-00000000000b');
insert into public.projects (id, client_id, name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Projet A'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'Projet B');
insert into public.documents (id, project_id, kind, number, status, visible) values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a', 'facture', 'FAC-2026-001', 'a_regler', true),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000a', 'devis', 'DEV-2026-001', 'a_signer', true),
  ('30000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-00000000000a', 'devis', 'DEV-2026-002', 'a_signer', false),
  ('30000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-00000000000a', 'facture', '', 'brouillon', true),
  ('30000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-00000000000b', 'facture', 'FAC-2026-002', 'a_regler', true);
insert into storage.objects (bucket_id, name) values
  ('documents', '20000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a1/facture.pdf'),
  ('documents', '20000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a3/cache.pdf'),
  ('documents', '20000000-0000-0000-0000-00000000000b/30000000-0000-0000-0000-0000000000b1/facture.pdf'),
  ('documents', 'divers/pas-un-uuid.pdf');

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok : %', label;
end $$;

-- Anonyme : rien
set role anon;
select pg_temp.check('anonyme ne voit aucun document', (select count(*) from public.documents) = 0);
select pg_temp.check('anonyme ne voit aucun client', (select count(*) from public.clients) = 0);
select pg_temp.check('anonyme ne voit pas les réglages (IBAN)', (select count(*) from public.settings) = 0);
reset role;

-- Client A
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.check('A voit 1 société', (select count(*) from public.clients) = 1);
select pg_temp.check('A voit 1 projet', (select count(*) from public.projects) = 1);
select pg_temp.check('A voit 2 documents (ni caché, ni brouillon, ni ceux de B)', (select count(*) from public.documents) = 2);
select pg_temp.check('A ne voit que son profil', (select count(*) from public.profiles) = 1);
select pg_temp.check('A voit 1 fichier', (select count(*) from storage.objects) = 1);
select pg_temp.check('A lit les réglages pour ses PDF', (select count(*) from public.settings) = 1);
update public.documents set status = 'acquittee';
select pg_temp.check('A ne peut pas modifier un document directement', (select count(*) from public.documents where status = 'acquittee') = 0);
select public.client_declare_payment('30000000-0000-0000-0000-0000000000a1');
select pg_temp.check('A déclare le règlement de sa facture', (select status from public.documents where id = '30000000-0000-0000-0000-0000000000a1') = 'reglement_declare');
do $$ begin perform public.client_declare_payment('30000000-0000-0000-0000-0000000000b1'); raise exception 'aurait dû échouer'; exception when others then if sqlerrm not like 'Document introuvable%' then raise; end if; end $$;
select pg_temp.check('A ne peut pas déclarer une facture de B', true);
insert into storage.objects (bucket_id, name) values ('documents', '20000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a2/signe-1.pdf');
select public.client_attach_signed_devis('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a2/signe-1.pdf');
select pg_temp.check('A dépose son devis signé', (select signed_uploaded_at is not null from public.documents where id = '30000000-0000-0000-0000-0000000000a2'));
do $$ begin insert into storage.objects (bucket_id, name) values ('documents', '20000000-0000-0000-0000-00000000000b/30000000-0000-0000-0000-0000000000b1/signe-2.pdf'); raise exception 'aurait dû échouer'; exception when insufficient_privilege then null; end $$;
select pg_temp.check('A ne peut pas déposer de fichier chez B', true);
do $$ begin perform public.next_document_number('facture'); raise exception 'aurait dû échouer'; exception when others then if sqlerrm not like 'Réservé%' then raise; end if; end $$;
select pg_temp.check('A ne peut pas numéroter', true);
reset role; reset request.jwt.sub;

-- Admin
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check('admin voit tout', (select count(*) from public.documents) = 5);
select pg_temp.check('admin voit tous les fichiers', (select count(*) from storage.objects) = 5);
select pg_temp.check('numéro suivant de facture', public.next_document_number('facture', 2026) = 'FAC-2026-003');
select pg_temp.check('numéro suivant de contrat', public.next_document_number('contrat', 2026) = 'CM-2026-001');
update public.settings set iban = 'FR76 TEST';
select pg_temp.check('admin modifie les réglages', (select iban from public.settings) = 'FR76 TEST');
reset role; reset request.jwt.sub;

-- Compte désactivé
update public.profiles set active = false where username = 'bob';
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.check('compte désactivé ne voit plus rien', (select count(*) from public.documents) = 0);
reset role;
