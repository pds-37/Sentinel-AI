/**
 * ContextModule — Environmental context cross-validation
 * Cross-validates weather conditions, device behavior,
 * and parametric event triggers for internal consistency.
 *
 * Output: { score: 0–25, logs: Array<{level, msg}> }
 */

function scoreContext({ weather, motionLevel, speed, claimFrequency }) {
  let score = 0;
  const logs = [];

  // ─── Core parametric validation failure ───
  // In parametric insurance, the trigger event (storm, flood) must be verifiable
  if (weather === "storm" && motionLevel === "none" && speed === 0) {
    score += 16;
    logs.push({ level: "CRITICAL", msg: "Zero movement during storm — parametric event trigger cannot be validated" });
  }

  // ─── Clear weather with repeat claims ───
  if (weather === "clear" && claimFrequency > 1) {
    score += 11;
    logs.push({ level: "ALERT", msg: "Multiple claims filed under clear conditions — no adverse event context" });
  }

  // ─── Unsafe speed in adverse conditions ───
  if (weather === "storm" && speed > 100) {
    score += 8;
    logs.push({ level: "WARN", msg: `Speed ${speed}km/h during storm — operationally implausible` });
  }

  // ─── Compound mismatch ───
  if (weather === "rain" && motionLevel === "none" && claimFrequency > 1) {
    score += 6;
    logs.push({ level: "WARN", msg: "Stationary device + rain + repeat claims — triangulated inconsistency" });
  }

  score += Math.random() * 2.5;
  return { score: Math.min(25, Math.round(score)), logs };
}

module.exports = { scoreContext };
