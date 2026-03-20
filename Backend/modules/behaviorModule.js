/**
 * BehaviorModule — Behavioral pattern analysis
 * Detects claim frequency anomalies, sensor contradictions,
 * and inactivity-motion mismatches.
 *
 * Output: { score: 0–25, logs: Array<{level, msg}> }
 */

// Baseline statistics (from historical genuine user data)
const CLAIM_BASELINE = { mean: 0.8, std: 0.4 };

function zScore(value, mean, std) {
  return Math.abs((value - mean) / std);
}

function scoreBehavior({ motionLevel, claimFrequency, timeSinceMovement, speed }) {
  let score = 0;
  const logs = [];

  // ─── Claim frequency anomaly ───
  const claimZ = zScore(claimFrequency, CLAIM_BASELINE.mean, CLAIM_BASELINE.std);
  if (claimFrequency >= 4) {
    score += 20;
    logs.push({ level: "CRITICAL", msg: `${claimFrequency} claims/24h — extreme outlier (z=${claimZ.toFixed(1)}, p<0.001)` });
  } else if (claimFrequency === 3) {
    score += 13;
    logs.push({ level: "ALERT", msg: `${claimFrequency} claims/24h — exceeds 3σ threshold` });
  } else if (claimFrequency === 2) {
    score += 6;
    logs.push({ level: "WARN", msg: "Elevated claim frequency — above baseline" });
  }

  // ─── Inactivity vs motion mismatch ───
  if (timeSinceMovement > 120 && motionLevel !== "none") {
    score += 8;
    logs.push({ level: "WARN", msg: `${timeSinceMovement}min inactivity contradicts ${motionLevel} motion level` });
  }

  // ─── Accelerometer vs GPS velocity contradiction ───
  if (motionLevel === "none" && speed > 0) {
    score += 7;
    logs.push({ level: "WARN", msg: "Accelerometer idle while non-zero velocity reported — signal mismatch" });
  }

  // ─── Compound behavioral risk ───
  if (claimFrequency > 1 && timeSinceMovement > 60) {
    score += 5;
    logs.push({ level: "WARN", msg: "Repeat claims + extended inactivity — compound behavioral anomaly" });
  }

  score += Math.random() * 2.5;
  return { score: Math.min(25, Math.round(score)), logs };
}

module.exports = { scoreBehavior };
