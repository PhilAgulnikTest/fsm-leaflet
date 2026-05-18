import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// The 10 non-English UK languages plus English. Mirrors LANGUAGE_LABELS in
// server/src/routes/render.ts — keep in sync if either list changes.
const LANGUAGES: Array<{ code: string; native: string; english: string }> = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'pl', native: 'Polski', english: 'Polish' },
  { code: 'ro', native: 'Română', english: 'Romanian' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { code: 'ur', native: 'اردو', english: 'Urdu' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'cy', native: 'Cymraeg', english: 'Welsh' },
];

function LanguageMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="lang-menu" ref={ref}>
      <button
        type="button"
        className="lang-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🌐</span> Other languages
      </button>
      {open && (
        <ul className="lang-menu__panel" role="menu">
          {LANGUAGES.map((l) => (
            <li key={l.code} role="none">
              <a
                role="menuitem"
                href={l.code === 'en' ? '/view/entitledto-la' : `/view/entitledto-la?lang=${l.code}`}
                target="_blank"
                rel="noopener"
                lang={l.code}
                dir={l.code === 'ur' ? 'rtl' : undefined}
                className="lang-menu__link"
              >
                <span className="lang-menu__native">{l.native}</span>
                <span className="lang-menu__english">{l.english}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/" className="app-header__brand" aria-label="entitledto Free School Meals leaflet — home">
          <img src="/entitledto-logo.svg" alt="entitledto" className="app-header__logo" />
          <span className="app-header__product">Free School Meals leaflet</span>
        </Link>
        <nav className="app-header__nav" aria-label="Primary">
          <Link to="/customize/school">For schools</Link>
          <Link to="/customize/la">For local authorities</Link>
          <LanguageMenu />
          <Link to="/admin">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
