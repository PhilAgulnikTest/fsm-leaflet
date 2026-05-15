import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <h1>
          <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>
            FSM Leaflet Platform
          </Link>
        </h1>
        <nav className="app-header__nav" aria-label="Primary">
          <Link to="/customize/school">For schools</Link>
          <Link to="/customize/la">For local authorities</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
