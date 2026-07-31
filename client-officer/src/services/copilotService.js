import api from './api';

let currentConversationId = `conv_${Date.now()}`;

/** GET copilot chat history */
export async function getChatHistory() {
  const res = await api.get('/officer/copilot/history');
  return res?.data?.history || res?.history || [];
}

/** POST send a message to the AI copilot */
export async function sendMessage(message, issueId) {
  let res;
  try {
    res = await api.post('/officer/copilot/chat', {
      message,
      issueId,
      conversation_id: currentConversationId,
    });
  } catch (err) {
    console.error('[copilotService] API error:', err?.message || err);
    throw err;
  }

  if (res?.data?.conversation_id) {
    currentConversationId = res.data.conversation_id;
  } else if (res?.conversation_id) {
    currentConversationId = res.conversation_id;
  }

  // Backend shape: { success, data: { reply, answer, complaint_context } }
  const replyText =
    res?.data?.reply   ||
    res?.data?.answer  ||
    res?.reply         ||
    res?.answer        ||
    res?.data?.message ||
    (typeof res === 'string' ? res : null) ||
    'No response from copilot.';

  return {
    _id: `msg-${Date.now()}`,
    role: 'ai',
    text: typeof replyText === 'string' ? replyText : JSON.stringify(replyText),
    ts: new Date().toISOString(),
  };
}
