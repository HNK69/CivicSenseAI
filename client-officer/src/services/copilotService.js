import api from './api';

const MOCK_HISTORY = [
  { _id: 'msg-001', role: 'officer', text: 'What are the top unresolved issues in Zone-A this week?', ts: '2025-07-30T09:00:00Z' },
  { _id: 'msg-002', role: 'ai',      text: 'Zone-A has 12 unresolved issues. Top 3: (1) Pothole cluster on MG Road — 4 reports, HIGH priority; (2) Garbage backlog Ward 7B — CRITICAL; (3) Water disruption Block C — now RESOLVED. Recommend deploying PWD crew to MG Road first.', ts: '2025-07-30T09:00:05Z' },
  { _id: 'msg-003', role: 'officer', text: 'Which contractor has the most complaints this quarter?', ts: '2025-07-30T09:01:00Z' },
  { _id: 'msg-004', role: 'ai',      text: 'AquaFlow Pipes Ltd leads with 9 complaints this quarter, primarily around delayed repair completions in water supply projects. Consider review before renewing their contract.', ts: '2025-07-30T09:01:04Z' },
];

/** GET copilot chat history */
export async function getChatHistory() {
  try {
    const res = await api.get('/officer/copilot/history');
    const history = res?.data?.history || res?.history;
    if (Array.isArray(history) && history.length > 0) return history;
    return MOCK_HISTORY;
  } catch (err) {
    console.warn('[copilotService] Failed to fetch chat history, using fallback:', err.message);
    return MOCK_HISTORY;
  }
}

/** POST send a message to the AI copilot */
export async function sendMessage(message, issueId) {
  try {
    const res = await api.post('/officer/copilot/chat', { message, issueId });
    const replyText = res?.data?.reply || res?.data?.answer || res?.reply || res?.answer || res;
    return {
      _id: `msg-${Date.now()}`,
      role: 'ai',
      text: typeof replyText === 'string' ? replyText : JSON.stringify(replyText),
      ts: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[copilotService] Failed to query AI copilot:', err.message);
    return {
      _id: `msg-${Date.now()}`,
      role: 'ai',
      text: `[AI Copilot Error] ${err.response?.data?.message || err.message}. Please try again shortly.`,
      ts: new Date().toISOString(),
    };
  }
}
