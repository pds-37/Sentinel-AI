import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";

// ═══════════════════════════════════════════════════════════
// FRAUD DETECTION ENGINE  (simulates backend service layer)
// ═══════════════════════════════════════════════════════════

const LocationModule = {
  score(form) {
    let score = 0;
    const logs = [];
    const { lat, lng, speed, motionLevel, timeSinceMovement } = form;

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      score += 20;
      logs.push({ level: "CRITICAL", msg: `GPS coordinates out of valid bounds: (${lat}, ${lng})` });
    }
    if (speed === 0 && timeSinceMovement > 30) {
      score += 10;
      logs.push({ level: "WARN", msg: `Device stationary for ${timeSinceMovement} min — no displacement registered` });
    }
    if (speed > 200) {
      score += 15;
      logs.push({ level: "CRITICAL", msg: `Velocity ${speed} km/h exceeds physical plausibility threshold` });
    } else if (speed > 130) {
      score += 7;
      logs.push({ level: "WARN", msg: `Speed anomaly: ${speed} km/h flagged for review` });
    }
    if (speed > 50 && motionLevel === "none") {
      score += 10;
      logs.push({ level: "WARN", msg: "GPS reports velocity but accelerometer shows zero motion — spoofing indicator" });
    }
    if (speed === 0 && motionLevel === "high") {
      score += 8;
      logs.push({ level: "WARN", msg: "Static GPS contradicts high accelerometer activity — GPS override pattern" });
    }
    score += Math.random() * 2.5;
    return { score: Math.min(25, Math.round(score)), logs };
  },
};

const BehaviorModule = {
  score(form) {
    let score = 0;
    const logs = [];
    const { motionLevel, claimFrequency, timeSinceMovement, speed } = form;

    if (claimFrequency >= 4) {
      score += 20;
      logs.push({ level: "CRITICAL", msg: `${claimFrequency} claims in 24h — extreme outlier (μ=0.8, σ=0.4 for genuine users)` });
    } else if (claimFrequency === 3) {
      score += 13;
      logs.push({ level: "ALERT", msg: `${claimFrequency} claims in 24h — exceeds 3σ threshold` });
    } else if (claimFrequency === 2) {
      score += 6;
      logs.push({ level: "WARN", msg: "Elevated claim frequency — above baseline" });
    }
    if (timeSinceMovement > 120 && motionLevel !== "none") {
      score += 8;
      logs.push({ level: "WARN", msg: `${timeSinceMovement} min inactivity contradicts reported ${motionLevel} motion level` });
    }
    if (motionLevel === "none" && speed > 0) {
      score += 7;
      logs.push({ level: "WARN", msg: "Accelerometer idle while non-zero velocity reported — signal mismatch" });
    }
    if (claimFrequency > 1 && timeSinceMovement > 60) {
      score += 5;
      logs.push({ level: "WARN", msg: "Repeat claims combined with extended inactivity — behavioral anomaly" });
    }
    score += Math.random() * 2.5;
    return { score: Math.min(25, Math.round(score)), logs };
  },
};

const NetworkModule = {
  score(form) {
    let score = 0;
    const logs = [];
    const { networkType, latency, weather } = form;

    if (networkType === "WiFi" && weather === "storm") {
      score += 13;
      logs.push({ level: "ALERT", msg: "Stable WiFi during storm — device likely indoors; claim context invalid" });
    } else if (networkType === "WiFi" && weather === "rain") {
      score += 5;
      logs.push({ level: "WARN", msg: "WiFi during rain — possible indoor GPS spoofing" });
    }
    if (latency < 15 && (weather === "storm" || weather === "rain")) {
      score += 12;
      logs.push({ level: "CRITICAL", msg: `Latency ${latency}ms — statistically impossible under adverse weather (p<0.001)` });
    } else if (latency < 30 && weather === "storm") {
      score += 8;
      logs.push({ level: "ALERT", msg: `Latency ${latency}ms anomalously low for storm environment` });
    }
    if (latency < 20 && networkType === "WiFi") {
      score += 5;
      logs.push({ level: "WARN", msg: "Near-zero WiFi latency — controlled network environment detected" });
    }
    if (latency > 900) {
      score += 3;
      logs.push({ level: "INFO", msg: `High latency ${latency}ms — severely degraded connectivity` });
    }
    score += Math.random() * 2.5;
    return { score: Math.min(25, Math.round(score)), logs };
  },
};

const ContextModule = {
  score(form) {
    let score = 0;
    const logs = [];
    const { weather, motionLevel, speed, claimFrequency } = form;

    if (weather === "storm" && motionLevel === "none" && speed === 0) {
      score += 16;
      logs.push({ level: "CRITICAL", msg: "Zero movement during storm — parametric trigger condition cannot be validated" });
    }
    if (weather === "clear" && claimFrequency > 1) {
      score += 11;
      logs.push({ level: "ALERT", msg: "Multiple claims under clear conditions — no adverse event context exists" });
    }
    if (weather === "storm" && speed > 100) {
      score += 8;
      logs.push({ level: "WARN", msg: `Speed ${speed} km/h in storm conditions — operationally implausible` });
    }
    if (weather === "rain" && motionLevel === "none" && claimFrequency > 1) {
      score += 6;
      logs.push({ level: "WARN", msg: "Stationary device, rain event, repeat claims — triangulated inconsistency" });
    }
    score += Math.random() * 2.5;
    return { score: Math.min(25, Math.round(score)), logs };
  },
};

const DecisionEngine = {
  classify(riskScore) {
    if (riskScore <= 30) return { label: "LOW RISK", decision: "Approved", status: "safe" };
    if (riskScore <= 70) return { label: "MEDIUM RISK", decision: "Verification Required", status: "warn" };
    return { label: "HIGH RISK", decision: "Flagged as Fraud", status: "danger" };
  },
};

const ExplainabilityLayer = {
  buildReasons(breakdown, form) {
    const r = [];
    if (breakdown.location >= 14) r.push("Unrealistically stable GPS pattern detected — static coordinates during claimed event");
    if (form.speed === 0 && form.timeSinceMovement > 60) r.push(`Device has not moved in ${form.timeSinceMovement} minutes — displacement required for valid parametric claim`);
    if (form.speed > 50 && form.motionLevel === "none") r.push("Velocity reported without accelerometer confirmation — GPS spoofing signature");
    if (breakdown.behavior >= 13) r.push(`Abnormal claim frequency: ${form.claimFrequency} claims in 24h far exceeds genuine user baseline`);
    if (form.timeSinceMovement > 120 && form.motionLevel !== "none") r.push("Extended inactivity period contradicts reported motion sensor data");
    if (breakdown.network >= 10) r.push(`Network profile (${form.networkType}, ${form.latency}ms latency) inconsistent with claimed outdoor environment`);
    if (form.weather === "storm" && form.motionLevel === "none") r.push("Zero movement during active storm event — parametric trigger condition cannot be verified");
    if (breakdown.context >= 10) r.push(`Environmental signals (${form.weather}) are contradicted by device behavioral data`);
    if (r.length === 0) r.push("All behavioral signals within acceptable parameters — claim context consistent");
    return r.slice(0, 5);
  },
};

const FraudEngine = {
  analyze(form) {
    const pipeline = [];
    const ts = () => new Date().toISOString().split("T")[1].replace("Z", "");

    pipeline.push({ step: "INIT", level: "INFO", msg: "Pipeline initialized — SentinelAI Fraud Detection Engine v2.4" });
    pipeline.push({ step: "INIT", level: "INFO", msg: `Claim received from (${form.lat.toFixed(4)}, ${form.lng.toFixed(4)})` });
    pipeline.push({ step: "INIT", level: "INFO", msg: `Inputs: speed=${form.speed}km/h motion=${form.motionLevel} net=${form.networkType} latency=${form.latency}ms weather=${form.weather}` });

    const locResult = LocationModule.score(form);
    pipeline.push({ step: "LOC", level: "INFO", msg: "▶ Location module executing" });
    locResult.logs.forEach((l) => pipeline.push({ step: "LOC", ...l }));
    pipeline.push({ step: "LOC", level: "RESULT", msg: `Module score: ${locResult.score} / 25` });

    const behResult = BehaviorModule.score(form);
    pipeline.push({ step: "BEH", level: "INFO", msg: "▶ Behavior module executing" });
    behResult.logs.forEach((l) => pipeline.push({ step: "BEH", ...l }));
    pipeline.push({ step: "BEH", level: "RESULT", msg: `Module score: ${behResult.score} / 25` });

    const netResult = NetworkModule.score(form);
    pipeline.push({ step: "NET", level: "INFO", msg: "▶ Network module executing" });
    netResult.logs.forEach((l) => pipeline.push({ step: "NET", ...l }));
    pipeline.push({ step: "NET", level: "RESULT", msg: `Module score: ${netResult.score} / 25` });

    const ctxResult = ContextModule.score(form);
    pipeline.push({ step: "CTX", level: "INFO", msg: "▶ Context module executing" });
    ctxResult.logs.forEach((l) => pipeline.push({ step: "CTX", ...l }));
    pipeline.push({ step: "CTX", level: "RESULT", msg: `Module score: ${ctxResult.score} / 25` });

    const breakdown = {
      location: locResult.score,
      behavior: behResult.score,
      network: netResult.score,
      context: ctxResult.score,
    };

    const riskScore = Math.min(100, breakdown.location + breakdown.behavior + breakdown.network + breakdown.context);
    const verdict = DecisionEngine.classify(riskScore);
    const reasons = ExplainabilityLayer.buildReasons(breakdown, form);

    pipeline.push({ step: "SCORE", level: "INFO", msg: `Aggregating: ${breakdown.location} + ${breakdown.behavior} + ${breakdown.network} + ${breakdown.context} = ${riskScore}` });
    pipeline.push({
      step: "FINAL",
      level: verdict.status === "danger" ? "CRITICAL" : verdict.status === "warn" ? "ALERT" : "INFO",
      msg: `DECISION → ${verdict.decision.toUpperCase()} (Risk Index: ${riskScore}/100)`,
    });

    return { riskScore, ...verdict, reasons, scoreBreakdown: breakdown, pipeline };
  },
};

// ═══════════════════════════════════════════════════════════
// FORM PRESETS
// ═══════════════════════════════════════════════════════════

const DEFAULT_FORM = {
  lat: 28.6139, lng: 77.209,
  speed: 25, motionLevel: "low",
  networkType: "4G", latency: 120,
  weather: "rain", claimFrequency: 1,
  timeSinceMovement: 15,
};

const GENUINE_PRESET = {
  lat: 28.6139, lng: 77.209,
  speed: 18, motionLevel: "medium",
  networkType: "4G", latency: 110,
  weather: "rain", claimFrequency: 1,
  timeSinceMovement: 6,
};

const FRAUD_PRESET = {
  lat: 28.6139, lng: 77.209,
  speed: 0, motionLevel: "none",
  networkType: "WiFi", latency: 4,
  weather: "storm", claimFrequency: 4,
  timeSinceMovement: 180,
};

// ═══════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════

const C = {
  bg: "#050810",
  surface: "#080c18",
  card: "#0b1020",
  border: "#141e33",
  borderMid: "#1e2d4a",
  text: "#dde4f0",
  textMuted: "#4a5568",
  textSub: "#8599b4",
  accent: "#38bdf8",
  safe: "#22c55e",
  safeBg: "#041a0e",
  safeBorder: "#166534",
  warn: "#f59e0b",
  warnBg: "#1a1100",
  warnBorder: "#92400e",
  danger: "#f43f5e",
  dangerBg: "#1a0008",
  dangerBorder: "#9f1239",
  loc: "#818cf8",
  beh: "#34d399",
  net: "#fb923c",
  ctx: "#f472b6",
  fin: "#facc15",
};

const STATUS = {
  safe:   { text: C.safe,   bg: C.safeBg,   border: C.safeBorder,   bar: "#22c55e" },
  warn:   { text: C.warn,   bg: C.warnBg,   border: C.warnBorder,   bar: "#f59e0b" },
  danger: { text: C.danger, bg: C.dangerBg, border: C.dangerBorder, bar: "#f43f5e" },
};

const STEP_C = { INIT: "#64748b", LOC: C.loc, BEH: C.beh, NET: C.net, CTX: C.ctx, SCORE: "#a78bfa", FINAL: C.fin };
const LEVEL_C = { INFO: "#4a5568", WARN: "#d97706", ALERT: "#ea580c", CRITICAL: "#e11d48", RESULT: "#38bdf8" };

// ═══════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════

function RiskGauge({ score, status }) {
  const col = STATUS[status]?.text || C.textSub;
  const arcLen = Math.PI * 80;
  const filled = (score / 100) * arcLen;
  const angle = Math.PI - (score / 100) * Math.PI;
  const dx = 100 + 80 * Math.cos(angle);
  const dy = 92 - 80 * Math.sin(angle);

  return (
    <svg viewBox="0 0 200 108" width="180" height="108" style={{ flexShrink: 0 }}>
      <path d="M 20 92 A 80 80 0 0 1 180 92" fill="none" stroke="#111827" strokeWidth="12" strokeLinecap="round" />
      <path
        d="M 20 92 A 80 80 0 0 1 180 92"
        fill="none"
        stroke={col}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${arcLen}`}
        style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1), stroke 0.3s" }}
      />
      {score > 2 && (
        <circle cx={dx} cy={dy} r="6" fill={col} style={{ transition: "cx 0.9s, cy 0.9s" }} />
      )}
      <text x="100" y="84" textAnchor="middle" fill={col} fontSize="30" fontWeight="700" fontFamily="monospace"
        style={{ transition: "fill 0.3s" }}>
        {score}
      </text>
      <text x="100" y="104" textAnchor="middle" fill={C.textMuted} fontSize="9" fontFamily="monospace" letterSpacing="2">
        RISK INDEX
      </text>
    </svg>
  );
}

function ScoreBar({ label, score, max, color }) {
  const pct = (score / max) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textSub, letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color }}>
          {score}<span style={{ color: C.textMuted }}>/{max}</span>
        </span>
      </div>
      <div style={{ height: 5, background: "#111827", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  );
}

function PipelineLog({ logs }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  return (
    <div
      ref={ref}
      style={{
        background: "#030508",
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        padding: "10px 12px",
        height: 196,
        overflowY: "auto",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.6,
      }}
    >
      {logs.length === 0 ? (
        <div style={{ color: "#1e293b", textAlign: "center", paddingTop: 72, letterSpacing: "0.1em" }}>
          AWAITING INPUT_
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <span style={{ color: STEP_C[log.step] || C.textMuted, minWidth: 50, flexShrink: 0 }}>
              [{log.step}]
            </span>
            <span style={{ color: LEVEL_C[log.level] || C.textMuted, minWidth: 56, flexShrink: 0 }}>
              {log.level}
            </span>
            <span style={{ color: "#94a3b8" }}>{log.msg}</span>
          </div>
        ))
      )}
    </div>
  );
}

const fieldLabel = { fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", color: C.textMuted, display: "block", marginBottom: 4 };
const input = { background: "#060a14", border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: "7px 10px", width: "100%", fontSize: 12, outline: "none", boxSizing: "border-box" };
const select = { ...input, cursor: "pointer" };

function Field({ label, children }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function SectionHeader({ color, children }) {
  return (
    <div style={{ fontSize: 9, fontFamily: "monospace", color, letterSpacing: "0.14em", borderBottom: `1px solid ${C.border}`, paddingBottom: 6, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Card({ children, statusBorder }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${statusBorder || C.borderMid}`,
      borderRadius: 10,
      padding: 18,
      transition: "border-color 0.4s",
    }}>
      {children}
    </div>
  );
}

function PanelLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 14 }}>
      ◉ {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════

export default function App() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState([]);
  const [showJson, setShowJson] = useState(false);
  const intervalRef = useRef(null);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const runAnalysis = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLoading(true);
    setResult(null);
    setVisibleLogs([]);
    setShowJson(false);

    const parsed = { ...form, lat: Number(form.lat), lng: Number(form.lng) };
    const res = FraudEngine.analyze(parsed);

    let i = 0;
    intervalRef.current = setInterval(() => {
      if (i < res.pipeline.length) {
        setVisibleLogs((prev) => [...prev, res.pipeline[i]]);
        i++;
      } else {
        clearInterval(intervalRef.current);
        setLoading(false);
        setResult(res);
      }
    }, 100);
  };

  const sc = result ? STATUS[result.status] : null;

  const moduleColors = [C.loc, C.beh, C.net, C.ctx];
  const moduleLabels = ["Location", "Behavior", "Network", "Context"];
  const moduleKeys = ["location", "behavior", "network", "context"];

  const chartData = result
    ? moduleKeys.map((k, i) => ({ name: moduleLabels[i], score: result.scoreBreakdown[k] }))
    : [];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui,-apple-system,sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.safe }} />
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.warn }} />
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.danger }} />
          </div>
          <div style={{ width: 1, height: 18, background: C.border }} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.03em" }}>SentinelAI</span>
          <span style={{ color: C.textMuted, fontSize: 13 }}>Parametric Insurance Fraud Detection</span>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: C.textMuted, letterSpacing: "0.1em" }}>
          MULTI-SIGNAL INTELLIGENCE ENGINE v2.4
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,1fr) minmax(360px,1.1fr)", gap: 18, padding: "18px 22px" }}>

        {/* ── LEFT: CLAIM INPUT ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <PanelLabel>CLAIM INPUT INTERFACE</PanelLabel>

            {/* Location Signals */}
            <div style={{ marginBottom: 16 }}>
              <SectionHeader color={C.loc}>LOCATION SIGNALS</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Latitude">
                  <input style={input} type="number" value={form.lat} onChange={(e) => upd("lat", e.target.value)} step="0.0001" />
                </Field>
                <Field label="Longitude">
                  <input style={input} type="number" value={form.lng} onChange={(e) => upd("lng", e.target.value)} step="0.0001" />
                </Field>
                <Field label="Speed (km/h)">
                  <input style={input} type="number" min="0" max="300" value={form.speed} onChange={(e) => upd("speed", Number(e.target.value))} />
                </Field>
                <Field label="Motion Level">
                  <select style={select} value={form.motionLevel} onChange={(e) => upd("motionLevel", e.target.value)}>
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Network Signals */}
            <div style={{ marginBottom: 16 }}>
              <SectionHeader color={C.net}>NETWORK SIGNALS</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Network Type">
                  <select style={select} value={form.networkType} onChange={(e) => upd("networkType", e.target.value)}>
                    <option value="WiFi">WiFi</option>
                    <option value="4G">4G LTE</option>
                    <option value="5G">5G NR</option>
                  </select>
                </Field>
                <Field label="Latency (ms)">
                  <input style={input} type="number" min="1" max="2000" value={form.latency} onChange={(e) => upd("latency", Number(e.target.value))} />
                </Field>
              </div>
            </div>

            {/* Behavioral + Context Signals */}
            <div>
              <SectionHeader color={C.ctx}>BEHAVIORAL + CONTEXT SIGNALS</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Weather Condition">
                  <select style={select} value={form.weather} onChange={(e) => upd("weather", e.target.value)}>
                    <option value="clear">Clear</option>
                    <option value="rain">Rain</option>
                    <option value="storm">Storm</option>
                  </select>
                </Field>
                <Field label="Claims / 24h">
                  <input style={input} type="number" min="0" max="10" value={form.claimFrequency} onChange={(e) => upd("claimFrequency", Number(e.target.value))} />
                </Field>
                <Field label="Since Last Move (min)" style={{ gridColumn: "span 2" }}>
                  <input style={input} type="number" min="0" max="1440" value={form.timeSinceMovement} onChange={(e) => upd("timeSinceMovement", Number(e.target.value))} />
                </Field>
              </div>
            </div>
          </Card>

          {/* Preset + Analyze Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              onClick={() => setForm(GENUINE_PRESET)}
              style={{ background: C.safeBg, border: `1px solid ${C.safeBorder}`, color: C.safe, padding: "9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.08em" }}
            >
              ▶ GENUINE USER
            </button>
            <button
              onClick={() => setForm(FRAUD_PRESET)}
              style={{ background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, color: C.danger, padding: "9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.08em" }}
            >
              ⚠ FRAUD ATTACK
            </button>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            style={{
              background: loading ? "#0f172a" : "#1e40af",
              border: `1px solid ${loading ? C.border : "#3b82f6"}`,
              color: loading ? C.textMuted : "#fff",
              padding: "13px",
              borderRadius: 7,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.1em",
              fontFamily: "monospace",
              transition: "all 0.2s",
            }}
          >
            {loading ? "◌  ANALYZING SIGNALS..." : "⟳  RUN FRAUD ANALYSIS"}
          </button>

          {/* Pipeline Log */}
          <Card>
            <PanelLabel>DECISION PIPELINE LOG</PanelLabel>
            <PipelineLog logs={visibleLogs} />
          </Card>
        </div>

        {/* ── RIGHT: RESULTS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Risk Score Card */}
          <Card statusBorder={sc?.border}>
            <PanelLabel>ANALYSIS OUTPUT</PanelLabel>

            {!result && !loading && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#1e293b", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em" }}>
                NO ACTIVE ANALYSIS — CONFIGURE SIGNALS AND RUN_
              </div>
            )}

            {loading && !result && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ color: C.accent, fontFamily: "monospace", fontSize: 12, marginBottom: 8, letterSpacing: "0.08em" }}>
                  PROCESSING MULTI-SIGNAL DATA
                </div>
                <div style={{ color: C.textMuted, fontSize: 11, fontFamily: "monospace" }}>
                  Location → Behavior → Network → Context
                </div>
              </div>
            )}

            {result && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
                  <RiskGauge score={result.riskScore} status={result.status} />
                  <div>
                    <div style={{ display: "inline-block", background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, padding: "3px 10px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 8 }}>
                      {result.label}
                    </div>
                    <div style={{ color: sc.text, fontSize: 22, fontWeight: 800, lineHeight: 1.1, marginBottom: 5 }}>
                      {result.decision}
                    </div>
                    <div style={{ color: C.textMuted, fontSize: 11, fontFamily: "monospace" }}>
                      {moduleKeys.map((k) => `${moduleLabels[moduleKeys.indexOf(k)].slice(0,3).toUpperCase()}:${result.scoreBreakdown[k]}`).join("  ")}
                    </div>
                  </div>
                </div>

                {/* Score bars */}
                <div style={{ marginTop: 8 }}>
                  {moduleKeys.map((k, i) => (
                    <ScoreBar
                      key={k}
                      label={moduleLabels[i].toUpperCase()}
                      score={result.scoreBreakdown[k]}
                      max={25}
                      color={moduleColors[i]}
                    />
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Score Breakdown Bar Chart */}
          {result && (
            <Card>
              <PanelLabel>MODULE SCORE COMPARISON</PanelLabel>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={chartData} margin={{ top: 4, right: 10, left: -24, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: C.textSub, fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 25]} tick={{ fill: C.textMuted, fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "#0a0e1a" }}
                    contentStyle={{ background: "#0c1020", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: "monospace", fontSize: 11, color: C.text }}
                    formatter={(v) => [`${v} / 25`, "Score"]}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={44}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={moduleColors[i]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Explainability Layer */}
          {result && (
            <Card>
              <PanelLabel>EXPLAINABILITY LAYER</PanelLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.reasons.map((reason, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", background: "#06090f", borderRadius: 5, border: `1px solid ${C.border}` }}>
                    <span style={{ color: sc.text, fontSize: 13, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>→</span>
                    <span style={{ color: "#c8d5e8", fontSize: 12, lineHeight: 1.55 }}>{reason}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* JSON Output Toggle */}
          {result && (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showJson ? 12 : 0 }}>
                <PanelLabel>API RESPONSE PAYLOAD</PanelLabel>
                <button
                  onClick={() => setShowJson((v) => !v)}
                  style={{ background: "none", border: `1px solid ${C.border}`, color: C.textSub, padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.08em" }}
                >
                  {showJson ? "HIDE" : "SHOW"}
                </button>
              </div>
              {showJson && (
                <pre style={{ margin: 0, fontSize: 10, fontFamily: "monospace", color: "#7dd3fc", background: "#030508", borderRadius: 5, padding: 12, overflowX: "auto", lineHeight: 1.6 }}>
                  {JSON.stringify(
                    {
                      riskScore: result.riskScore,
                      label: result.label,
                      decision: result.decision,
                      reasons: result.reasons,
                      scoreBreakdown: result.scoreBreakdown,
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
