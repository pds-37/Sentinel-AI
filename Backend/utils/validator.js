/**
 * Validator — Sanitizes and validates incoming claim payloads.
 * Returns a strongly-typed parsed object or an error string.
 */

const MOTION_LEVELS  = ["none", "low", "medium", "high"];
const NETWORK_TYPES  = ["WiFi", "4G", "5G"];
const WEATHER_TYPES  = ["clear", "rain", "storm"];

function validateClaim(raw) {
  const errs = [];

  const lat  = parseFloat(raw.lat);
  const lng  = parseFloat(raw.lng);
  const speed            = Number(raw.speed);
  const latency          = Number(raw.latency);
  const claimFrequency   = Number(raw.claimFrequency);
  const timeSinceMovement = Number(raw.timeSinceMovement);

  if (isNaN(lat) || isNaN(lng))        errs.push("lat/lng must be numeric");
  if (isNaN(speed) || speed < 0)       errs.push("speed must be a non-negative number");
  if (isNaN(latency) || latency < 0)   errs.push("latency must be a non-negative number");
  if (isNaN(claimFrequency) || claimFrequency < 0) errs.push("claimFrequency must be non-negative");
  if (isNaN(timeSinceMovement) || timeSinceMovement < 0) errs.push("timeSinceMovement must be non-negative");
  if (!MOTION_LEVELS.includes(raw.motionLevel))  errs.push(`motionLevel must be one of: ${MOTION_LEVELS.join(", ")}`);
  if (!NETWORK_TYPES.includes(raw.networkType))  errs.push(`networkType must be one of: ${NETWORK_TYPES.join(", ")}`);
  if (!WEATHER_TYPES.includes(raw.weather))      errs.push(`weather must be one of: ${WEATHER_TYPES.join(", ")}`);

  if (errs.length > 0) return { error: errs.join("; "), parsed: null };

  return {
    error: null,
    parsed: {
      lat, lng, speed, latency, claimFrequency, timeSinceMovement,
      motionLevel:  raw.motionLevel,
      networkType:  raw.networkType,
      weather:      raw.weather,
    },
  };
}

module.exports = { validateClaim };
