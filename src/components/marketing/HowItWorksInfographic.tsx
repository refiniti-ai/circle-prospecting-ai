import { Link } from "react-router-dom";
import {
  HOW_IT_WORKS_HERO,
  HOW_IT_WORKS_PROOF,
  HOW_IT_WORKS_STEPS,
  HOW_IT_WORKS_TRUST,
} from "./marketingData";
import "./how-it-works-infographic.css";

function ProofIcon({ index }: { index: number }) {
  const kinds = ["phone", "people", "handshake", "dollar"] as const;
  return <span className={`hiw-flow__proof-icon hiw-flow__proof-icon--${kinds[index]}`} aria-hidden />;
}

function TrustIcon({ index }: { index: number }) {
  const kinds = ["shield", "lock", "callers", "clock"] as const;
  return <span className={`hiw-flow__trust-icon hiw-flow__trust-icon--${kinds[index]}`} aria-hidden />;
}

export function HowItWorksInfographic() {
  return (
    <article className="hiw-flow">
      <header className="hiw-flow__hero">
        <div className="container hiw-flow__hero-inner">
          <h1 className="hiw-flow__title">{HOW_IT_WORKS_HERO.title}</h1>
          <p className="hiw-flow__tagline">
            We have the <span className="hiw-flow__accent hiw-flow__accent--green">Data</span>. The{" "}
            <span className="hiw-flow__accent hiw-flow__accent--blue">Dialer</span>. And the{" "}
            <span className="hiw-flow__accent hiw-flow__accent--purple">Callers</span>.
          </p>
          <p className="hiw-flow__lead">{HOW_IT_WORKS_HERO.lead}</p>
        </div>
      </header>

      <div className="container hiw-flow__steps-wrap">
        <ol className="hiw-flow__steps">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <li key={step.n} className={`hiw-flow__step hiw-flow__step--${step.n}`}>
              <span className="hiw-flow__flow-arrow" aria-hidden />
              <span className="hiw-flow__step-badge">{step.n}</span>
              <div className="hiw-flow__step-visual">
                <img
                  className="hiw-flow__step-img"
                  src={step.image}
                  alt=""
                  width={200}
                  height={140}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <h2 className="hiw-flow__step-title">{step.title}</h2>
              <p className="hiw-flow__step-lead">{step.lead}</p>
              {step.bullets ? (
                <ul className="hiw-flow__checks">
                  {step.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {step.rings ? (
                <ul className="hiw-flow__rings">
                  {step.rings.map((r) => (
                    <li key={r.label}>
                      <span className="hiw-flow__ring-dot" aria-hidden />
                      <span className="hiw-flow__ring-line">
                        <strong>{r.label}</strong>
                        <span className="hiw-flow__ring-sep"> — </span>
                        <span className="hiw-flow__ring-hint">{r.hint}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {step.channels ? (
                <ul className="hiw-flow__channels">
                  {step.channels.map((c) => (
                    <li key={c.label}>
                      <strong>{c.label}</strong>
                      <span>{c.hint}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <section className="hiw-flow__proof" aria-labelledby="hiw-proof-h">
        <div className="container">
          <h2 id="hiw-proof-h" className="hiw-flow__proof-title">
            Proven Results for Real Estate Agents
          </h2>
          <ul className="hiw-flow__proof-grid">
            {HOW_IT_WORKS_PROOF.map((p, i) => (
              <li key={p.label}>
                <ProofIcon index={i} />
                <span className="hiw-flow__proof-num">{p.num}</span>
                <span className="hiw-flow__proof-label">{p.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="hiw-flow__cta" aria-labelledby="hiw-cta-h">
        <div className="hiw-flow__cta-dots" aria-hidden />
        <div className="hiw-flow__cta-glow" aria-hidden />
        <div className="container hiw-flow__cta-inner">
          <div className="hiw-flow__cta-copy">
            <h2 id="hiw-cta-h" className="hiw-flow__cta-title">
              Ready to Promote Your Next Listing?
            </h2>
            <p className="hiw-flow__cta-lead">
              Start turning your listings into conversations, appointments, and closed deals.
            </p>
          </div>
          <div className="hiw-flow__cta-actions">
            <Link to="/buy-leads" className="btn hiw-flow__cta-primary">
              Start Prospecting My Listing →
            </Link>
            <Link to="/campaign-pricing" className="btn hiw-flow__cta-secondary">
              See Pricing &amp; Plans
            </Link>
          </div>
          <div className="hiw-flow__cta-phone" aria-hidden>
            <div className="hiw-flow__phone-shell">
              <div className="hiw-flow__phone-notch" />
              <div className="hiw-flow__phone-screen">
                <p className="hiw-flow__phone-app">Circle Prospecting AI</p>
                <div className="hiw-flow__phone-card">
                  <p className="hiw-flow__phone-check" aria-hidden />
                  <p className="hiw-flow__phone-alert">New Opportunity</p>
                  <p className="hiw-flow__phone-sub">Homeowner responded near your listing</p>
                  <span className="hiw-flow__phone-btn">View Lead</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="hiw-flow__trust">
        <div className="container hiw-flow__trust-grid">
          {HOW_IT_WORKS_TRUST.map((t, i) => (
            <div key={t.title} className="hiw-flow__trust-item">
              <TrustIcon index={i} />
              <strong>{t.title}</strong>
              <span>{t.detail}</span>
            </div>
          ))}
        </div>
      </footer>
    </article>
  );
}
