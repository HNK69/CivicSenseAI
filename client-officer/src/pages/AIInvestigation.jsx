import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getFindings, triggerAnalysis } from '../services/aiInvestigationService';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';
import BackButton from '../components/BackButton';

const SEVERITY_STYLE = {
  CRITICAL: { background: 'var(--o-red-bg)',    color: 'var(--o-red)',    border: '1px solid #fecaca' },
  HIGH:     { background: 'var(--o-orange-bg)', color: 'var(--o-orange)', border: '1px solid #fed7aa' },
  MEDIUM:   { background: 'var(--o-yellow-bg)', color: 'var(--o-yellow)', border: '1px solid #fef08a' },
  LOW:      { background: 'var(--o-green-bg)',  color: 'var(--o-green)',  border: '1px solid #bbf7d0' },
};

const stagger = { animate: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

function AIInvestigation() {
  const { data: findings, loading } = useFetch(getFindings, []);
  const [triggered, setTriggered]   = useState(null);

  const handleAnalyze = async (issueId) => {
    await triggerAnalysis(issueId);
    setTriggered(issueId);
  };

  return (
    <div>
      <motion.div className="scr-page-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        <BackButton fallback="/dashboard" />
        <h1 style={{ marginTop: 8 }}><i className="bi bi-robot" />AI Investigation</h1>
        <p>AI-generated root cause analysis and suggested actions for reported issues.</p>
      </motion.div>

      {loading && <div className="text-center py-5"><div className="spinner-border text-primary" /></div>}

      <motion.div className="row g-4" variants={stagger} initial="initial" animate="animate">
        {(findings || []).map(f => (
          <motion.div className="col-md-6 col-xl-4" key={f._id} variants={fadeUp}>
            <div className="card scr-card h-100 p-0" style={{ overflow: 'hidden' }}>
              {/* Card header */}
              <div
                style={{
                  background: 'var(--o-blue-light)',
                  borderBottom: '1px solid var(--o-border)',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--o-text)' }}>{f.category}</span>
                <span
                  style={{
                    ...(SEVERITY_STYLE[f.severity] || {}),
                    borderRadius: 6, padding: '2px 9px', fontSize: '.72rem', fontWeight: 700,
                  }}
                >
                  {f.severity}
                </span>
              </div>
              <div className="card-body p-4">
                <p style={{ fontSize: '.875rem', lineHeight: 1.65, color: 'var(--o-text-2)' }}>{f.summary}</p>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span
                    style={{
                      background: 'var(--o-green-bg)', color: 'var(--o-green)',
                      border: '1px solid #bbf7d0', borderRadius: 6,
                      padding: '2px 9px', fontSize: '.72rem', fontWeight: 600,
                    }}
                  >
                    Confidence: {(f.confidence * 100).toFixed(0)}%
                  </span>
                  <small style={{ color: 'var(--o-text-3)', fontSize: '.75rem' }}>{formatDate(f.createdAt)}</small>
                </div>
                <div
                  style={{
                    background: 'var(--o-yellow-bg)',
                    border: '1px solid #fef08a',
                    borderRadius: 9,
                    padding: '10px 14px',
                    fontSize: '.84rem',
                    color: 'var(--o-yellow)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <i className="bi bi-lightbulb-fill flex-shrink-0 mt-1" />
                  {f.reasoning || f.suggestedAction || 'AI analysis complete.'}
                </div>
              </div>
              <div style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--o-border)' }}>
                <button
                  className="btn btn-sm btn-primary w-100 fw-semibold"
                  onClick={() => handleAnalyze(f.issueId)}
                  disabled={triggered === f.issueId}
                >
                  {triggered === f.issueId
                    ? <><i className="bi bi-check-circle me-1" />Analysis Queued</>
                    : <><i className="bi bi-arrow-clockwise me-1" />Re-Analyze</>}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {!loading && (findings || []).length === 0 && (
          <div className="col-12 text-center py-5" style={{ color: 'var(--o-text-3)' }}>
            <i className="bi bi-robot d-block mb-2" style={{ fontSize: '2.5rem' }} />
            <p style={{ fontSize: '.875rem' }}>No AI findings available yet.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default AIInvestigation;
