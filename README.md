

# 🚀 Sentinel AI

> **Real-time trust. Beyond GPS.**

Sentinel AI is an AI-powered fraud detection engine designed to secure **parametric insurance platforms** against advanced attacks like GPS spoofing—by shifting from **location-based validation → behavior-driven intelligence**.

---

## 🧠 Overview

Traditional systems rely heavily on GPS signals, which are easily spoofed.
**Sentinel AI eliminates this weakness** by analyzing **multi-dimensional signals**—including device behavior, network patterns, and environmental context—to detect fraud in real time.

Instead of asking *“Where is the user?”*, Sentinel asks:
👉 *“Does this behavior make sense?”*

---

## ⚡ Key Features

### 🧩 Multi-Signal Intelligence

Combines:

* GPS & motion sensors
* Network metadata (latency, type)
* Behavioral patterns
* Environmental context (weather, events)

### 🤖 AI-Based Trust Scoring

* Dynamic **risk score (0–100)**
* Hybrid logic: anomaly detection + rule-based intelligence

### 🔍 Explainable Decisions

* Every fraud decision includes **clear human-readable reasons**
* Built using a dedicated explainability layer 

### 🔗 Fraud Ring Detection (Conceptual)

* Detects coordinated attacks via clustering patterns

### ⚖️ Fair & User-Friendly

* No harsh blocking
* Transparent decisions
* Supports verification flow instead of rejection

---

## 🏗️ System Architecture

```
User Mobile App
      ↓
Data Collection Layer
(GPS + Sensors + Network)
      ↓
Validation Layer
      ↓
Fraud Analysis Service
      ↓
 ┌───────────────┬───────────────┬───────────────┬───────────────┐
 |  Location     |  Behavior     |  Network      |  Context      |
 └───────────────┴───────────────┴───────────────┴───────────────┘
      ↓
Risk Score Aggregation
      ↓
Decision Engine
      ↓
Explainability Layer
```

---

## 🧩 How It Works (Deep Dive)

### 1. Input Validation

Incoming claims are sanitized and validated before processing
→ prevents malformed or adversarial input 

---

### 2. Multi-Module Scoring System

Each module independently assigns a score **(0–25)**:

#### 📍 Location Module

* Detects GPS spoofing
* Flags impossible speeds & static patterns 

#### 🚶 Behavior Module

* Detects abnormal claim frequency
* Identifies motion inconsistencies using statistical baselines 

#### 📱 Network Module

* Detects:

  * Suspiciously low latency
  * WiFi usage during storms (indoor fraud signals) 

#### 🌦️ Context Module

* Cross-validates:

  * Weather vs behavior
  * Claim legitimacy in real-world conditions 

---

### 3. Risk Score Aggregation

```
Risk Score = Location + Behavior + Network + Context
```

All signals are combined inside a central orchestrator service
→ ensures modular + scalable architecture 

---

### 4. Decision Engine

| Risk Score | Label       | Decision                 |
| ---------- | ----------- | ------------------------ |
| 0–30       | Low Risk    | ✅ Approved               |
| 31–70      | Medium Risk | ⚠️ Verification Required |
| 71–100     | High Risk   | 🚫 Flagged as Fraud      |

Driven by calibrated thresholds from real-world assumptions 

---

## 📊 Example Output

```json
{
  "riskScore": 82,
  "label": "HIGH RISK",
  "decision": "Flagged as Fraud",
  "reasons": [
    "Unrealistically stable GPS pattern",
    "Anomalous claim frequency",
    "Network inconsistency detected"
  ],
  "scoreBreakdown": {
    "location": 22,
    "behavior": 25,
    "network": 18,
    "context": 17
  }
}
```

---

## 🔐 Why Sentinel AI is Powerful

### 🧠 Behavior > Location

Fraudsters can fake:

* GPS
* Device coordinates

But they **cannot easily fake behavior patterns consistently**

---

### 📊 Multi-Dimensional Defense

| Signal Type | Example Detection |
| ----------- | ----------------- |
| GPS         | Static spoofing   |
| Behavior    | Claim spamming    |
| Network     | Indoor spoofing   |
| Context     | Weather mismatch  |

---

### ⚖️ Trust-Centric UX

* 🟢 Low Risk → Instant payout
* 🟡 Medium Risk → Verification
* 🔴 High Risk → Manual review

👉 No blind rejection = better user trust

---

## 🛠️ Tech Stack

**Frontend**

* React (Vite)
* Tailwind CSS

**Backend**

* Node.js
* Express (REST API) 

**Core Concepts**

* Anomaly Detection
* Statistical Modeling (Z-score)
* Rule-Based AI
* Explainable AI (XAI)

---

## 🚧 Challenges Solved

* ✔ Detecting **realistic GPS spoofing**
* ✔ Reducing **false positives**
* ✔ Designing **real-time scoring pipeline**
* ✔ Building **explainable AI decisions**

---

## 🏆 Achievements

* 🚀 Built a **modular fraud detection engine**
* 🧠 Introduced **behavior-based trust scoring**
* ⚡ Designed **real-time decision pipeline**
* 🔍 Implemented **explainability layer**

---

## 🔮 Future Scope

* Graph Neural Networks for fraud rings
* Real-time API integrations
* Biometric verification (face + liveness)
* Cloud-native microservices deployment

---

## ⚡ Getting Started

```bash
git clone https://github.com/your-username/sentinel-ai.git

cd sentinel-ai

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run backend
cd backend
npm start

# Run frontend
cd ../frontend
npm run dev
```

---

