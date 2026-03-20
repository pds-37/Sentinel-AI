/**
 * FraudController — HTTP layer for /api/analyze
 * Delegates all business logic to FraudAnalysisService.
 * Keeps controller thin: parse → delegate → respond.
 */

const { analyzeClaim } = require("../services/fraudAnalysisService");

async function analyze(req, res) {
  try {
    const result = analyzeClaim(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.message.startsWith("Invalid claim data")) {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error("[FraudController] Unexpected error:", err);
    return res.status(500).json({ success: false, error: "Internal engine error" });
  }
}

module.exports = { analyze };
