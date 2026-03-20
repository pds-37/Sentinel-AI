/**
 * LocationModule — GPS & velocity signal analysis
 * Detects spoofed/static GPS patterns, unrealistic velocities,
 * and sensor contradictions.
 *
 * Output: { score: 0–25, logs: Array<{level, msg}> }
 */

function scoreLocation({ lat, lng, speed, motionLevel, timeSinceMovement }) {
  let score = 0;
  const logs = [];

  // ─── Bounds validation ───
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    score += 20;
    logs.push({ level: "CRITICAL", msg: `GPS out of bounds: (${lat}, ${lng})` });
  }

  // ─── Static device ───
  if (speed === 0 && timeSinceMovement > 30) {
    score += 10;
    logs.push({ level: "WARN", msg: `Device stationary for ${timeSinceMovement}min — no displacement registered` });
  }

  // ─── Velocity plausibility ───
  if (speed > 200) {
    score += 15;
    logs.push({ level: "CRITICAL", msg: `Velocity ${speed}km/h exceeds physical plausibility` });
  } else if (speed > 130) {
    score += 7;
    logs.push({ level: "WARN", msg: `Speed anomaly: ${speed}km/h flagged` });
  }

  // ─── GPS vs accelerometer contradiction ───
  if (speed > 50 && motionLevel === "none") {
    score += 10;
    logs.push({ level: "WARN", msg: "GPS velocity reported but accelerometer shows zero motion — spoofing indicator" });
  }

  if (speed === 0 && motionLevel === "high") {
    score += 8;
    logs.push({ level: "WARN", msg: "Static GPS contradicts high accelerometer reading — GPS override pattern" });
  }

  // Slight real-world noise
  score += Math.random() * 2.5;

  return { score: Math.min(25, Math.round(score)), logs };
}

module.exports = { scoreLocation };
