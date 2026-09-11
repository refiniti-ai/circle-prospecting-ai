type Props = { id?: string; children: string };

/** PDF-style section title with green horizontal rules. */
export function FlyerSectionHeading({ id, children }: Props) {
  return (
    <div className="cp-flyer-section-head">
      <span className="cp-flyer-section-head__rule" aria-hidden />
      <h2 id={id} className="cp-flyer-section-head__title">
        {children}
      </h2>
      <span className="cp-flyer-section-head__rule" aria-hidden />
    </div>
  );
}
