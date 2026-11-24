-- Bloc « Architecture » de l'espace client : texte libre rédigé par l'administrateur
-- (hébergement, accès, sauvegardes…). Visible par le client du projet, comme le reste du projet.
alter table public.projects add column if not exists architecture text not null default '';
