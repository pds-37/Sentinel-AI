/**
 * FraudAnalysisService — Orchestrates all detection modules
 * and produces the final explainable fraud assessment.
 *
 * Architecture:
 *   Input → [Location | Behavior | Network | Context] → Decision Engine → Explainability
 */

// ✅ FIXED IMPORT PATHS
const { scoreLocation } = require("../modules/locationModule");
const { scoreBehavior } = require("../modules/behaviorModule");
const { scoreNetwork }  = require("../modules/networkModule");
const { scoreContext }  = require("../modules/contextModule");

const { buildReasons }  = require("../utils/explainability");
const { classify }      = require("../utils/decisionEngine");
const { validateClaim } = require("../utils/validator");

/**
 * @param {Object} claim - Raw claim input from request body
 * @returns {Object} Full fraud assessment with score, decision, reasons, pipeline
 */
function analyzeClaim(claim) {
  // ─── Step 1: Validate input ───
  const { error, parsed } = validateClaim(claim);
  if (error) throw new Error(`Invalid claim data: ${error}`);

  const pipeline = [];

  pipeline.push({
    step: "INIT",
    level: "INFO",
    msg: "SentinelAI pipeline initialized v2.4",
  });

  pipeline.push({
    step: "INIT",
    level: "INFO",
    msg: `Claim received from (${parsed.lat}, ${parsed.lng})`,
  });

  // ─── Step 2: Run detection modules ───

  const locResult = scoreLocation(parsed);
  pipeline.push({ step: "LOC", level: "INFO", msg: `Location: ${locResult.score}/25` });
  locResult.logs.forEach(log => pipeline.push({ step: "LOC", ...log }));

  const behResult = scoreBehavior(parsed);
  pipeline.push({ step: "BEH", level: "INFO", msg: `Behavior: ${behResult.score}/25` });
  behResult.logs.forEach(log => pipeline.push({ step: "BEH", ...log }));

  const netResult = scoreNetwork(parsed);
  pipeline.push({ step: "NET", level: "INFO", msg: `Network: ${netResult.score}/25` });
  netResult.logs.forEach(log => pipeline.push({ step: "NET", ...log }));

  const ctxResult = scoreContext(parsed);
  pipeline.push({ step: "CTX", level: "INFO", msg: `Context: ${ctxResult.score}/25` });
  ctxResult.logs.forEach(log => pipeline.push({ step: "CTX", ...log }));

  // ─── Step 3: Aggregate risk score ───

  const scoreBreakdown = {
    location: locResult.score,
    behavior: behResult.score,
    network: netResult.score,
    context: ctxResult.score,
  };

  const riskScore = Math.min(
    100,
    scoreBreakdown.location +
    scoreBreakdown.behavior +
    scoreBreakdown.network +
    scoreBreakdown.context
  );

  // ─── Step 4: Decision Engine ───

  const { label, decision, status } = classify(riskScore);

  pipeline.push({
    step: "FINAL",
    level:
      status === "danger"
        ? "CRITICAL"
        : status === "warn"
        ? "ALERT"
        : "INFO",
    msg: `DECISION → ${decision} (Risk: ${riskScore}/100)`,
  });

  // ─── Step 5: Explainability ───

  const reasons = buildReasons(scoreBreakdown, parsed);

  // ─── Final Response ───

  return {
    riskScore,
    label,
    decision,
    status,
    reasons,
    scoreBreakdown,
    pipeline,
  };
}

module.exports = { analyzeClaim };