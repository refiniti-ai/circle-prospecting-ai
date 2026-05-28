import { useState } from "react";
import { MarketingPageShell } from "../components/marketing/MarketingPageShell";
import { submitContactForm } from "../lib/leadsApi";
import { contactInboxEmail } from "../lib/siteConfig";
import { notifyError, notifySuccess } from "../lib/notify";

/** Left-column contact details (email, phone, social). */
const CONTACT_DISPLAY = {
  kicker: "Get in touch",
  title: "We’re here to help",
  lead: "Reach us by email or phone, or send a note through the form — we reply within one business day.",
  email: "info@circleprospecting.ai",
  phoneDisplay: "(727) 301-6290",
  socials: [
    { label: "Facebook", href: "https://www.facebook.com/circleprospectingai", icon: "facebook" as const },
    { label: "X", href: "https://x.com/CircleProspecAI", icon: "x" as const },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/circleprospectingai", icon: "linkedin" as const },
  ],
} as const;

function IconMail() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
        fill="currentColor"
      />
    </svg>
  );
}

function SocialIcon({ kind }: { kind: "linkedin" | "x" | "facebook" | "instagram" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "currentColor" as const, "aria-hidden": true as const };
  switch (kind) {
    case "linkedin":
      return (
        <svg {...common}>
          <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2m-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5M12 7a5 5 0 110 10 5 5 0 010-10m0 2a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
      );
  }
}

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const inbox = contactInboxEmail();
  const display = CONTACT_DISPLAY;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) {
      notifyError("Please enter a message (at least a few sentences).");
      return;
    }
    setBusy(true);
    try {
      await submitContactForm({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim(),
        company: company.trim() || undefined,
      });
      notifySuccess("Thanks — we received your message and will get back to you soon.");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setCompany("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : `Could not send. Email ${inbox} directly.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingPageShell
      title="Contact us | Circle Prospecting AI"
      description="Reach Circle Prospecting AI — email, phone, social links, and a secure message form."
      path="/contact"
      heroTitle="Contact us"
      heroLead="We respond within one business day for most inquiries. Include your order ID for billing or delivery questions."
    >
      <section className="section home-section contact-premium-section">
        <div className="container contact-premium-wrap">
          <aside className="contact-premium-aside" aria-label="Contact details">
            <div className="contact-premium-aside__inner">
              <p className="contact-premium-kicker">{display.kicker}</p>
              <h2 className="contact-premium-aside__title">{display.title}</h2>
              <p className="contact-premium-aside__lead">{display.lead}</p>

              <div className="contact-premium-blocks">
                <div className="contact-premium-block">
                  <div className="contact-premium-block__icon" aria-hidden>
                    <IconMail />
                  </div>
                  <div className="contact-premium-block__body">
                    <h3 className="contact-premium-block__label">Email</h3>
                    <p className="contact-premium-block__text">
                      <a href={`mailto:${display.email}`} className="contact-premium-link">
                        {display.email}
                      </a>
                    </p>
                  </div>
                </div>
                <div className="contact-premium-block">
                  <div className="contact-premium-block__icon" aria-hidden>
                    <IconPhone />
                  </div>
                  <div className="contact-premium-block__body">
                    <h3 className="contact-premium-block__label">Phone</h3>
                    <p className="contact-premium-block__text">
                      <a href={`tel:${display.phoneDisplay.replace(/[^\d+]/g, "")}`} className="contact-premium-link">
                        {display.phoneDisplay}
                      </a>
                    </p>
                  </div>
                </div>
                <div className="contact-premium-block">
                  <div className="contact-premium-block__icon" aria-hidden>
                    <IconShare />
                  </div>
                  <div className="contact-premium-block__body">
                    <h3 className="contact-premium-block__label">Social</h3>
                    <ul className="contact-premium-social">
                      {display.socials.map((s) => (
                        <li key={s.href}>
                          <a
                            href={s.href}
                            className="contact-premium-social__btn"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={s.label}
                          >
                            <SocialIcon kind={s.icon} />
                            <span>{s.label}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="contact-premium-form-col">
            <div className="contact-premium-form-card section-surface">
              <h2 className="contact-premium-form-card__title">Send a message</h2>
              <form onSubmit={(e) => void onSubmit(e)} className="contact-premium-form" style={{ position: "relative" }}>
                <label className="cp-form-grid">
                  <span className="muted-label">Name</span>
                  <input
                    className="premium-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                </label>
                <label className="cp-form-grid">
                  <span className="muted-label">Email</span>
                  <input
                    type="email"
                    className="premium-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <label className="cp-form-grid">
                  <span className="muted-label">Phone (optional)</span>
                  <input
                    type="tel"
                    className="premium-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    maxLength={40}
                  />
                </label>
                <label className="cp-form-grid">
                  <span className="muted-label">Message</span>
                  <textarea
                    className="premium-input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={6}
                    minLength={10}
                    maxLength={8000}
                    placeholder="Tell us what you need — demos, partnerships, or support."
                    style={{ resize: "vertical", minHeight: 140 }}
                  />
                </label>
                <div
                  aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
                >
                  <label>
                    Company
                    <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </label>
                </div>
                <button type="submit" className="btn btn-primary contact-premium-submit" disabled={busy}>
                  {busy ? "Sending…" : "Send message"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .contact-premium-section {
          padding-top: 0.25rem;
          padding-bottom: clamp(1.25rem, 4vw, 2rem);
        }
        .contact-premium-wrap {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr);
          gap: clamp(1.25rem, 4vw, 2.75rem);
          max-width: 1120px;
          margin: 0 auto;
          align-items: start;
          width: 100%;
          min-width: 0;
        }
        @media (max-width: 900px) {
          .contact-premium-wrap {
            grid-template-columns: minmax(0, 1fr);
          }
          .contact-premium-form-col {
            order: -1;
          }
        }
        .contact-premium-aside,
        .contact-premium-form-col {
          min-width: 0;
        }
        .contact-premium-aside__inner {
          position: relative;
          overflow: hidden;
          padding: clamp(1.35rem, 4.5vw, 2.15rem);
          padding-left: clamp(1.5rem, 5vw, 2.35rem);
          border-radius: 20px;
          background: var(--rz-white);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.95) inset,
            0 20px 50px rgba(15, 23, 42, 0.07),
            0 6px 16px rgba(0, 122, 255, 0.05);
        }
        .contact-premium-aside__inner::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
          background: linear-gradient(180deg, var(--cp-blue) 0%, var(--cp-lime) 100%);
        }
        .contact-premium-kicker {
          margin: 0 0 0.45rem;
          font-size: clamp(0.68rem, 1.8vw, 0.72rem);
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--rz-text-subtle);
        }
        .contact-premium-aside__title {
          margin: 0 0 0.65rem;
          font-size: clamp(1.32rem, 4vw, 1.72rem);
          font-weight: 800;
          letter-spacing: -0.035em;
          color: var(--rz-text);
          line-height: 1.18;
        }
        .contact-premium-aside__title::after {
          content: "";
          display: block;
          width: 2.75rem;
          height: 3px;
          margin-top: 0.7rem;
          border-radius: 3px;
          background: linear-gradient(90deg, var(--cp-blue), var(--cp-lime));
        }
        .contact-premium-aside__lead {
          margin: 0 0 1.25rem;
          font-size: clamp(0.9rem, 2.6vw, 0.97rem);
          line-height: 1.6;
          max-width: 38rem;
          color: var(--rz-text-muted);
        }
        .contact-premium-blocks {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .contact-premium-block {
          display: flex;
          align-items: flex-start;
          gap: clamp(0.85rem, 3vw, 1.1rem);
          padding: 1.05rem 0;
          border-top: 1px solid rgba(15, 23, 42, 0.07);
        }
        .contact-premium-block:first-child {
          border-top: none;
          padding-top: 0.15rem;
        }
        .contact-premium-block__icon {
          flex-shrink: 0;
          width: clamp(44px, 11vw, 48px);
          height: clamp(44px, 11vw, 48px);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--cp-blue);
          background: #f1f5f9;
          border: 1px solid rgba(15, 23, 42, 0.07);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset;
        }
        .contact-premium-block__body {
          flex: 1;
          min-width: 0;
        }
        .contact-premium-block__label {
          margin: 0 0 0.4rem;
          font-size: clamp(0.72rem, 2vw, 0.78rem);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--rz-text-subtle);
        }
        .contact-premium-block__text {
          margin: 0;
          font-size: clamp(0.9rem, 2.5vw, 0.97rem);
          line-height: 1.55;
          color: var(--rz-text);
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .contact-premium-block__line {
          display: block;
        }
        .contact-premium-block__sub {
          display: block;
          margin-top: 0.45rem;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--rz-text-subtle);
        }
        @media (max-width: 380px) {
          .contact-premium-block {
            flex-direction: column;
            align-items: stretch;
          }
          .contact-premium-block__icon {
            width: 44px;
            height: 44px;
          }
        }
        .contact-premium-link {
          color: var(--cp-blue);
          font-weight: 600;
          text-decoration: none;
        }
        .contact-premium-link:hover {
          text-decoration: underline;
          color: var(--cp-blue-hover);
        }
        .contact-premium-link--soft {
          font-weight: 500;
          color: var(--cp-lime-hover);
        }
        .contact-premium-link--soft:hover {
          color: var(--cp-lime);
        }
        .contact-premium-social {
          list-style: none;
          margin: 0.25rem 0 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .contact-premium-social__btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.5rem 0.85rem;
          min-height: 44px;
          box-sizing: border-box;
          border-radius: 12px;
          font-size: clamp(0.82rem, 2.2vw, 0.875rem);
          font-weight: 600;
          color: var(--rz-text);
          text-decoration: none;
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.08);
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .contact-premium-social__btn:hover {
          background: #f1f5f9;
          border-color: rgba(0, 122, 255, 0.28);
          box-shadow: 0 4px 14px rgba(0, 122, 255, 0.1);
        }
        .contact-premium-form-card {
          padding: clamp(1.15rem, 4vw, 1.85rem);
          border-radius: 20px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.95) inset,
            0 20px 50px rgba(15, 23, 42, 0.07);
          background: var(--rz-white);
          min-width: 0;
        }
        .contact-premium-form-card__title {
          margin: 0 0 1.1rem;
          font-size: clamp(1.12rem, 3.5vw, 1.25rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--rz-text);
        }
        .contact-premium-form {
          display: grid;
          gap: clamp(0.85rem, 2.5vw, 1rem);
        }
        .contact-premium-form .premium-input {
          min-height: 44px;
        }
        .contact-premium-form textarea.premium-input {
          min-height: 120px;
        }
        .contact-premium-submit {
          margin-top: 0.25rem;
          width: 100%;
          justify-content: center;
          padding: 0.95rem 1.25rem;
          min-height: 48px;
          font-weight: 700;
        }
      `}</style>
    </MarketingPageShell>
  );
}
