import { POSTER_FOOTER_COPY, POSTER_FOOTER_CTA } from "./marketingData";

/** Client flyer CTA — full-width band between pricing sheet and checkout banner. */
export function CampaignDominateBanner() {
  return (
    <section className="cp-dominate-banner" aria-labelledby="cp-dominate-banner-title">
      <div className="cp-dominate-banner__bg" aria-hidden />
      <div className="container cp-dominate-banner__inner">
        <span className="cp-dominate-banner__icon" aria-hidden />
        <div className="cp-dominate-banner__copy">
          <p id="cp-dominate-banner-title" className="cp-dominate-banner__title">
            {POSTER_FOOTER_CTA}
          </p>
          <p className="cp-dominate-banner__sub">{POSTER_FOOTER_COPY}</p>
        </div>
      </div>
    </section>
  );
}
