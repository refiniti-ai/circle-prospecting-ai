import { contactInboxEmail, contactPhoneDisplay } from "../../lib/siteConfig";
import {
  POSTER_FOOTER_COPY,
  POSTER_FOOTER_CTA,
  POSTER_FOOTER_TAGLINE_LINES,
} from "./marketingData";

function FlyerPhoneIcon() {
  return (
    <span className="cp-flyer-footer__phone-ring" aria-hidden>
      <svg className="cp-flyer-footer__phone-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6.5 4.8c.4-.9 1.4-1.3 2.3-1 2.1.9 4 2.3 5.6 4 1.6 1.6 3 3.5 4 5.6.3.9-.1 1.9-1 2.3l-1.5.6c-.7.3-1.5.1-2-.5l-1-1.2c-.4-.5-1.1-.6-1.6-.3l-.8.5c-1.5.9-3.3 2.7-4.2 4.2l-.5.8c-.3.5-.2 1.2.3 1.6l1.2 1c.6.5.8 1.3.5 2l-.6 1.5c-.4.9-1.4 1.3-2.3 1-2.4-.6-4.7-1.7-6.7-3.2-2-1.5-3.7-3.4-5-5.6-.6-1-.4-2.2.5-2.8l1.5-1c.5-.4.6-1.1.3-1.6l-1-1.2c-.5-.6-.4-1.4.3-1.9l1.2-.8z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function ContactGlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.5 2.8 4 6.2 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-4 6.2-4 9s1.5 6.2 4 9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ContactMailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ContactPhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 4.8c.4-.9 1.4-1.3 2.3-1 2.1.9 4 2.3 5.6 4 1.6 1.6 3 3.5 4 5.6.3.9-.1 1.9-1 2.3l-1.5.6c-.7.3-1.5.1-2-.5l-1-1.2c-.4-.5-1.1-.6-1.6-.3l-.8.5c-1.5.9-3.3 2.7-4.2 4.2l-.5.8c-.3.5-.2 1.2.3 1.6l1.2 1c.6.5.8 1.3.5 2l-.6 1.5c-.4.9-1.4 1.3-2.3 1-2.4-.6-4.7-1.7-6.7-3.2-2-1.5-3.7-3.4-5-5.6-.6-1-.4-2.2.5-2.8l1.5-1c.5-.4.6-1.1.3-1.6l-1-1.2c-.5-.6-.4-1.4.3-1.9l1.2-.8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Client agent sales sheet footer — white band, green phone disc, contact row. */
export function CampaignPricingFlyerFooter() {
  const phone = contactPhoneDisplay();
  const email = contactInboxEmail();

  return (
    <section className="cp-flyer-footer" aria-labelledby="cp-flyer-footer-title">
      <div className="container cp-flyer-footer__inner">
        <FlyerPhoneIcon />
        <div className="cp-flyer-footer__pitch">
          <p id="cp-flyer-footer-title" className="cp-flyer-footer__headline">
            {POSTER_FOOTER_CTA}
          </p>
          <p className="cp-flyer-footer__script">{POSTER_FOOTER_COPY}</p>
        </div>
        <div className="cp-flyer-footer__contact">
          <a href="https://circleprospecting.ai" className="cp-flyer-footer__link">
            <ContactGlobeIcon />
            <span>circleprospecting.ai</span>
          </a>
          <a href={`mailto:${email}`} className="cp-flyer-footer__link">
            <ContactMailIcon />
            <span>{email}</span>
          </a>
          {phone ? (
            <a href={`tel:${phone.replace(/\D/g, "")}`} className="cp-flyer-footer__link">
              <ContactPhoneIcon />
              <span>{phone}</span>
            </a>
          ) : null}
        </div>
        <div className="cp-flyer-footer__taglines">
          {POSTER_FOOTER_TAGLINE_LINES.map((line) => (
            <p key={line.text} className={`cp-flyer-footer__tagline cp-flyer-footer__tagline--${line.tone}`}>
              {line.text}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
