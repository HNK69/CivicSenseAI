import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getPrioritizedIssues } from '../services/priorityService';
import { updateIssueStatus, deleteIssue } from '../services/issueService';
import { useFetch } from '../hooks/useFetch';
import BackButton from '../components/BackButton';

const priorityStyle = (p) => ({
  CRITICAL: { background: 'var(--o-red-bg)',    color: 'var(--o-red)',    border: '1px solid #fecaca' },
  HIGH:     { background: 'var(--o-orange-bg)', color: 'var(--o-orange)', border: '1px solid #fed7aa' },
  MEDIUM:   { background: 'var(--o-yellow-bg)', color: 'var(--o-yellow)', border: '1px solid #fef08a' },
  LOW:      { background: 'var(--o-green-bg)',  color: 'var(--o-green)',  border: '1px solid #bbf7d0' },
}[p] || { background: 'var(--o-elevated)', color: 'var(--o-text-2)', border: '1px solid var(--o-border)' });

const rankColor = (idx) => {
  if (idx === 0) return 'var(--o-red)';
  if (idx === 1) return 'var(--o-orange)';
  if (idx === 2) return 'var(--o-yellow)';
  return 'var(--o-text-3)';
};

function SmartPriority() {
  const { data: fetchedIssues, loading } = useFetch(getPrioritizedIssues, []);
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    if (fetchedIssues) {
      setIssues(fetchedIssues);
    }
  }, [fetchedIssues]);

  const handleResolve = async (id) => {
    try {
      await updateIssueStatus(id, 'resolved', 'Manually marked resolved by officer.');
      setIssues(prev => prev.map(item => item._id === id ? { ...item, status: 'resolved' } : item));
    } catch (err) {
      console.error('Failed to resolve issue:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this issue?')) return;
    try {
      await deleteIssue(id);
      setIssues(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      console.error('Failed to delete issue:', err);
    }
  };

  return (
    <div>
      <motion.div className="scr-page-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        <BackButton fallback="/dashboard" />
        <h1 style={{ marginTop: 8 }}><i className="bi bi-sort-down" />Smart Priority</h1>
        <p>AI-ranked issue list based on upvotes, severity, category, and days open.</p>
      </motion.div>

      {loading && <div className="text-center py-5"><div className="spinner-border text-primary" /></div>}

      <div className="card scr-card p-0" style={{ overflow: 'hidden' }}>
        <ul className="list-group list-group-flush">
          {issues.map((issue, idx) => (
            <motion.li
              key={issue._id}
              className="list-group-item d-flex align-items-center gap-3"
              style={{ padding: '14px 20px', borderBottom: '1px solid var(--o-border)' }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.22 }}
            >
              {/* Rank */}
              <div
                style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: '50%',
                  background: idx < 3 ? rankColor(idx) : 'var(--o-elevated)',
                  color: idx < 3 ? '#fff' : 'var(--o-text-3)',
                  border: idx >= 3 ? '1px solid var(--o-border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '.88rem', fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                #{idx + 1}
              </div>

              {/* Details */}
              <div className="flex-grow-1">
                <div style={{ fontWeight: 600, fontSize: '.9rem' }}>
                  {issue.title}
                  {issue.status === 'resolved' && (
                    <span className="badge bg-success ms-2" style={{ fontSize: '.7rem' }}>
                      <i className="bi bi-check-lg me-1" />Resolved
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  <span style={{ ...priorityStyle(issue.priority), borderRadius: 6, padding: '2px 8px', fontSize: '.72rem', fontWeight: 600 }}>
                    {issue.priority}
                  </span>
                  <span style={{ background: 'var(--o-elevated)', border: '1px solid var(--o-border)', borderRadius: 6, padding: '2px 8px', fontSize: '.72rem', fontWeight: 600, color: 'var(--o-text-2)' }}>
                    {issue.category}
                  </span>
                  <small style={{ color: 'var(--o-text-3)', fontSize: '.78rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <i className="bi bi-clock" />{issue.daysOpen} days open
                  </small>
                  <small style={{ color: 'var(--o-text-3)', fontSize: '.78rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <i className="bi bi-hand-thumbs-up" />{issue.upvotes}
                  </small>
                </div>
              </div>

              {/* Score */}
              <div className="text-end flex-shrink-0 me-2">
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: rankColor(idx) }}>
                  {issue.score}
                </div>
                <small style={{ color: 'var(--o-text-3)', fontSize: '.72rem' }}>score</small>
              </div>

              {/* Actions: Done / Tick & Delete */}
              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                {issue.status !== 'resolved' ? (
                  <button
                    className="btn btn-sm btn-success d-flex align-items-center gap-1"
                    style={{ borderRadius: 6, padding: '4px 10px', fontSize: '.8rem', fontWeight: 600 }}
                    onClick={() => handleResolve(issue._id)}
                    title="Mark Issue Resolved"
                  >
                    <i className="bi bi-check-circle-fill" /> Mark Done
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-outline-success disabled d-flex align-items-center gap-1"
                    style={{ borderRadius: 6, padding: '4px 10px', fontSize: '.8rem', fontWeight: 600 }}
                  >
                    <i className="bi bi-check2-all" /> Resolved
                  </button>
                )}
                <button
                  className="btn btn-sm btn-outline-danger"
                  style={{ borderRadius: 6, padding: '4px 8px', fontSize: '.8rem' }}
                  onClick={() => handleDelete(issue._id)}
                  title="Delete Issue"
                >
                  <i className="bi bi-trash-fill" />
                </button>
              </div>
            </motion.li>
          ))}
          {!loading && issues.length === 0 && (
            <li className="list-group-item text-center py-5" style={{ color: 'var(--o-text-3)' }}>
              <i className="bi bi-sort-down d-block mb-2" style={{ fontSize: '2rem' }} />
              <p style={{ fontSize: '.875rem' }}>No prioritized issues yet.</p>
            </li>
          )}
        </ul>
      </div>

      <div
        style={{
          background: 'var(--o-blue-light)',
          border: '1px solid var(--o-blue-muted)',
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: '.84rem',
          color: 'var(--o-blue)',
          display: 'flex',
          gap: 8,
          marginTop: 20,
        }}
      >
        <i className="bi bi-info-circle-fill flex-shrink-0 mt-1" />
        Priority score is computed using: upvotes × 1.5 + (daysOpen × severity weight). Override individual priorities from the Issue Dashboard.
      </div>
    </div>
  );
}

export default SmartPriority;
