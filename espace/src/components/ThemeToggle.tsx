import { useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('myappflow-theme', next); } catch { /* stockage indisponible */ }
    setTheme(next);
  };
  return (
    <button type="button" className="btn btn-sm" onClick={toggle} aria-label="Changer de thème" title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
