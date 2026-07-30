import api from './api';

/** GET copilot chat history */
export async function getChatHistory() {
  const res = await api.get('/officer/copilot/history');
  return res?.data?.history || res?.history || [];
}

/** POST send a message to the AI copilot */
export async function sendMessage(message, issueId) {
  const res = await api.post('/officer/copilot/chat', { message, issueId });
  const replyText = res?.data?.reply || res?.data?.answer || res?.reply || res?.answer || res;
  return {
    _id: `msg-${Date.now()}`,
    role: 'ai',
    text: typeof replyText === 'string' ? replyText : JSON.stringify(replyText),
    ts: new Date().toISOString(),
  };
}
