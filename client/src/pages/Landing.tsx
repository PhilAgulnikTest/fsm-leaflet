import { Link } from 'react-router-dom';
import { Header } from '../components/Header';

export function Landing() {
  return (
    <>
      <Header />
      <main className="page">
        <section className="hero hero--split">
          <div className="hero__copy">
            <div className="hero__chip">an entitledto tool</div>
            <h2>Help more families claim the free school meals they're entitled to.</h2>
            <p>
              From September 2026 every child whose family receives Universal Credit
              can get free school meals. Publish a parent-friendly leaflet — branded
              for your school or your local authority — in under five minutes.
            </p>
            <p className="hero__tagline">independent &nbsp;|&nbsp; accurate &nbsp;|&nbsp; reliable</p>
          </div>
          <div className="hero__art">
            <a
              href="/view/entitledto-la"
              target="_blank"
              rel="noopener"
              className="hero__leaflet-link"
              aria-label="Open the entitledto leaflet to download"
            >
              <iframe
                src="/generic/entitledto-la"
                title="Preview of the entitledto-branded free school meals leaflet"
                className="hero__leaflet-iframe"
                tabIndex={-1}
                loading="lazy"
              />
              <span className="hero__leaflet-overlay">
                <span className="hero__leaflet-overlay-text">Click to download &nbsp;→</span>
              </span>
            </a>
            <div className="hero__art-caption">This is the entitledto edition. LAs get a bespoke variant; schools get a customisable version.</div>
          </div>
        </section>

        <div className="cta-grid">
          <a
            href="/view/entitledto-la"
            className="cta-card cta-card--primary"
            target="_blank"
            rel="noopener"
          >
            <span className="cta-card__chip cta-card__chip--accent">Default</span>
            <h3>View &amp; download the entitledto edition</h3>
            <p>
              Opens the print-ready entitledto-branded leaflet in a new tab,
              with a Download PDF button at the top. No sign-up, no customisation.
            </p>
          </a>

          <Link to="/customize/la" className="cta-card">
            <span className="cta-card__chip">For local authorities</span>
            <h3>Bespoke for my LA</h3>
            <p>
              Pick your LA, customise the messaging, link to your LA-specific entitledto
              calculator, and publish a bespoke version.
            </p>
          </Link>

          <Link to="/customize/school" className="cta-card">
            <span className="cta-card__chip">For schools</span>
            <h3>Customised for my school</h3>
            <p>
              Search the DfE register, add your contact details, publish a print-ready
              leaflet with your school's footer.
            </p>
          </Link>
        </div>

        <p className="muted" style={{ marginTop: '2rem', fontSize: '0.85rem' }}>
          An entitledto product. Powered by <a href="https://entitledto.co.uk">entitledto.co.uk</a>.
        </p>
      </main>
    </>
  );
}
