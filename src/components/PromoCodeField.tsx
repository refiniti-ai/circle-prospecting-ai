import { isValidBetaPromoCode, normalizePromoCode } from "../lib/promoCodes";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onApply: (appliedCode: string | null) => void;
  appliedCode: string | null;
  disabled?: boolean;
  className?: string;
};

export function PromoCodeField({ value, onChange, onApply, appliedCode, disabled, className = "" }: Props) {
  function apply() {
    const n = normalizePromoCode(value);
    if (!n) {
      onApply(null);
      return;
    }
    if (isValidBetaPromoCode(n)) {
      onApply(n);
    } else {
      onApply(null);
    }
  }

  return (
    <div className={`buy-promo-field ${className}`.trim()}>
      <label className="cp-form-grid" style={{ maxWidth: 440 }}>
        <span className="muted-label">Promo code (optional)</span>
        <div className="buy-promo-row">
          <input
            type="text"
            className="premium-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            disabled={disabled}
            autoComplete="off"
            placeholder="Enter your promo code"
            aria-describedby="buy-promo-hint"
          />
          <button type="button" className="btn btn-ghost buy-promo-apply" disabled={disabled} onClick={apply}>
            Apply
          </button>
        </div>
      </label>
      <p id="buy-promo-hint" className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
        {appliedCode ? (
          <>
            <strong>{appliedCode}</strong> applied — <strong>$0.50</strong> per home on all products.
          </>
        ) : (
          <>Enter your beta invite code to unlock $0.50/home pricing.</>
        )}
      </p>
    </div>
  );
}
