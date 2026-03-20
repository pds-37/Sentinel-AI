import { useState, useRef, useCallback } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";

// ══════════════════════════════════════════════════════════════════
//  FRAUD DETECTION ENGINE
// ══════════════════════════════════════════════════════════════════

const LocationModule = {
  score({ lat, lng, speed, motionLevel, timeSinceMovement }) {
    let s = 0; const logs = [];
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { s += 20; logs.push({ level: "CRITICAL", msg: `GPS out of valid bounds (${lat}, ${lng})` }); }
    if (speed === 0 && timeSinceMovement > 30) { s += 10; logs.push({ level: "WARN", msg: `Static device ${timeSinceMovement}min — no displacement` }); }
    if (speed > 200) { s += 15; logs.push({ level: "CRITICAL", msg: `Velocity ${speed}km/h exceeds plausibility` }); }
    else if (speed > 130) { s += 7; logs.push({ level: "WARN", msg: `Speed anomaly: ${speed}km/h` }); }
    if (speed > 50 && motionLevel === "none") { s += 10; logs.push({ level: "WARN", msg: "GPS velocity vs zero accelerometer — spoofing signature" }); }
    if (speed === 0 && motionLevel === "high") { s += 8; logs.push({ level: "WARN", msg: "Static GPS contradicts high motion sensor" }); }
    s += Math.random() * 2.5;
    return { score: Math.min(25, Math.round(s)), logs };
  }
};

const BehaviorModule = {
  score({ motionLevel, claimFrequency, timeSinceMovement, speed }) {
    let s = 0; const logs = [];
    if (claimFrequency >= 4) { s += 20; logs.push({ level: "CRITICAL", msg: `${claimFrequency} claims/24h — extreme outlier (baseline μ=0.8)` }); }
    else if (claimFrequency === 3) { s += 13; logs.push({ level: "ALERT", msg: `${claimFrequency} claims/24h — exceeds 3σ` }); }
    else if (claimFrequency === 2) { s += 6; logs.push({ level: "WARN", msg: "Elevated claim frequency above baseline" }); }
    if (timeSinceMovement > 120 && motionLevel !== "none") { s += 8; logs.push({ level: "WARN", msg: `${timeSinceMovement}min inactivity contradicts ${motionLevel} motion` }); }
    if (motionLevel === "none" && speed > 0) { s += 7; logs.push({ level: "WARN", msg: "Accelerometer idle vs non-zero GPS velocity" }); }
    if (claimFrequency > 1 && timeSinceMovement > 60) { s += 5; logs.push({ level: "WARN", msg: "Repeat claims + extended inactivity" }); }
    s += Math.random() * 2.5;
    return { score: Math.min(25, Math.round(s)), logs };
  }
};

const NetworkModule = {
  score({ networkType, latency, weather }) {
    let s = 0; const logs = [];
    if (networkType === "WiFi" && weather === "storm") { s += 13; logs.push({ level: "ALERT", msg: "Home WiFi during storm — device indoors, claim invalid" }); }
    else if (networkType === "WiFi" && weather === "rain") { s += 5; logs.push({ level: "WARN", msg: "WiFi during rain — possible indoor GPS spoofing" }); }
    if (latency < 15 && (weather === "storm" || weather === "rain")) { s += 12; logs.push({ level: "CRITICAL", msg: `Latency ${latency}ms physically impossible under ${weather} (p<0.001)` }); }
    else if (latency < 30 && weather === "storm") { s += 8; logs.push({ level: "ALERT", msg: `Latency ${latency}ms too low for storm conditions` }); }
    if (latency < 20 && networkType === "WiFi") { s += 5; logs.push({ level: "WARN", msg: "Near-zero latency — controlled network environment" }); }
    s += Math.random() * 2.5;
    return { score: Math.min(25, Math.round(s)), logs };
  }
};

const ContextModule = {
  score({ weather, motionLevel, speed, claimFrequency }) {
    let s = 0; const logs = [];
    if (weather === "storm" && motionLevel === "none" && speed === 0) { s += 16; logs.push({ level: "CRITICAL", msg: "Zero movement during storm — parametric trigger unverifiable" }); }
    if (weather === "clear" && claimFrequency > 1) { s += 11; logs.push({ level: "ALERT", msg: "Multiple claims in clear weather — no event context" }); }
    if (weather === "storm" && speed > 100) { s += 8; logs.push({ level: "WARN", msg: `${speed}km/h in storm — operationally implausible` }); }
    if (weather === "rain" && motionLevel === "none" && claimFrequency > 1) { s += 6; logs.push({ level: "WARN", msg: "Stationary + rain + repeat claims — triangulated mismatch" }); }
    s += Math.random() * 2.5;
    return { score: Math.min(25, Math.round(s)), logs };
  }
};

function analyzeSignals(form) {
  const loc = LocationModule.score(form);
  const beh = BehaviorModule.score(form);
  const net = NetworkModule.score(form);
  const ctx = ContextModule.score(form);
  const breakdown = { location: loc.score, behavior: beh.score, network: net.score, context: ctx.score };
  const riskScore = Math.min(100, loc.score + beh.score + net.score + ctx.score);
  const allLogs = [
    ...loc.logs.map(l => ({ ...l, module: "LOC" })),
    ...beh.logs.map(l => ({ ...l, module: "BEH" })),
    ...net.logs.map(l => ({ ...l, module: "NET" })),
    ...ctx.logs.map(l => ({ ...l, module: "CTX" })),
  ];
  let status, label, decision, color;
  if (riskScore <= 30)      { status = "safe";   label = "LOW RISK";    decision = "AUTO APPROVED";  color = "#22c55e"; }
  else if (riskScore <= 70) { status = "warn";   label = "MEDIUM RISK"; decision = "MANUAL REVIEW";  color = "#f59e0b"; }
  else                      { status = "danger"; label = "HIGH RISK";   decision = "FRAUD BLOCKED";  color = "#f43f5e"; }

  const contradictions = [
    { signal: "GPS Location",  claimed: "At event zone",        actual: form.weather === "storm" && form.motionLevel === "none" ? "Indoors (static)" : "Consistent",   match: !(form.weather === "storm" && form.motionLevel === "none") },
    { signal: "Velocity",      claimed: `${form.speed} km/h`,   actual: form.motionLevel === "none" && form.speed > 0 ? "0 km/h (accelerometer)" : "Consistent",      match: !(form.motionLevel === "none" && form.speed > 20) },
    { signal: "Network",       claimed: `${form.networkType}`,  actual: form.networkType === "WiFi" && form.weather === "storm" ? "Home network detected" : "Field OK", match: !(form.networkType === "WiFi" && form.weather === "storm") },
    { signal: "Claim Rate",    claimed: `${form.claimFrequency}x today`, actual: form.claimFrequency > 1 ? "Above baseline (0.8x/day)" : "Normal",                     match: form.claimFrequency <= 1 },
    { signal: "Environment",   claimed: form.weather.toUpperCase(), actual: form.motionLevel === "none" && form.weather === "storm" ? "Cannot verify" : "Consistent",  match: !(form.motionLevel === "none" && form.weather === "storm") },
  ];

  const reasons = allLogs.filter(l => l.level === "CRITICAL" || l.level === "ALERT").map(l => l.msg).slice(0, 4);
  if (reasons.length === 0) reasons.push("All signals consistent — claim context independently verified");
  return { riskScore, status, label, decision, color, breakdown, logs: allLogs, contradictions, reasons };
}

// ══════════════════════════════════════════════════════════════════
//  MOCK CLAIM DATA
// ══════════════════════════════════════════════════════════════════

const INITIAL_QUEUE = [
  { id: "CLM-7741", name: "Ravi Sharma",   lat: 28.6139, lng: 77.209,  speed: 0,  motionLevel: "none",   networkType: "WiFi", latency: 4,   weather: "storm", claimFrequency: 4, timeSinceMovement: 180, amount: 48000 },
  { id: "CLM-7742", name: "Priya Patel",   lat: 19.076,  lng: 72.877,  speed: 22, motionLevel: "medium", networkType: "4G",   latency: 95,  weather: "rain",  claimFrequency: 1, timeSinceMovement: 8,   amount: 32000 },
  { id: "CLM-7743", name: "Arjun Singh",   lat: 12.971,  lng: 77.594,  speed: 0,  motionLevel: "none",   networkType: "WiFi", latency: 6,   weather: "storm", claimFrequency: 3, timeSinceMovement: 240, amount: 55000 },
  { id: "CLM-7744", name: "Sunita Rao",    lat: 17.385,  lng: 78.486,  speed: 35, motionLevel: "low",    networkType: "4G",   latency: 140, weather: "rain",  claimFrequency: 1, timeSinceMovement: 12,  amount: 28000 },
  { id: "CLM-7745", name: "Vikram Nair",   lat: 22.572,  lng: 88.363,  speed: 0,  motionLevel: "none",   networkType: "5G",   latency: 8,   weather: "storm", claimFrequency: 2, timeSinceMovement: 90,  amount: 41000 },
  { id: "CLM-7746", name: "Meera Iyer",    lat: 13.082,  lng: 80.27,   speed: 18, motionLevel: "low",    networkType: "4G",   latency: 110, weather: "rain",  claimFrequency: 1, timeSinceMovement: 5,   amount: 22000 },
];

const TREND_DATA = [
  { day: "Mon", claims: 124, fraud: 18 }, { day: "Tue", claims: 98,  fraud: 11 },
  { day: "Wed", claims: 145, fraud: 27 }, { day: "Thu", claims: 132, fraud: 22 },
  { day: "Fri", claims: 167, fraud: 31 }, { day: "Sat", claims: 89,  fraud: 14 },
  { day: "Sun", claims: 113, fraud: 19 },
];

// ══════════════════════════════════════════════════════════════════
//  TOKENS
// ══════════════════════════════════════════════════════════════════

const C = {
  bg: "#02040a", surface: "#05090f", card: "#070d18", border: "#0d1a2b", borderMid: "#132030",
  text: "#ddeaf8", textSub: "#5a7a9a", textMuted: "#253545",
  accent: "#38bdf8", safe: "#22c55e", warn: "#f59e0b", danger: "#f43f5e",
  loc: "#818cf8", beh: "#34d399", net: "#fb923c", ctx: "#f472b6",
  safeBg: "#021608", warnBg: "#150e00", dangerBg: "#160006",
  safeBd: "#14532d", warnBd: "#78350f", dangerBd: "#881337",
};

// ══════════════════════════════════════════════════════════════════
//  COMPONENTS
// ══════════════════════════════════════════════════════════════════

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, fontFamily: "monospace", color: C.textMuted, letterSpacing: "0.14em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text, fontFamily: "monospace", lineHeight: 1, marginBottom: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textSub }}>{sub}</div>}
    </div>
  );
}

function RiskArc({ score, color }) {
  const r = 46, cx = 60, cy = 58;
  const arc = Math.PI * r;
  const filled = (score / 100) * arc;
  const a = Math.PI - (score / 100) * Math.PI;
  const nx = cx + r * Math.cos(a), ny = cy - r * Math.sin(a);
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#080f1a" strokeWidth="9" strokeLinecap="round"/>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${filled} ${arc}`} style={{ transition: "stroke-dasharray 1s ease, stroke 0.3s" }}/>
      {score > 1 && <circle cx={nx} cy={ny} r="5" fill={color} style={{ transition: "cx 1s, cy 1s" }}/>}
      <text x={cx} y={cy-4} textAnchor="middle" fill={color} fontSize="20" fontWeight="800" fontFamily="monospace">{score}</text>
      <text x={cx} y={cy+9}  textAnchor="middle" fill={C.textMuted} fontSize="6.5" fontFamily="monospace" letterSpacing="1.5">RISK</text>
    </svg>
  );
}

function ModBar({ label, score, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ width: 28, fontSize: 9, fontFamily: "monospace", color: C.textSub, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: "#070d18", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(score/25)*100}%`, background: color, borderRadius: 2, transition: "width 0.9s ease" }}/>
      </div>
      <div style={{ fontSize: 10, fontFamily: "monospace", color, width: 28, textAlign: "right" }}>{score}</div>
    </div>
  );
}

function PipeLog({ logs }) {
  const ref = useRef(null);
  const MC = { LOC: C.loc, BEH: C.beh, NET: C.net, CTX: C.ctx };
  const LC = { INFO: C.textMuted, WARN: "#d97706", ALERT: "#ea580c", CRITICAL: "#e11d48" };
  return (
    <div ref={ref} onLoad={() => { try { if(ref.current) ref.current.scrollTop = ref.current.scrollHeight; } catch(e){} }}
      style={{ height: 150, overflowY: "auto", fontFamily: "monospace", fontSize: 10, lineHeight: 1.75, background: "#020408", borderRadius: 5, padding: "8px 10px", border: `1px solid ${C.border}` }}>
      {logs.length === 0
        ? <div style={{ color: C.textMuted, textAlign: "center", paddingTop: 50, letterSpacing: "0.12em" }}>AWAITING CLAIM_</div>
        : logs.filter(l => l && l.module).map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: MC[l.module]||C.textSub, minWidth: 36 }}>[{l.module}]</span>
              <span style={{ color: LC[l.level]||C.textMuted, minWidth: 56 }}>{l.level}</span>
              <span style={{ color: "#6a9cc0" }}>{l.msg}</span>
            </div>
          ))
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  APP
// ══════════════════════════════════════════════════════════════════

export default function App() {
  const [queue, setQueue]       = useState(INITIAL_QUEUE.map(c => ({ ...c, status: "pending", result: null })));
  const [selected, setSelected] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [logs, setLogs]         = useState([]);
  const [tab, setTab]           = useState("queue");
  const [stats, setStats]       = useState({ total: 847, fraud: 143, saved: 6840000 });
  const [custom, setCustom]     = useState({
    name: "Test Claim", lat: 28.6139, lng: 77.209, speed: 0, motionLevel: "none",
    networkType: "WiFi", latency: 4, weather: "storm", claimFrequency: 4, timeSinceMovement: 180, amount: 50000,
  });
  const iRef = useRef(null);

  const runAnalysis = useCallback(async (claim) => {
  if (analyzing) return;

  setAnalyzing(true);
  setLogs([]);
  setSelected({ ...claim, result: null, analyzing: true });

  try {
    const res = await fetch("https://sentinel-ai-ajow.onrender.com/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        lat: claim.lat,
        lng: claim.lng,
        speed: claim.speed,
        latency: claim.latency,
        claimFrequency: claim.claimFrequency,
        timeSinceMovement: claim.timeSinceMovement,
        motionLevel: claim.motionLevel,
        networkType: claim.networkType,
        weather: claim.weather
      })
    });

    const data = await res.json();
    console.log("🔥 BACKEND RESPONSE:", data);

    if (!data.success) throw new Error(data.error);

    const backendResult = data.data;

    // 🔥 FIXED MAPPING (IMPORTANT)
    const result = {
      ...backendResult,
      breakdown: backendResult.scoreBreakdown,
      logs: backendResult.pipeline,
      contradictions: [] // fallback
    };

    let i = 0;
    if (iRef.current) clearInterval(iRef.current);

    iRef.current = setInterval(() => {
      if (i < result.logs.length) {
        const log = result.logs[i];
        if (log) setLogs(prev => [...prev, log]);
        i++;
      } else {
        clearInterval(iRef.current);
        setAnalyzing(false);

        setSelected({ ...claim, result, analyzing: false });

        setQueue(prev =>
          prev.map(c =>
            c.id === claim.id
              ? { ...c, status: result.status, result }
              : c
          )
        );

        setStats(prev => ({
          total: prev.total + 1,
          fraud: result.status === "danger" ? prev.fraud + 1 : prev.fraud,
          saved:
            result.status === "danger"
              ? prev.saved + claim.amount
              : prev.saved
        }));
      }
    }, 120);

  } catch (err) {
    console.error("❌ API ERROR:", err);
    setAnalyzing(false);
  }
}, [analyzing]);

  const submitCustom = () => {
    const nc = { ...custom, id: `CLM-${7750+Math.floor(Math.random()*100)}`, status: "pending", result: null };
    setQueue(p => [nc, ...p]);
    setTab("queue");
    setTimeout(() => runAnalysis(nc), 100);
  };

  const upd = (k, v) => setCustom(f => ({ ...f, [k]: v }));

  const sC = { pending: C.textMuted, safe: C.safe, warn: C.warn, danger: C.danger };
  const sL = { pending: "PENDING", safe: "APPROVED", warn: "REVIEW",  danger: "BLOCKED" };
  const sBg = { pending: C.card, safe: C.safeBg, warn: C.warnBg, danger: C.dangerBg };
  const sBd = { pending: C.border, safe: C.safeBd, warn: C.warnBd, danger: C.dangerBd };

  const inp = { background: "#030609", border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "6px 8px", width: "100%", fontSize: 11, fontFamily: "monospace", outline: "none", boxSizing: "border-box", marginBottom: 0 };
  const sel = { ...inp, cursor: "pointer" };
  const res = selected?.result;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui,-apple-system,sans-serif", fontSize: 13, display: "flex", flexDirection: "column" }}>

      {/* ── TOPBAR ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex", alignItems: "center", height: 46, gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 5, background: "#081828", border: `1px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.accent }}/>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>SentinelAI</span>
          <span style={{ color: C.textMuted, fontSize: 11 }}>/ Fraud Operations Center</span>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: "flex", gap: 16, fontSize: 10, fontFamily: "monospace" }}>
          <span style={{ color: C.safe }}>● LIVE</span>
          <span style={{ color: C.textMuted }}>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* ── KPI BAR ── */}
      <div style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <KpiCard label="CLAIMS TODAY"    value={stats.total.toLocaleString()} sub="↑12% vs yesterday" />
        <KpiCard label="FRAUD BLOCKED"   value={stats.fraud} sub={`${((stats.fraud/stats.total)*100).toFixed(1)}% fraud rate`} color={C.danger} />
        <KpiCard label="AMOUNT SAVED"    value={`₹${(stats.saved/100000).toFixed(1)}L`} sub="Total fraud prevented" color={C.safe} />
        <KpiCard label="AUTO APPROVED"   value={stats.total - stats.fraud - 89} sub="No human review needed" color={C.accent} />
        <KpiCard label="QUEUE PENDING"   value={queue.filter(c=>c.status==="pending").length} sub="Awaiting analysis" color={C.warn} />
      </div>

      {/* ── MAIN 3-COLUMN ── */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 300px", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* ─── LEFT: QUEUE ─── */}
        <div style={{ borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            {["queue","custom"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "9px 0", fontSize: 9, fontFamily: "monospace", letterSpacing: "0.12em",
                background: tab===t ? "#08111e" : "transparent", border: "none",
                borderBottom: tab===t ? `2px solid ${C.accent}` : "2px solid transparent",
                color: tab===t ? C.accent : C.textMuted, cursor: "pointer",
              }}>
                {t === "queue" ? "CLAIM QUEUE" : "+ INJECT CLAIM"}
              </button>
            ))}
          </div>

          {tab === "queue" ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {queue.map(claim => (
                <div key={claim.id} onClick={() => !analyzing && runAnalysis(claim)}
                  style={{ padding: "11px 13px", borderBottom: `1px solid ${C.border}`, cursor: analyzing ? "not-allowed" : "pointer",
                    background: selected?.id===claim.id ? "#080f1c" : "transparent",
                    borderLeft: selected?.id===claim.id ? `3px solid ${C.accent}` : "3px solid transparent", transition: "background 0.1s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: C.accent }}>{claim.id}</span>
                    <span style={{ fontSize: 8, fontFamily: "monospace", letterSpacing: "0.1em", padding: "2px 5px", borderRadius: 2,
                      background: sBg[claim.status], border: `1px solid ${sBd[claim.status]}`, color: sC[claim.status] }}>
                      {sL[claim.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{claim.name}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textSub }}>
                    <span>{claim.weather.toUpperCase()} · {claim.networkType}</span>
                    <span style={{ fontFamily: "monospace", color: claim.result ? sC[claim.status] : C.textMuted }}>
                      {claim.result ? `${claim.result.riskScore}/100` : `₹${(claim.amount/1000).toFixed(0)}K`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {[
                ["CLAIMANT NAME", <input style={inp} value={custom.name} onChange={e=>upd("name",e.target.value)}/>],
                ["LATITUDE",      <input style={inp} type="number" value={custom.lat} onChange={e=>upd("lat",Number(e.target.value))}/>],
                ["LONGITUDE",     <input style={inp} type="number" value={custom.lng} onChange={e=>upd("lng",Number(e.target.value))}/>],
                ["SPEED KM/H",    <input style={inp} type="number" value={custom.speed} onChange={e=>upd("speed",Number(e.target.value))}/>],
                ["MOTION LEVEL",  <select style={sel} value={custom.motionLevel} onChange={e=>upd("motionLevel",e.target.value)}>
                  {["none","low","medium","high"].map(v=><option key={v} value={v}>{v}</option>)}</select>],
                ["NETWORK TYPE",  <select style={sel} value={custom.networkType} onChange={e=>upd("networkType",e.target.value)}>
                  {["WiFi","4G","5G"].map(v=><option key={v} value={v}>{v}</option>)}</select>],
                ["LATENCY MS",    <input style={inp} type="number" value={custom.latency} onChange={e=>upd("latency",Number(e.target.value))}/>],
                ["WEATHER",       <select style={sel} value={custom.weather} onChange={e=>upd("weather",e.target.value)}>
                  {["clear","rain","storm"].map(v=><option key={v} value={v}>{v}</option>)}</select>],
                ["CLAIMS / 24H",  <input style={inp} type="number" value={custom.claimFrequency} onChange={e=>upd("claimFrequency",Number(e.target.value))}/>],
                ["INACTIVE MIN",  <input style={inp} type="number" value={custom.timeSinceMovement} onChange={e=>upd("timeSinceMovement",Number(e.target.value))}/>],
                ["CLAIM AMT ₹",   <input style={inp} type="number" value={custom.amount} onChange={e=>upd("amount",Number(e.target.value))}/>],
              ].map(([label, field]) => (
                <div key={label} style={{ marginBottom: 9 }}>
                  <div style={{ fontSize: 8, fontFamily: "monospace", color: C.textMuted, letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
                  {field}
                </div>
              ))}
              <button onClick={submitCustom} style={{ width: "100%", padding: 9, marginTop: 4, background: "#071525",
                border: `1px solid ${C.accent}`, borderRadius: 5, color: C.accent, fontSize: 10, fontFamily: "monospace",
                letterSpacing: "0.12em", cursor: "pointer" }}>
                ⟳ SUBMIT & ANALYZE
              </button>
            </div>
          )}
        </div>

        {/* ─── CENTER: ANALYSIS ─── */}
        <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              color: C.textMuted, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${C.textMuted}` }}/>
              </div>
              SELECT A CLAIM FROM THE QUEUE TO BEGIN ANALYSIS
            </div>
          ) : (
            <>
              {/* Claim header */}
              <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 9, padding: "14px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 9, fontFamily: "monospace", color: C.textMuted, letterSpacing: "0.12em", marginBottom: 5 }}>ACTIVE CLAIM</div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 3 }}>{selected.name}</div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: C.textSub }}>
                    {selected.id} · ({Number(selected.lat).toFixed(4)}, {Number(selected.lng).toFixed(4)}) · ₹{Number(selected.amount).toLocaleString()}
                  </div>
                </div>
                {res
                  ? <div><RiskArc score={res.riskScore} color={res.color}/></div>
                  : <div style={{ fontSize: 10, fontFamily: "monospace", color: C.accent, letterSpacing: "0.08em" }}>◌ ANALYZING...</div>
                }
              </div>

              {/* ★ SIGNAL CONTRADICTION MATRIX */}
              {res && (
                <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 9, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em" }}>
                    ◉ SIGNAL CONTRADICTION MATRIX — GPS CLAIM vs PHYSICAL REALITY
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#04080f" }}>
                        {["SIGNAL", "GPS CLAIMS", "SENSORS SAY", "STATUS"].map(h => (
                          <th key={h} style={{ padding: "7px 12px", fontSize: 8, fontFamily: "monospace", color: C.textMuted,
                            letterSpacing: "0.12em", textAlign: "left", borderBottom: `1px solid ${C.border}`, fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {res.contradictions.map((row, i) => (
                        <tr key={i} style={{ background: i%2===0 ? "#040810" : "transparent" }}>
                          <td style={{ padding: "9px 12px", fontSize: 11, fontFamily: "monospace", color: C.textSub, borderBottom: `1px solid ${C.border}` }}>{row.signal}</td>
                          <td style={{ padding: "9px 12px", fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{row.claimed}</td>
                          <td style={{ padding: "9px 12px", fontSize: 11, color: row.match ? C.safe : C.danger, borderBottom: `1px solid ${C.border}` }}>{row.actual}</td>
                          <td style={{ padding: "7px 12px", borderBottom: `1px solid ${C.border}` }}>
                            <span style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 3,
                              background: row.match ? C.safeBg : C.dangerBg, border: `1px solid ${row.match ? C.safeBd : C.dangerBd}`,
                              color: row.match ? C.safe : C.danger }}>
                              {row.match ? "✓ MATCH" : "✗ MISMATCH"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Scores + Decision */}
              {res && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 9, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 12 }}>◉ MODULE SCORES</div>
                    <ModBar label="LOC" score={res.breakdown.location} color={C.loc}/>
                    <ModBar label="BEH" score={res.breakdown.behavior} color={C.beh}/>
                    <ModBar label="NET" score={res.breakdown.network}  color={C.net}/>
                    <ModBar label="CTX" score={res.breakdown.context}  color={C.ctx}/>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace" }}>
                      <span style={{ color: C.textSub }}>TOTAL</span>
                      <span style={{ color: res.color, fontWeight: 700 }}>{res.riskScore} / 100</span>
                    </div>
                  </div>
                  <div style={{ background: res.status==="danger"?C.dangerBg:res.status==="warn"?C.warnBg:C.safeBg,
                    border: `1px solid ${res.status==="danger"?C.dangerBd:res.status==="warn"?C.warnBd:C.safeBd}`,
                    borderRadius: 9, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: C.textMuted, letterSpacing: "0.14em", marginBottom: 8 }}>◉ DECISION</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: res.color, marginBottom: 4 }}>{res.decision}</div>
                    <div style={{ fontSize: 10, color: C.textSub, marginBottom: 14 }}>{res.label} · {res.riskScore}/100</div>
                    <div style={{ fontSize: 9, color: C.textMuted, fontFamily: "monospace", marginBottom: 4 }}>CLAIM AMOUNT</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: res.status==="danger" ? C.safe : C.text }}>
                      ₹{Number(selected.amount).toLocaleString()}
                      {res.status==="danger" && <span style={{ fontSize: 9, color: C.safe, marginLeft: 8, fontFamily: "monospace" }}>PROTECTED</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Why this decision */}
              {res && res.reasons.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 9, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 10 }}>◉ EXPLAINABILITY — WHY THIS DECISION</div>
                  {res.reasons.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 9, marginBottom: 7, padding: "7px 10px", background: "#040810", borderRadius: 4, border: `1px solid ${C.border}` }}>
                      <span style={{ color: res.color, flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 11, color: "#b8d0e8", lineHeight: 1.55 }}>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pipeline */}
              <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 9, padding: "12px 14px" }}>
                <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 10 }}>◉ DECISION PIPELINE LOG</div>
                <PipeLog logs={logs}/>
              </div>
            </>
          )}
        </div>

        {/* ─── RIGHT: ANALYTICS ─── */}
        <div style={{ borderLeft: `1px solid ${C.border}`, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Queue summary */}
          <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 8, padding: "12px 13px" }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 12 }}>TODAY'S QUEUE</div>
            {[
              { label: "Auto Approved", count: queue.filter(c=>c.status==="safe").length + 312, color: C.safe },
              { label: "Manual Review", count: queue.filter(c=>c.status==="warn").length + 89,  color: C.warn },
              { label: "Fraud Blocked", count: queue.filter(c=>c.status==="danger").length + 143, color: C.danger },
              { label: "Pending",       count: queue.filter(c=>c.status==="pending").length,    color: C.textSub },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }}/>
                  <span style={{ fontSize: 11, color: C.textSub }}>{label}</span>
                </div>
                <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color }}>{count}</span>
              </div>
            ))}
          </div>

          {/* 7-day trend */}
          <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 8, padding: "12px 13px" }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 10 }}>7-DAY FRAUD TREND</div>
            <div style={{ width: "100%", height: 100, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={TREND_DATA} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="day" tick={{ fill: C.textMuted, fontSize: 8, fontFamily: "monospace" }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fill: C.textMuted, fontSize: 8, fontFamily: "monospace" }} tickLine={false} axisLine={false}/>
                  <Line type="monotone" dataKey="fraud"  stroke={C.danger} strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="claims" stroke={C.accent} strokeWidth={1.5} dot={false} strokeDasharray="4 4" opacity={0.5}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              {[["FRAUD", C.danger],["CLAIMS", C.accent]].map(([l,c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 8, fontFamily: "monospace", color: C.textMuted }}>
                  <div style={{ width: 12, height: 2, background: c }}/> {l}
                </div>
              ))}
            </div>
          </div>

          {/* Top fraud signals */}
          <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 8, padding: "12px 13px" }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 10 }}>TOP FRAUD SIGNALS</div>
            {[
              { label: "WiFi during storm",      pct: 47 },
              { label: "Zero motion + claim",    pct: 38 },
              { label: "Claim freq > 3/day",     pct: 29 },
              { label: "Low latency outdoors",   pct: 27 },
              { label: "GPS vs accel mismatch",  pct: 20 },
            ].map(({ label, pct }) => (
              <div key={label} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10 }}>
                  <span style={{ color: C.textSub }}>{label}</span>
                  <span style={{ fontFamily: "monospace", color: C.danger, fontSize: 10 }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: C.danger, borderRadius: 2, opacity: 0.65 }}/>
                </div>
              </div>
            ))}
          </div>

          {/* Thresholds reference */}
          <div style={{ background: C.card, border: `1px solid ${C.borderMid}`, borderRadius: 8, padding: "12px 13px" }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 10 }}>DECISION THRESHOLDS</div>
            {[
              { range: "0 – 30",  label: "Auto Approve", color: C.safe },
              { range: "31 – 70", label: "Manual Review", color: C.warn },
              { range: "71 – 100",label: "Block + Flag",  color: C.danger },
            ].map(({ range, label, color }) => (
              <div key={range} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: color }}/>
                  <span style={{ fontSize: 11, color: C.textSub }}>{label}</span>
                </div>
                <span style={{ fontSize: 10, fontFamily: "monospace", color }}>{range}</span>
              </div>
            ))}
          </div>

          {/* What we actually solve */}
          <div style={{ background: "#04080e", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 13px" }}>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: C.accent, letterSpacing: "0.14em", marginBottom: 10 }}>HOW IT WORKS</div>
            <div style={{ fontSize: 10, color: C.textSub, lineHeight: 1.7 }}>
              GPS alone is easy to spoof with a ₹300 app. We cross-check <span style={{ color: C.text }}>5 independent signals</span> — location, motion, network, latency, and context — that are physically impossible to fake simultaneously.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}