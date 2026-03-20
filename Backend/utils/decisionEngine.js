/**
 * DecisionEngine — Maps aggregate risk score to a final verdict.
 *
 * Thresholds derived from historical claim analysis:
 *   0–30   → LOW RISK    — Approve
 *  31–70   → MEDIUM RISK — Human verification required
 *  71–100  → HIGH RISK   — Flag as fraud
 */

const THRESHOLDS = {
  LOW:    { max: 30, label: "LOW RISK",    decision: "Approved",               status: "safe"   },
  MEDIUM: { max: 70, label: "MEDIUM RISK", decision: "Verification Required",  status: "warn"   },
  HIGH:   { max: 100, label: "HIGH RISK",  decision: "Flagged as Fraud",        status: "danger" },
};

function classify(riskScore) {
  if (riskScore <= THRESHOLDS.LOW.max)    return THRESHOLDS.LOW;
  if (riskScore <= THRESHOLDS.MEDIUM.max) return THRESHOLDS.MEDIUM;
  return THRESHOLDS.HIGH;
}

module.exports = { classify, THRESHOLDS };
