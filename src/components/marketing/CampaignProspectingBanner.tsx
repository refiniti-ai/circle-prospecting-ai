import { Link } from "react-router-dom";
import { StartProspectingButton } from "../StartProspectingButton";
import { buildMlsLeadsUrl } from "../../lib/mlsUrl";
import { DEMO_MLS_ID } from "./marketingData";

/** Full-width campaign CTA banner — split layout, gradient shell. */
export function CampaignProspectingBanner() {
  return (
    <section className="cp-prospect-banner" aria-labelledby="cp-prospect-banner-title">
      <div className="cp-prospect-banner__bg" aria-hidden>
        <span className="cp-prospect-banner__orb cp-prospect-banner__orb--blue" />
        <span className="cp-prospect-banner__orb cp-prospect-banner__orb--green" />
      </div>
      <div className="container cp-prospect-banner__wrap">
        <div className="cp-prospect-banner__shell">
          <div className="cp-prospect-banner__copy">
            <p id="cp-prospect-banner-title" className="cp-prospect-banner__eyebrow">
              Ready to run a campaign?
            </p>
            <p className="cp-prospect-banner__lead">
              Start with your MLS or listing address — we&apos;ll open the same 4-step flow you see in our demo.
            </p>
            <ul className="cp-prospect-banner__checks" aria-label="What you get">
              <li>MLS-linked checkout in minutes</li>
              <li>Pick radius, package, and service lane</li>
              <li>Secure pay · dashboard delivery</li>
            </ul>
          </div>
          <div className="cp-prospect-banner__panel">
            <StartProspectingButton
              label="Start prospecting your area"
              className="cp-prospect-banner__primary"
            />
            <Link to={buildMlsLeadsUrl(DEMO_MLS_ID)} className="cp-prospect-banner__demo">
              View demo · MLS {DEMO_MLS_ID}
            </Link>
            <div className="cp-prospect-banner__foot">
              <span className="cp-prospect-banner__foot-label">Agent links</span>
              <code className="cp-prospect-banner__code">
                circleprospecting.ai/&#123;buyer|seller&#125;/mls/&#123;MLS#&#125;
              </code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
