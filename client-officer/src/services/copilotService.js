import api from './api';

let currentConversationId = `conv_${Date.now()}`;

/** GET copilot chat history */
export async function getChatHistory() {
  const res = await api.get('/officer/copilot/history');
  return res?.data?.history || res?.history || [];
}

/** POST send a message to the AI copilot */
export async function sendMessage(message, issueId) {
  const res = await api.post('/officer/copilot/chat', {
    message,
    issueId,
    conversation_id: currentConversationId,
  });

  if (res?.data?.conversation_id) {
    currentConversationId = res.data.conversation_id;
  }

  const replyText = res?.data?.reply || res?.data?.message || res?.data?.answer || res?.reply || res?.answer || res;
  return {
    _id: `msg-${Date.now()}`,
    role: 'ai',
    text: typeof replyText === 'string' ? replyText : JSON.stringify(replyText),
    ts: new Date().toISOString(),
  };
}
