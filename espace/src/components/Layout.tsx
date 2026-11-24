import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="logo">My<span>AppFlow</span></NavLink>
          <nav className="topnav" aria-label="Navigation principale">
            {isAdmin ? (
              <>
                <NavLink to="/" end>Tableau de bord</NavLink>
                <NavLink to="/clients">Clients</NavLink>
                <NavLink to="/reglages">Réglages</NavLink>
              </>
            ) : (
              <NavLink to="/" end>Mes projets</NavLink>
            )}
          </nav>
          <div className="topbar-right">
            <ThemeToggle />
            <NavLink to="/mot-de-passe" className="small muted topbar-user" title="Changer mon mot de passe">{profile?.full_name || profile?.username}</NavLink>
            <button type="button" className="btn btn-sm" onClick={signOut}>Déconnexion</button>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
