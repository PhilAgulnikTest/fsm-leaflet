import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { NotesForPhil } from '../components/NotesForPhil';

export function Landing() {
  return (
    <>
      <Header />
      <main className="page">
        <section className="hero">
          <h2>Free school meals are changing — and we've built something to help.</h2>
          <p>
            A simple way for schools and councils to publish a clear, parent-friendly
            information leaflet about FSM eligibility, branded for their area.
            Built with NAWRA, licensed Creative Commons.
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
              Pick your LA, customise the messaging, link to your LA-specific
              entitledto calculator, and publish a bespoke version.
            </p>
          </Link>

          <a
            href="/generic/nawra?format=pdf"
            className="cta-card"
            rel="noopener"
            download
          >
            <span className="cta-card__chip">For everyone</span>
            <h3>I just want the generic PDF</h3>
            <p>
              Download the unbranded NAWRA template — no sign-up, no customisation.
              Use it directly or share with a school.
            </p>
          </a>
        </div>

        <p className="muted" style={{ marginTop: '2rem' }}>
          Built by entitledto with the National Association of Welfare Rights Advisors.
          Template licensed CC BY 4.0.
        </p>

        <NotesForPhil />
      </main>
    </>
  );
}
