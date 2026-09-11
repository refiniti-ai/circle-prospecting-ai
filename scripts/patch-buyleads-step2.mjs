import fs from "node:fs";

const path = "src/pages/BuyLeads.tsx";
let s = fs.readFileSync(path, "utf8");

const startMarker = '<h2 className="premium-h2" style={{ marginBottom: "0.5rem" }}>Step 2: Promotion plan';
const endMarker = '<section className="section-surface buy-card buy-card--summary"';

const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  console.error("markers not found", { start, end });
  process.exit(1);
}

const replacement = `              <h2 className="premium-h2" style={{ marginBottom: "0.5rem" }}>Step 2: Homes to call — then your service</h2>
              <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.92rem", maxWidth: 640 }}>
                First choose <strong>how many homeowners</strong> we reach around your listing. Your plan band and per-home rate update automatically. Then pick the{" "}
                <strong>product</strong> (AI outreach, live callers, hybrid, or data only).
              </p>

              <div className="buy-step2-block">
                <h3 className="buy-step2-subhead">1 · How many homes should we call?</h3>
                <div className="buy-pack-grid buy-home-presets" role="group" aria-label="Homeowner count presets">
                  {HOME_COUNT_PRESETS.map((n) => {
                    const active = requestedLeads === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        className={\`buy-pack-card\${active ? " is-active" : ""}\`}
                        aria-pressed={active}
                        onClick={() => applyHomeCount(n)}
                      >
                        <span className="buy-pack-name">{n.toLocaleString()}</span>
                        <span className="buy-pack-unit">homeowners</span>
                      </button>
                    );
                  })}
                  {estimatedAvailable > 0 ? (
                    <button
                      type="button"
                      className={\`buy-pack-card\${requestedLeads === estimatedAvailable ? " is-active" : ""}\`}
                      aria-pressed={requestedLeads === estimatedAvailable}
                      onClick={() => applyHomeCount(estimatedAvailable)}
                    >
                      <span className="buy-pack-name">Max</span>
                      <span className="buy-pack-unit">{formatHomeownersMatchedDisplay(estimatedAvailable)} matched</span>
                    </button>
                  ) : null}
                </motion>

                <label className="cp-form-grid buy-home-exact" style={{ maxWidth: 360, marginTop: "1rem" }}>
                  <span className="muted-label">Exact count (updates plan automatically)</span>
                  <input
                    type="number"
                    className="premium-input"
                    min={1}
                    max={homesCap}
                    value={requestedLeads}
                    onChange={(e) => applyHomeCount(Number.parseInt(e.target.value || "1", 10))}
                  />
                </label>
                <label className="buy-home-slider">
                  <span className="muted-label">
                    Slide to adjust · <strong>{requestedLeads.toLocaleString()}</strong> homes
                  </span>
                  <input
                    type="range"
                    className="buy-home-range"
                    min={1}
                    max={homesCap}
                    value={Math.min(requestedLeads, homesCap)}
                    onChange={(e) => applyHomeCount(Number.parseInt(e.target.value, 10))}
                  />
                </label>
                <p className="buy-tier-auto muted" style={{ marginTop: "0.65rem", fontSize: "0.88rem" }}>
                  Auto plan: <strong>{selectedTierMeta.packageLabel}</strong> ({selectedTierBandLabel} homes) ·{" "}
                  <strong>{formatMoneyUsd(pricePerLeadUsd(serviceLine, selectedTier))}</strong> per home with{" "}
                  <strong>{serviceLineLabel(serviceLine)}</strong> →{" "}
                  <strong className="gradient-text">{formatMoneyUsd(checkoutTotalCents / 100)}</strong> estimated total
                </p>
              </div>

              <div className="buy-step2-block" style={{ marginTop: "1.35rem" }}>
                <h3 className="buy-step2-subhead">2 · Which product should we run?</h3>
                <div className="buy-pack-grid buy-service-pick" role="radiogroup" aria-label="Service product">
                  {LEAD_SERVICE_LINES.map((line) => {
                    const active = serviceLine === line.id;
                    const perHome = pricePerLeadUsd(line.id, selectedTier);
                    const totalUsd = totalCentsForSelection(line.id, selectedTier, requestedLeads) / 100;
                    return (
                      <button
                        key={line.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={\`buy-pack-card buy-service-card\${active ? " is-active" : ""}\`}
                        style={
                          active
                            ? { borderColor: line.headerBg, boxShadow: \`0 8px 28px \${line.rowAlt}\` }
                            : undefined
                        }
                        onClick={() => setServiceLine(line.id)}
                      >
                        <span className="buy-pack-name" style={{ color: line.headerBg }}>
                          {line.label}
                        </span>
                        <span className="buy-pack-price">{formatMoneyUsd(perHome)}</span>
                        <span className="buy-pack-unit">per homeowner</span>
                        <span className="buy-pack-save">Est. {formatMoneyUsd(totalUsd)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {checkoutTotalCents < 50 && (
                <p className="cp-alert cp-alert--warn" style={{ marginTop: "0.85rem" }} role="status">
                  Card checkout requires at least <strong>{formatMoneyUsd(0.5)}</strong>. Increase homes to{" "}
                  <strong>{stripeMinLeads.toLocaleString()}</strong> or more at this rate.
                </p>
              )}
            </section>

            `;

const clean = replacement.replace("                </motion>", "                </div>");

s = s.slice(0, start) + clean + s.slice(end);
fs.writeFileSync(path, s);
console.log("patched ok");
