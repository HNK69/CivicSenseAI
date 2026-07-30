import React from 'react';
import { getPrioritizedIssues } from '../services/priorityService';
import { useFetch } from '../hooks/useFetch';
import BackButton from '../components/BackButton';

const PRIORITY_BADGE = {
  CRITICAL: 'bg-danger',
  HIGH:     'bg-warning text-dark',
  MEDIUM:   'bg-info text-dark',
  LOW:      'bg-secondary',
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
        <ul className="list-group list-group-flush">
          {(issues || []).map((issue, idx) => (
            <li className="list-group-item px-4 py-3 d-flex align-items-center gap-3" key={issue._id}>
              {/* Rank badge */}
              <div
                className="d-flex align-items-center justify-content-center rounded-circle fw-700"
                style={{
                  width: 36, height: 36, flexShrink: 0,
                  background: idx === 0 ? '#c0392b' : idx === 1 ? '#e67e22' : 'var(--scr-navy)',
                  color: '#fff', fontSize: '0.9rem'
                }}
              >
                #{idx + 1}
              </div>

              {/* Details */}
              <div className="flex-grow-1">
                <div className="fw-600" style={{ fontSize: '0.9rem' }}>{issue.title}</div>
                <div className="d-flex flex-wrap gap-2 mt-1">
                  <span className={`badge ${PRIORITY_BADGE[issue.priority]}`}>{issue.priority}</span>
                  <span className="badge bg-light text-dark border">{issue.category}</span>
                  <small className="text-muted">{issue.daysOpen} days open</small>
                  <small className="text-muted"><i className="bi bi-hand-thumbs-up me-1"></i>{issue.upvotes}</small>
                </div>
              </div>

              {/* Priority score */}
              <div className="text-end">
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: idx === 0 ? '#c0392b' : 'var(--scr-navy)' }}>
                  {issue.score}
                </div>
                <small className="text-muted">score</small>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="alert alert-info mt-4 d-flex gap-2" style={{ fontSize: '0.85rem' }}>
        <i className="bi bi-info-circle-fill flex-shrink-0 mt-1"></i>
        Priority score is computed by the AI engine using: upvotes × 1.5 + (daysOpen × severity weight). Override individual priorities from the Issue Dashboard.
      </div>
    </div>
  );
}

export default SmartPriority;
