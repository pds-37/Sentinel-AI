/**
 * NetworkModule — Device/network signal analysis
 * Detects stable WiFi in adverse conditions, latency anomalies,
 * and network profile inconsistencies with claimed environment.
 *
 * Output: { score: 0–25, logs: Array<{level, msg}> }
 */

// Statistically expected latency ranges by condition
const LATENCY_EXPECTATIONS = {
  storm:  { p95: 350, suspicious: 30 },
  rain:   { p95: 200, suspicious: 40 },
  clear:  { p95: 120, suspicious: 15 },
};

function scoreNetwork({ networkType, latency, weather }) {
  let score = 0;
  const logs = [];
  const expected = LATENCY_EXPECTATIONS[weather] || LATENCY_EXPECTATIONS.clear;

  // ─── WiFi in adverse conditions ───
  if (networkType === "WiFi" && weather === "storm") {
    score += 13;
    logs.push({ level: "ALERT", msg: "Stable WiFi during storm — device is likely indoors; outdoor claim context invalid" });
  } else if (networkType === "WiFi" && weather === "rain") {
    score += 5;
    logs.push({ level: "WARN", msg: "WiFi during rain — possible indoor GPS spoofing environment" });
  }

  // ─── Latency anomaly ───
  if (latency < expected.suspicious) {
    const severity = weather === "storm" ? 12 : 6;
    score += severity;
    logs.push({
      level: severity >= 10 ? "CRITICAL" : "WARN",
      msg: `Latency ${latency}ms anomalously low for ${weather} conditions (expected p95: ${expected.p95}ms)`,
    });
  }

  // ─── Near-perfect WiFi signals spoofed environment ───
  if (latency < 20 && networkType === "WiFi") {
    score += 5;
    logs.push({ level: "WARN", msg: "Near-zero WiFi latency — controlled indoor network environment detected" });
  }

  // ─── Extremely high latency (informational) ───
  if (latency > 900) {
    score += 3;
    logs.push({ level: "INFO", msg: `High latency ${latency}ms — severely degraded connectivity` });
  }

  score += Math.random() * 2.5;
  return { score: Math.min(25, Math.round(score)), logs };
}

module.exports = { scoreNetwork };
