-- Adresse de l'application du client (bouton « Application » de la page projet admin).
alter table public.projects add column if not exists app_url text not null default '';
