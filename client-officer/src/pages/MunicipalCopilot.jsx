import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getChatHistory, sendMessage } from '../services/copilotService';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../hooks/useAuth';
import BackButton from '../components/BackButton';

const QUICK = [
  'Top unresolved issues this week?',
  'Which contractor has the most complaints?',
  'How many issues are in Zone-A?',
  "Summarize today's work orders",
];

function MunicipalCopilot() {
  const { officer }                      = useAuth();
  const { data: history, loading }       = useFetch(getChatHistory, []);
  const [messages, setMessages]          = useState([]);
  const [input,    setInput]             = useState('');
  const [sending,  setSending]           = useState(false);
  const chatEndRef                       = useRef(null);

  useEffect(() => { if (history) setMessages(history); }, [history]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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

  return (
    <div>
      <motion.div className="scr-page-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        <BackButton fallback="/dashboard" />
        <h1 style={{ marginTop: 8 }}><i className="bi bi-chat-dots" />Municipal Copilot</h1>
        <p>Ask AI anything about civic data — issues, contractors, zones, trends.</p>
      </motion.div>

      <div className="row g-4">
        {/* Chat panel */}
        <div className="col-lg-8">
          <motion.div
            className="card scr-card p-0"
            style={{ display: 'flex', flexDirection: 'column', height: 560, overflow: 'hidden' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Chat header */}
            <div
              style={{
                background: 'var(--o-blue-light)',
                borderBottom: '1px solid var(--o-border)',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  background: 'var(--o-green)', color: '#fff',
                  borderRadius: 6, padding: '2px 8px', fontSize: '.65rem', fontWeight: 700,
                }}
              >
                ● LIVE
              </span>
              <span style={{ fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--o-text)' }}>AI Copilot — CivicSense AI</span>
            </div>

            {/* Messages */}
            <div className="scr-chat-box flex-grow-1">
              {loading && (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary spinner-border-sm" />
                </div>
              )}
              {messages.map(msg => (
                <div
                  key={msg._id}
                  className={`d-flex mb-3 ${msg.role === 'officer' ? 'justify-content-end' : 'justify-content-start'}`}
                >
                  {msg.role === 'ai' && (
                    <div className="me-2 d-flex align-items-end">
                      <div
                        style={{
                          width: 30, height: 30,
                          background: 'var(--o-blue-light)',
                          border: '1px solid var(--o-border)',
                          borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <i className="bi bi-robot" style={{ fontSize: '.8rem', color: 'var(--o-blue)' }} />
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
                  <div className="scr-chat-bubble ai" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner-border spinner-border-sm" style={{ color: 'var(--o-text-3)' }} />
                    <span style={{ fontSize: '.8rem', color: 'var(--o-text-3)' }}>Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--o-border)' }}>
              <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
                <input
                  id="copilot-input"
                  className="form-control"
                  placeholder="Ask the AI copilot anything…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={sending}
                  style={{ fontSize: '.875rem' }}
                />
                <motion.button
                  type="submit"
                  className="btn btn-primary px-4"
                  disabled={sending || !input.trim()}
                  whileTap={{ scale: 0.95 }}
                >
                  <i className="bi bi-send-fill" />
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>

        {/* Quick prompts */}
        <div className="col-lg-4">
          <motion.div
            className="card scr-card p-4"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
          >
            <h6 style={{ fontWeight: 700, marginBottom: 14, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--o-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="bi bi-lightning-charge" style={{ color: 'var(--o-blue)' }} />Quick Prompts
            </h6>
            <div className="d-flex flex-column gap-2">
              {QUICK.map((q, i) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setInput(q)}
                  style={{
                    background: 'var(--o-elevated)',
                    border: '1px solid var(--o-border)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: '.82rem',
                    lineHeight: 1.45,
                    color: 'var(--o-text-2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all .15s',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--o-blue)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--o-border)'}
                >
                  <i className="bi bi-chat-right-text flex-shrink-0 mt-1" style={{ color: 'var(--o-text-3)' }} />
                  {q}
                </motion.button>
              ))}
            </div>
            <div
              style={{
                borderTop: '1px solid var(--o-border)',
                marginTop: 16,
                paddingTop: 12,
                fontSize: '.78rem',
                color: 'var(--o-text-3)',
                display: 'flex',
                gap: 6,
              }}
            >
              <i className="bi bi-info-circle flex-shrink-0 mt-1" />
              Copilot responses are AI-generated. Verify critical data before acting.
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default MunicipalCopilot;
