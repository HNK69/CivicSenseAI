# 🏛️ CivicSense AI

**Smart Civic Management & Officer Command Portal**

[![React](https://img.shields.io/badge/React-18.3-blue.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.2-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

CivicSense AI is an AI-powered municipal management platform that connects citizen-reported issues to real-time officer action. A single unified backend serves two dedicated frontends — a **Citizen App** for reporting issues and a **Officer Portal** for triaging and resolving them — backed by a local **Gemma** model for all AI reasoning.

---

## ✨ Features

| Module | What it does |
|---|---|
| **🛸 Command Dashboard** | Real-time HUD with live KPIs (pending / in-progress / resolved issues), SVG progress gauges, and a geographic map of active complaints |
| **🤖 AI Root Cause Investigation** | Auto-diagnoses reported issues, assigns a confidence score, and tags severity as Critical / High / Medium / Low |
| **🗺️ Issue Tracking & Map View** | Toggle between list and map views; filter by status/priority; see citizen upvotes and issue timelines |
| **🔄 Duplicate Detection & Merge** | Clusters near-identical reports from the same location and merges them into one ticket, combining upvotes and history |
| **⚡ Smart Priority Ranking** | Ranks issues by urgency using `Priority Score = (Upvotes × 1.5) + (Days Open × Severity Weight)` |
| **📋 Work Assignment & Dispatch** | Routes work orders to the right department (Roads, Water, Sanitation, Electrical, Horticulture) and assigns officers with due dates |
| **📸 Repair Verification** | Before/after photo comparison for officers to approve or reject contractor repair submissions |
| **⭐ Contractor Performance** | Tracks vendor ratings, completed jobs, and complaint counts; lets officers flag underperforming contractors |
| **💬 Municipal AI Copilot** | Natural-language chatbot for quick queries like *"Top unresolved issues this week?"* or *"Which contractor has the most complaints?"* |
| **📡 Real-time Updates** | Socket.IO powers live status pushes to citizens and officers without a page refresh |

---

## 🧠 AI Engine — Powered by Gemma

CivicSense AI runs on **Google's Gemma model**, served locally via **Ollama** inside the `ai-service` microservice — no external API calls, no per-request cost, and full data privacy since citizen reports never leave your infrastructure.

Gemma is the reasoning engine behind all three AI-driven features:

| Feature | How Gemma is used |
|---|---|
| **Root Cause Investigation** | Reads issue description + metadata (location, category, image context) and infers the likely underlying cause of the problem |
| **Severity Tagging** | Classifies each issue into Critical / High / Medium / Low based on risk signals in the report |
| **Municipal Copilot** | Powers the natural-language chat interface, answering officer queries against live issue/contractor data |

**How it fits in:**
```
client-officer / client-user
        │  (REST + Socket.IO)
        ▼
   Node.js Server  ──HTTP──▶  ai-service (FastAPI)
        │                          │
        ▼                          ▼
     MongoDB                Gemma (via Ollama, local inference)
```

The Node server never talks to Gemma directly — all model calls are routed through `ai-service`, which wraps Ollama's local inference API and returns structured JSON (root cause, severity, confidence score, or chat reply) back to the server.

> **Note:** `server/src/services/aiService.js` currently stubs this integration. Point it at the running `ai-service` instance (`AI_SERVICE_URL`) to wire up real Gemma-powered responses.

---

## 🏗️ Project Structure

```
CivicSenseAI/
├── client-user/            # React + Vite citizen-facing app       → :3000
├── client-officer/         # React + Vite officer command portal   → :5173
├── server/                 # Node.js + Express unified API + Socket.IO → :5000
│   └── src/
│       ├── services/
│       │   └── aiService.js   # Bridges to ai-service (Gemma)
│       └── ...
├── ai-service/              # Python FastAPI + Gemma (via Ollama)   → :8000
│   └── app/
└── docs/                   # Architecture & API docs
```

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express, JWT Auth, Socket.IO
- **AI Service:** Python 3.10+, FastAPI, Gemma (local inference via Ollama)
- **Database:** MongoDB (Mongoose)
- **Media Storage:** Cloudinary (via Multer memory storage)

---

## 🚀 Getting Started

This is a **unified backend** — one server on port `5000` serves both frontends.

### 1. Backend Server
```bash
cd server
npm install
cp .env.example .env   # fill in required variables below
npm run dev
```
→ runs at `http://localhost:5000`

**Required environment variables:**
- `MONGO_URI` — your MongoDB connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — random secure strings
- `CLOUDINARY_*` — optional, needed for media uploads
- `AI_SERVICE_URL` — points to the running `ai-service` (e.g. `http://localhost:8000`)

### 2. AI Microservice (Gemma)
```bash
cd ai-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
ollama pull gemma        # first time only — pulls the local model
uvicorn app.main:app --reload --port 8000
```
→ docs at `http://localhost:8000/docs`

### 3. Citizen App (`client-user`)
```bash
cd client-user
npm install
npm run dev
```
→ runs at `http://localhost:3000`, proxies `/api` requests to the backend on `5000`

### 4. Officer Portal (`client-officer`)
```bash
cd client-officer
npm install
npm run dev
```
→ runs at `http://localhost:5173`; Axios `baseURL` should point to `http://localhost:5000/api`

---

## 🔌 How Everything Connects

| App | Runs on | Talks to | API Scope |
|---|---|---|---|
| **client-user** (Citizen) | `:3000` | `http://localhost:5000/api` | `/api/auth/login`, `/api/issues`, `/api/notifications` |
| **client-officer** (Officer) | `:5173` | `http://localhost:5000/api` | `/api/officer/auth/login`, `/api/officer/issues`, `/api/officer/work-orders` |
| **ai-service** (Gemma) | `:8000` | Called by `server` only | Root cause, severity, copilot chat |

The server whitelists CORS for both `:3000` and `:5173`.

### Real-time (Socket.IO)
Both frontends connect their Socket.IO clients to `ws://localhost:5000`:
- Citizens join a personal room — `user:<id>`
- Officers join personal + departmental rooms — `officer:<id>`, `department:<dept>`
- Both can subscribe to a specific issue — `issue:<id>`

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/issues` | GET | Fetch all issues |
| `/api/issues/:id/status` | PATCH | Update issue status |
| `/api/ai/investigations` | GET | Get Gemma-generated root-cause findings |
| `/api/ai/analyze/:issueId` | POST | Trigger a new AI diagnostic scan |
| `/api/duplicates` | GET | Retrieve duplicate issue clusters |
| `/api/duplicates/merge` | POST | Merge duplicate issues |
| `/api/priority` | GET | Get AI-ranked priority list |
| `/api/work-orders` | GET / POST | Fetch or create work orders |
| `/api/repairs` | GET | Fetch repair verification submissions |
| `/api/repairs/:id/verify` | POST | Approve or reject a repair |
| `/api/contractors` | GET | List contractors with ratings |
| `/api/contractors/:id/flag` | POST | Flag/unflag a contractor |
| `/api/copilot/chat` | POST | Query the Gemma-powered AI copilot |

---




## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
