import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const menu = useRef<HTMLDetailsElement>(null);
  const location = useLocation();
  // Referme le menu du compte quand on change de page.
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [location.pathname]);

  const name = profile?.full_name || profile?.username;
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="logo">My<span>AppFlow</span></NavLink>
          <nav className="topnav" aria-label="Navigation principale">
            <NavLink to="/" end>{isAdmin ? 'Projets' : 'Mes projets'}</NavLink>
          </nav>
          <div className="topbar-right">
            <ThemeToggle />
            <details className="user-menu" ref={menu}>
              <summary className="small topbar-user">{name} <span aria-hidden="true">▾</span></summary>
              <div className="user-menu-list">
                {isAdmin && <Link to="/reglages">Réglages</Link>}
                {isAdmin && <Link to="/clients">Clients</Link>}
                <Link to="/mot-de-passe">Changer mon mot de passe</Link>
                <button type="button" onClick={signOut}>Déconnexion</button>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
