import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { NotesForPhil } from '../components/NotesForPhil';

export function Landing() {
  return (
    <>
      <Header />
      <main className="page">
        <section className="hero hero--e2">
          <div className="hero__chip">an entitledto tool</div>
          <h2>Help more families claim the free school meals they're entitled to.</h2>
          <p>
            From September 2026 every child whose family receives Universal Credit
            can get free school meals. Publish a parent-friendly leaflet — branded
            for your school or your local authority — in under five minutes.
          </p>
        </section>

        <div className="cta-grid">
          <Link to="/customize/school" className="cta-card">
            <span className="cta-card__chip">For schools</span>
            <h3>I'm a school</h3>
            <p>
              Search for your school in the DfE register, add your contact details,
              publish a print-ready leaflet branded for your school.
            </p>
          </Link>

          <Link to="/customize/la" className="cta-card">
            <span className="cta-card__chip">For local authorities</span>
            <h3>I'm a local authority</h3>
            <p>
              Pick your LA, customise the messaging to your area, link to your
              LA-specific entitledto calculator, and publish a bespoke version.
            </p>
          </Link>

          <a
            href="/generic/entitledto-la?format=pdf"
            className="cta-card"
            rel="noopener"
            download
          >
            <span className="cta-card__chip">For everyone</span>
            <h3>Just give me the PDF</h3>
            <p>
              Download the generic entitledto-branded leaflet — no sign-up,
              no customisation. Use it directly or share with a school.
            </p>
          </a>
        </div>

        <p className="muted" style={{ marginTop: '2rem', fontSize: '0.85rem' }}>
          An entitledto product. Powered by <a href="https://entitledto.co.uk">entitledto.co.uk</a>.
        </p>

        <NotesForPhil />
      </main>
    </>
  );
}
