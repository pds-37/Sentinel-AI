/**
 * ExplainabilityLayer — Generates human-readable fraud signals
 * from module scores and raw claim data.
 *
 * Returns an ordered array of reason strings, prioritized
 * by signal severity and confidence.
 */

function buildReasons(breakdown, form) {
  const reasons = [];

  // Location-based reasons
  if (breakdown.location >= 14) {
    reasons.push("Unrealistically stable GPS pattern — static coordinates during claimed dynamic event");
  }
  if (form.speed === 0 && form.timeSinceMovement > 60) {
    reasons.push(`Device has not moved in ${form.timeSinceMovement} minutes — displacement required for valid parametric claim`);
  }
  if (form.speed > 50 && form.motionLevel === "none") {
    reasons.push("GPS-reported velocity contradicted by accelerometer — GPS spoofing signature detected");
  }

  // Behavior-based reasons
  if (breakdown.behavior >= 13) {
    reasons.push(`Anomalous claim frequency: ${form.claimFrequency} claims in 24h far exceeds genuine user baseline`);
  }
  if (form.timeSinceMovement > 120 && form.motionLevel !== "none") {
    reasons.push("Extended inactivity period contradicts reported motion sensor data");
  }

  // Network-based reasons
  if (breakdown.network >= 10) {
    reasons.push(`Network profile (${form.networkType}, ${form.latency}ms) is inconsistent with claimed outdoor environment`);
  }

  // Context-based reasons
  if (form.weather === "storm" && form.motionLevel === "none") {
    reasons.push("Zero device movement during active storm — parametric trigger condition cannot be independently verified");
  }
  if (breakdown.context >= 10) {
    reasons.push(`Environmental signals (${form.weather}) are contradicted by aggregated device behavioral data`);
  }

  // Fallback for low-risk genuine claims
  if (reasons.length === 0) {
    reasons.push("All behavioral signals within acceptable parameters — claim context is internally consistent");
  }

  return reasons.slice(0, 5); // Cap at 5 top reasons for UI clarity
}

module.exports = { buildReasons };
