import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { adminApi } from './adminApi';

export function AdminDashboard() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    adminApi.me()
      .then((r) => {
        if (cancelled) return;
        if (r.session?.scope === 'platform-admin') {
          setEmail(r.session.email);
        } else {
          nav('/admin/login', { replace: true });
        }
      })
      .catch(() => { if (!cancelled) nav('/admin/login', { replace: true }); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [nav]);

  async function logout() {
    await adminApi.logout();
    nav('/admin/login');
  }

  if (checking) return <main className="page"><p>Loading…</p></main>;
  if (!email) return null;

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-header__brand" aria-label="entitledto Free School Meals leaflet — home">
            <img src="/entitledto-logo.svg" alt="entitledto" className="app-header__logo" />
            <span className="app-header__product">Free School Meals leaflet · Admin</span>
          </Link>
          <nav className="app-header__nav">
            <Link to="/">Public site</Link>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{email}</span>
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Sign out</a>
          </nav>
        </div>
      </header>

      <div className="admin-tabs">
        <NavLink to="/admin/templates" className={({ isActive }) => 'admin-tab' + (isActive ? ' admin-tab--active' : '')}>Templates</NavLink>
        <NavLink to="/admin/la-clients" className={({ isActive }) => 'admin-tab' + (isActive ? ' admin-tab--active' : '')}>LA clients</NavLink>
        <NavLink to="/admin/trust-domains" className={({ isActive }) => 'admin-tab' + (isActive ? ' admin-tab--active' : '')}>Trust domains</NavLink>
        <NavLink to="/admin/customizations" className={({ isActive }) => 'admin-tab' + (isActive ? ' admin-tab--active' : '')}>Customizations</NavLink>
        <NavLink to="/admin/ai-usage" className={({ isActive }) => 'admin-tab' + (isActive ? ' admin-tab--active' : '')}>AI usage</NavLink>
        <NavLink to="/admin/dev-notes" className={({ isActive }) => 'admin-tab admin-tab--devnotes' + (isActive ? ' admin-tab--active' : '')}>📝 Dev notes</NavLink>
      </div>
      <main className="page"><Outlet /></main>
    </>
  );
}
