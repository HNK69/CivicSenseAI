import React from 'react';
import { getPrioritizedIssues } from '../services/priorityService';
import { useFetch } from '../hooks/useFetch';
import { motion } from 'framer-motion';
import BackButton from '../components/BackButton';

const PRIORITY_BADGE = {
  CRITICAL: 'bg-danger',
  HIGH:     'bg-warning text-dark',
  MEDIUM:   'bg-info text-dark',
  LOW:      'bg-secondary',
};

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055 } },
};
const rowVariants = {
  hidden:  { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

function SmartPriority() {
  const { data: issues, loading } = useFetch(getPrioritizedIssues, []);

  return (
    <div>
      <div className="scr-page-header">
        <BackButton fallback="/dashboard" />
        <h1><i className="bi bi-sort-down me-2"></i>Smart Priority</h1>
        <p>AI-ranked issue list based on upvotes, severity, category, and days open.</p>
      </div>

      {loading && <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>}

      <div className="card scr-card p-0">
        <motion.ul
          className="list-group list-group-flush"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {(issues || []).map((issue, idx) => (
            <motion.li
              className="list-group-item px-4 py-3 d-flex align-items-center gap-3"
              key={issue._id}
              variants={rowVariants}
              whileHover={{ backgroundColor: 'rgba(26,86,219,0.03)', transition: { duration: 0.1 } }}
            >
              {/* Rank badge */}
              <div
                className="d-flex align-items-center justify-content-center rounded-circle fw-700"
                style={{
                  width: 36, height: 36, flexShrink: 0,
                  background: idx === 0 ? '#c0392b' : idx === 1 ? '#e67e22' : 'var(--scr-navy)',
                  color: '#fff', fontSize: '0.85rem'
                }}
              >
                #{idx + 1}
              </div>

              {/* Details */}
              <div className="flex-grow-1 min-w-0">
                <div className="fw-600" style={{ fontSize: '0.875rem', color: '#1a2533' }}>{issue.title}</div>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  <span className={`badge ${PRIORITY_BADGE[issue.priority]}`} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>{issue.priority}</span>
                  <span className="badge bg-light text-dark border" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>{issue.category}</span>
                  <small className="text-muted">{issue.daysOpen} days open</small>
                  <small className="text-muted"><i className="bi bi-hand-thumbs-up me-1"></i>{issue.upvotes}</small>
                </div>
              </div>

              {/* Priority score */}
              <div className="text-end flex-shrink-0">
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: idx === 0 ? '#c0392b' : 'var(--scr-navy)', lineHeight: 1.2 }}>
                  {issue.score}
                </div>
                <small className="text-muted" style={{ fontSize: '0.72rem' }}>score</small>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <div className="alert alert-info mt-4 d-flex gap-2" style={{ fontSize: '0.84rem' }}>
        <i className="bi bi-info-circle-fill flex-shrink-0 mt-1"></i>
        Priority score is computed by the AI engine using: upvotes × 1.5 + (daysOpen × severity weight). Override individual priorities from the Issue Dashboard.
      </div>
    </div>
  );
}

export default SmartPriority;
