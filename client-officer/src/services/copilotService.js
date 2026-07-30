// import api from './api';

const MOCK_HISTORY = [
  { _id: 'msg-001', role: 'officer', text: 'What are the top unresolved issues in Zone-A this week?', ts: '2025-07-30T09:00:00Z' },
  { _id: 'msg-002', role: 'ai',      text: 'Zone-A has 12 unresolved issues. Top 3: (1) Pothole cluster on MG Road — 4 reports, HIGH priority; (2) Garbage backlog Ward 7B — CRITICAL; (3) Water disruption Block C — now RESOLVED. Recommend deploying PWD crew to MG Road first.', ts: '2025-07-30T09:00:05Z' },
  { _id: 'msg-003', role: 'officer', text: 'Which contractor has the most complaints this quarter?', ts: '2025-07-30T09:01:00Z' },
  { _id: 'msg-004', role: 'ai',      text: 'AquaFlow Pipes Ltd leads with 9 complaints this quarter, primarily around delayed repair completions in water supply projects. Consider review before renewing their contract.', ts: '2025-07-30T09:01:04Z' },
];

/** GET copilot chat history. TODO: return api.get('/copilot/history') */
export async function getChatHistory()              { return Promise.resolve(MOCK_HISTORY); }

/** POST send a message to the AI copilot. TODO: return api.post('/copilot/chat', { message }) */
export async function sendMessage(message) {
  // Stub response — replace with real AI endpoint call
  return Promise.resolve({
    _id: `msg-${Date.now()}`,
    role: 'ai',
    text: `[AI Response Placeholder] You asked: "${message}". The backend copilot service will return a real answer when connected.`,
    ts: new Date().toISOString(),
  });
}
