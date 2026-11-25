import { Link, NavLink, useLocation } from 'react-router';

interface Props {
  project: { id: string; name: string; app_url?: string };
  client: { id: string; name: string };
}

/** Barre fixe de l'administrateur : le projet et ses quatre accès, sur toutes les pages du projet. */
export default function ProjectBar({ project, client }: Props) {
  const { pathname, hash } = useLocation();
  const clientPage = pathname === `/clients/${client.id}`;
  const cls = (on: boolean) => `btn btn-sm${on ? ' btn-primary' : ''}`;
  const appUrl = project.app_url?.trim();

  return (
    <div className="project-bar" role="navigation" aria-label="Accès du projet">
      <NavLink to={`/projets/${project.id}`} end className="project-bar-name">
        <strong>{project.name}</strong> <span className="small muted">{client.name}</span>
      </NavLink>
      <div className="row">
        {appUrl ? (
          <a href={appUrl} target="_blank" rel="noreferrer" className={cls(false)}>Application ↗</a>
        ) : (
          <Link to={`/projets/${project.id}#reglages`} className={cls(false)} title="Adresse de l'application à renseigner dans « Réglages du projet »">Application</Link>
        )}
        <Link to={`/clients/${client.id}#acces`} className={cls(clientPage && hash === '#acces')}>Accès client</Link>
        <Link to={`/clients/${client.id}#fiche`} className={cls(clientPage && hash !== '#acces')}>Fiche client</Link>
        <Link to={`/apercu/projets/${project.id}`} className={cls(pathname.startsWith('/apercu/'))}>Vue client</Link>
      </div>
    </div>
  );
}
