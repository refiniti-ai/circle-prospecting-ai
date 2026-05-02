import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TRUST_BRANDS } from "./marketingData";

function IconPerson() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.25.39-.5.57-.77a16,16,0,0,0,1.32-15.06l0-.12L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46ZM176,208A128.14,128.14,0,0,1,48,80,40.2,40.2,0,0,1,82.87,40a.61.61,0,0,0,0,.12l21,47L83.2,111.86a6.13,6.13,0,0,0-.57.77,16,16,0,0,0-1,15.7c9.06,18.53,27.73,37.06,46.46,46.11a16,16,0,0,0,15.75-1.14,8.44,8.44,0,0,0,.74-.56L168.89,152l47,21.05h0s.08,0,.11,0A40.21,40.21,0,0,1,176,208Z" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        stroke="url(#rzPhoneSpark)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="rzPhoneSpark" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#007aff" />
          <stop offset="1" stopColor="#a2d729" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Post-hero device mock inspired by Rezora’s homepage: dark phone chrome, centered,
 * grayscale logo strip overlaps below — adapted for Circle (sample request, not inbound call).
 */
export function RzPostHeroPhoneMarquee() {
  const navigate = useNavigate();
  const doubled = [...TRUST_BRANDS, ...TRUST_BRANDS];

  function onSampleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navigate("/buy-leads");
  }

  return (
    <div className="rz-phone-marquee-bundle" role="region" aria-labelledby="rz-phone-stage-h">
      <div className="rz-phone-stage-wrap rz-reveal-static">
        <div className="rz-phone-stage-inner">
          <div id="hero-demo-call" className="rz-phone-scroll-target">
            <div className="rz-phone-hover-scale">
              <div className="rz-phone-rings-wrap" aria-hidden>
                <span className="rz-phone-signal-ring" />
                <span className="rz-phone-signal-ring" />
                <span className="rz-phone-signal-ring" />
                <span className="rz-phone-signal-ring" />
              </div>
              <div className="rz-phone-device-outer">
                <div className="rz-phone-side-btn rz-phone-side-btn--l1" aria-hidden />
                <div className="rz-phone-side-btn rz-phone-side-btn--l2" aria-hidden />
                <div className="rz-phone-side-btn rz-phone-side-btn--l3" aria-hidden />
                <div className="rz-phone-side-btn rz-phone-side-btn--r1" aria-hidden />
                <div className="rz-phone-bezel">
                  <div className="rz-phone-screen">
                    <div className="rz-phone-notch" aria-hidden>
                      <span className="rz-phone-notch-cam" />
                    </div>
                    <div className="rz-phone-screen-pad">
                      <div className="rz-phone-glass-card">
                        <div className="rz-phone-card-row">
                          <div className="rz-phone-avatar" aria-hidden>
                            <IconSpark />
                          </div>
                          <div className="rz-phone-card-copy">
                            <span className="rz-phone-card-title">Circle Prospecting AI</span>
                            <div className="rz-phone-card-sub">
                              Neighborhood preview ready
                              <span className="rz-phone-dots" aria-hidden>
                                <span className="rz-phone-dot rz-phone-dot--1">.</span>
                                <span className="rz-phone-dot rz-phone-dot--2">.</span>
                                <span className="rz-phone-dot rz-phone-dot--3">.</span>
                              </span>
                            </div>
                          </div>
                          <div className="rz-phone-open-btn" aria-hidden>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M12 5v14M5 12h14"
                                stroke="rgba(255,255,255,0.85)"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="rz-phone-head-block">
                        <h2 id="rz-phone-stage-h" className="rz-phone-headline">
                          Put your next farm to the test
                        </h2>
                        <p className="rz-phone-lead">
                          Drop your details — we&apos;ll route you to packs and ring pricing in one flow.
                        </p>
                      </div>
                      <form className="rz-phone-form" onSubmit={onSampleSubmit} noValidate>
                        <label className="rz-phone-field">
                          <span className="rz-phone-field-icon">
                            <IconPerson />
                          </span>
                          <input name="name" type="text" autoComplete="name" placeholder="Name" aria-label="Name" className="rz-phone-input" />
                        </label>
                        <label className="rz-phone-field">
                          <span className="rz-phone-field-icon">
                            <IconMail />
                          </span>
                          <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="Email"
                            aria-label="Email"
                            className="rz-phone-input"
                          />
                        </label>
                        <label className="rz-phone-field">
                          <span className="rz-phone-field-icon">
                            <IconPhone />
                          </span>
                          <input name="tel" type="tel" autoComplete="tel" placeholder="Phone" aria-label="Phone" className="rz-phone-input" />
                        </label>
                        <button type="submit" className="rz-phone-submit">
                          Continue to lead packs
                        </button>
                        <p className="rz-phone-legal">
                          By continuing you agree to our{" "}
                          <Link to="/terms" className="rz-phone-legal-link">
                            Terms
                          </Link>{" "}
                          and{" "}
                          <Link to="/privacy" className="rz-phone-legal-link">
                            Privacy Policy
                          </Link>
                          .
                        </p>
                      </form>
                    </div>
                    <div className="rz-phone-fade-bottom" aria-hidden />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rz-phone-marquee-flyover">
        <div className="rz-phone-marquee-pad">
          <section aria-label="Teams at brokerages like these trust similar stacks" className="rz-logo-marquee rz-logo-marquee--embed">
            <div className="rz-logo-marquee-viewport rz-stagger-child">
              <div className="rz-logo-marquee-track">
                {doubled.map((b, i) => (
                  <span key={`${b}-${i}`}>{b}</span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
