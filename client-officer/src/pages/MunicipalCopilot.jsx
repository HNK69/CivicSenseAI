import React, { useState, useRef, useEffect } from 'react';
import { getChatHistory, sendMessage } from '../services/copilotService';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../hooks/useAuth';
import BackButton from '../components/BackButton';

function MunicipalCopilot() {
  const { officer } = useAuth();
  const { data: history, loading } = useFetch(getChatHistory, []);

  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const chatEndRef = useRef(null);

  // Seed chat with loaded history
  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { _id: `u-${Date.now()}`, role: 'officer', text: input.trim(), ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    const aiReply = await sendMessage(userMsg.text);
    setMessages(prev => [...prev, aiReply]);
    setSending(false);
  };

  const QUICK = [
    'Top unresolved issues this week?',
    'Which contractor has the most complaints?',
    'How many issues are in Zone-A?',
    'Summarize today\'s work orders',
  ];

  return (
    <div>
      <div className="scr-page-header">
        <BackButton fallback="/dashboard" />
        <h1><i className="bi bi-chat-dots me-2"></i>Municipal Copilot</h1>
        <p>Ask AI anything about civic data — issues, contractors, zones, trends.</p>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          {/* Chat window */}
          <div className="card scr-card p-0" style={{ display: 'flex', flexDirection: 'column', height: 560 }}>
            <div className="px-4 py-3 border-bottom d-flex align-items-center gap-2"
                 style={{ background: 'var(--scr-navy)', color: '#fff', borderRadius: '10px 10px 0 0' }}>
              <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>● LIVE</span>
              <span className="fw-600">AI Copilot — Smart Civic Reporter</span>
            </div>

            {/* Messages */}
            <div className="scr-chat-box flex-grow-1">
              {loading && <div className="text-center py-4"><div className="spinner-border text-primary spinner-border-sm"></div></div>}
              {messages.map(msg => (
                <div key={msg._id} className={`d-flex mb-3 ${msg.role === 'officer' ? 'justify-content-end' : 'justify-content-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="me-2 d-flex align-items-end">
                      <div style={{ width: 32, height: 32, background: 'var(--scr-navy)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-robot text-white" style={{ fontSize: '0.85rem' }}></i>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className={`scr-chat-bubble ${msg.role}`}>{msg.text}</div>
                    <div className={`scr-chat-meta ${msg.role === 'officer' ? 'text-end' : ''}`}>
                      {msg.role === 'officer' ? officer?.name : 'AI Copilot'} · {formatDate(msg.ts)}
                    </div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="d-flex justify-content-start mb-2">
                  <div className="scr-chat-bubble ai" style={{ padding: '8px 16px' }}>
                    <span className="spinner-border spinner-border-sm text-secondary"></span>
                    <span className="ms-2 text-muted" style={{ fontSize: '0.8rem' }}>Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="p-3 border-top">
              <form onSubmit={handleSend} className="d-flex gap-2">
                <input
                  id="copilot-input"
                  className="form-control"
                  placeholder="Ask the AI copilot anything…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={sending}
                  style={{ fontSize: '0.875rem' }}
                />
                <button
                  type="submit"
                  className="btn px-4"
                  style={{ background: 'var(--scr-navy)', color: '#fff' }}
                  disabled={sending || !input.trim()}
                >
                  <i className="bi bi-send-fill"></i>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Quick prompts sidebar */}
        <div className="col-lg-4">
          <div className="card scr-card p-4">
            <h6 className="fw-700 mb-3" style={{ color: 'var(--scr-navy)' }}>
              <i className="bi bi-lightning-charge me-2"></i>Quick Prompts
            </h6>
            <div className="d-flex flex-column gap-2">
              {QUICK.map((q, i) => (
                <button
                  key={i}
                  className="btn btn-outline-secondary text-start btn-sm"
                  style={{ fontSize: '0.82rem', lineHeight: 1.4 }}
                  onClick={() => setInput(q)}
                >
                  <i className="bi bi-chat-right-text me-2 text-muted"></i>{q}
                </button>
              ))}
            </div>
            <hr />
            <small className="text-muted" style={{ fontSize: '0.78rem' }}>
              <i className="bi bi-info-circle me-1"></i>
              Copilot responses are AI-generated. Verify critical data before acting.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MunicipalCopilot;
