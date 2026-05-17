import { NavLink, Outlet, Link } from 'react-router-dom';

/* ⚠️ Auth check intentionally disabled while Phil demos the platform.
 * Re-enable by restoring the adminApi.me() + redirect-to-login logic
 * AND uncommenting `adminRouter.use(requireSession('platform-admin'))`
 * in server/src/routes/admin.ts. Both must flip together. */

export function AdminDashboard() {
  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-header__brand" aria-label="entitledto FSM leaflet — home">
            <img src="/entitledto-logo.svg" alt="entitledto" className="app-header__logo" />
            <span className="app-header__product">FSM Leaflet · Admin</span>
          </Link>
          <nav className="app-header__nav">
            <Link to="/">Public site</Link>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Demo mode · no login</span>
          </nav>
        </div>
      </header>

      <div className="admin-warning-bar" role="status">
        <strong>⚠️ Admin is ungated.</strong> The password requirement is off
        for the demo. Anyone with this URL can edit templates, manage LAs,
        and approve trust-domain requests. Re-enable before sharing this URL
        publicly — instructions in <code>server/src/routes/admin.ts</code>.
      </div>

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
