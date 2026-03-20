/**
 * SentinelAI Backend — Express Server
 * Parametric Insurance Fraud Detection Engine
 */

const express = require("express");
const cors    = require("cors");
const { analyze } = require("./controllers/fraudController");

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───
app.use(cors({ origin: "http://localhost:5173" })); // Vite dev server
app.use(express.json());

// ─── Request logging (lightweight) ───
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───
app.post("/api/analyze", analyze);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", engine: "SentinelAI v2.4", uptime: process.uptime() });
});

// ─── 404 catch-all ───
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.listen(PORT, () => {
  console.log(`\n  SentinelAI Backend running on http://localhost:${PORT}`);
  console.log(`  POST /api/analyze  — fraud detection endpoint`);
  console.log(`  GET  /api/health   — status check\n`);
});
