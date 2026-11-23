import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './lib/auth';
import { isConfigured } from './lib/supabase';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import ClientHome from './pages/ClientHome';
import ClientProject from './pages/ClientProject';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminClients from './pages/admin/AdminClients';
import AdminClient from './pages/admin/AdminClient';
import AdminProject from './pages/admin/AdminProject';
import AdminDocument from './pages/admin/AdminDocument';
import AdminSettings from './pages/admin/AdminSettings';

function Loading() {
  return <div className="auth-wrap"><p className="muted">Chargement…</p></div>;
}

export default function App() {
  const { loading, session, profile } = useAuth();

  if (!isConfigured) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <a className="logo" href="/">My<span>AppFlow</span></a>
          <p className="alert alert-info">L'espace client n'est pas encore configuré (variables Supabase manquantes).</p>
        </div>
      </div>
    );
  }
  if (loading) return <Loading />;

  if (!session || !profile || !profile.active) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (profile.must_change_password) return <ChangePassword forced />;

  const isAdmin = profile.role === 'admin';
  return (
    <Routes>
      <Route element={<Layout />}>
        {isAdmin ? (
          <>
            <Route index element={<AdminDashboard />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="clients/:clientId" element={<AdminClient />} />
            <Route path="projets/:projectId" element={<AdminProject />} />
            <Route path="documents/:documentId" element={<AdminDocument />} />
            <Route path="reglages" element={<AdminSettings />} />
          </>
        ) : (
          <>
            <Route index element={<ClientHome />} />
            <Route path="projets/:projectId" element={<ClientProject />} />
          </>
        )}
        <Route path="mot-de-passe" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
