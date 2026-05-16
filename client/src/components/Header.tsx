import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/" className="app-header__brand" aria-label="entitledto FSM leaflet — home">
          <img src="/entitledto-logo.svg" alt="entitledto" className="app-header__logo" />
          <span className="app-header__product">FSM Leaflet</span>
        </Link>
        <nav className="app-header__nav" aria-label="Primary">
          <Link to="/customize/school">For schools</Link>
          <Link to="/customize/la">For local authorities</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
