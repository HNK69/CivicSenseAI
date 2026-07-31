# 🏛️ CivicSense AI

*Smart Civic Management & Officer Command Portal*

[![React](https://img.shields.io/badge/React-18.3-blue.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.2-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

CivicSense AI is an AI-powered municipal management platform that connects citizen-reported issues to real-time officer action. It combines geospatial tracking, automated root-cause analysis, smart prioritization, and a conversational AI copilot into a single command-center dashboard.

---

## ✨ Features

| Module | What it does |
|---|---|
| *🛸 Command Dashboard* | Real-time HUD with live KPIs (pending / in-progress / resolved issues), SVG progress gauges, and a geographic map of active complaints |
| *🤖 AI Root Cause Investigation* | Auto-diagnoses reported issues, assigns a confidence score, and tags severity as Critical / High / Medium / Low |
| *🗺️ Issue Tracking & Map View* | Toggle between list and map views; filter by status/priority; see citizen upvotes and issue timelines |
| *🔄 Duplicate Detection & Merge* | Clusters near-identical reports from the same location and merges them into one ticket, combining upvotes and history |
| *⚡ Smart Priority Ranking* | Ranks issues by urgency using Priority Score = (Upvotes × 1.5) + (Days Open × Severity Weight) |
| *📋 Work Assignment & Dispatch* | Routes work orders to the right department (Roads, Water, Sanitation, Electrical, Horticulture) and assigns officers with due dates |
| *📸 Repair Verification* | Before/after photo comparison for officers to approve or reject contractor repair submissions |
| *⭐ Contractor Performance* | Tracks vendor ratings, completed jobs, and complaint counts; lets officers flag underperforming contractors |
| *💬 Municipal AI Copilot* | Natural-language chatbot for quick queries like "Top unresolved issues this week?" or "Which contractor has the most complaints?" |

---

## 🏗️ Project Structure


CivicSenseAI/
├── client-officer/        # React + Vite officer dashboard
│   └── src/
│       ├── components/    # Layout, Navbar, Sidebar, FeatureCard
│       ├── context/       # Auth context
│       ├── hooks/         # useAuth, useFetch
│       ├── pages/         # Dashboard & feature pages
│       ├── services/      # API connectors
│       └── routes.jsx
├── server/                # Node.js + Express API gateway
│   └── src/
├── ai-service/             # Python FastAPI AI microservice
│   └── app/
└── docs/                  # Architecture & API docs


---

## 🛠️ Tech Stack

- *Frontend:* React 18, Vite, Tailwind CSS, Lucide Icons
- *Backend:* Node.js, Express, JWT Auth
- *AI Service:* Python 3.10+, FastAPI
- *Database:* MongoDB (Mongoose)

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Python 3.10+

### 1. Officer Dashboard
bash
cd client-officer
npm install
cp .env.example .env
npm run dev

→ runs at http://localhost:5173

### 2. Backend Server
bash
cd server
npm install
npm start

→ runs at http://localhost:5000

### 3. AI Microservice
bash
cd ai-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

→ docs at http://localhost:8000/docs

---

## ⚙️ Environment Variables

*client-officer/.env*
env
VITE_API_URL=http://localhost:5000/api
VITE_AI_SERVICE_URL=http://localhost:8000


*server/.env*
env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/civicsense
JWT_SECRET=your_jwt_secret_key_here
AI_SERVICE_URL=http://localhost:8000


---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| /api/issues | GET | Fetch all issues |
| /api/issues/:id/status | PATCH | Update issue status |
| /api/ai/investigations | GET | Get AI root-cause findings |
| /api/ai/analyze/:issueId | POST | Trigger a new AI diagnostic scan |
| /api/duplicates | GET | Retrieve duplicate issue clusters |
| /api/duplicates/merge | POST | Merge duplicate issues |
| /api/priority | GET | Get AI-ranked priority list |
| /api/work-orders | GET / POST | Fetch or create work orders |
| /api/repairs | GET | Fetch repair verification submissions |
| /api/repairs/:id/verify | POST | Approve or reject a repair |
| /api/contractors | GET | List contractors with ratings |
| /api/contractors/:id/flag | POST | Flag/unflag a contractor |
| /api/copilot/chat | POST | Query the AI copilot |
