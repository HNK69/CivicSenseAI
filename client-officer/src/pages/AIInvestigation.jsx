import React, { useState } from 'react';
import { getFindings, triggerAnalysis } from '../services/aiInvestigationService';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';

const SEVERITY_BADGE = { CRITICAL: 'bg-danger', HIGH: 'bg-warning text-dark', MEDIUM: 'bg-info text-dark', LOW: 'bg-secondary' };

function AIInvestigation() {
  const { data: findings, loading } = useFetch(getFindings, []);
  const [triggered, setTriggered] = useState(null);

  const handleAnalyze = async (issueId) => {
    await triggerAnalysis(issueId);
    setTriggered(issueId);
  };

  return (
    <div>
      <div className="scr-page-header">
        <h1><i className="bi bi-robot me-2"></i>AI Investigation</h1>
        <p>AI-generated root cause analysis and suggested actions for reported issues.</p>
      </div>

      {loading && <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>}

      <div className="row g-4">
        {(findings || []).map((f) => (
          <div className="col-md-6 col-xl-4" key={f._id}>
            <div className="card scr-card h-100 p-0">
              <div className="card-header d-flex align-items-center justify-content-between py-3 px-4"
                   style={{ background: 'var(--scr-navy)', color: '#fff', borderRadius: '10px 10px 0 0' }}>
                <span className="fw-600">{f.category}</span>
                <span className={`badge ${SEVERITY_BADGE[f.severity] || 'bg-secondary'}`}>{f.severity}</span>
              </div>
              <div className="card-body p-4">
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{f.summary}</p>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span className="badge bg-success" style={{ fontSize: '0.72rem' }}>
                    Confidence: {(f.confidence * 100).toFixed(0)}%
                  </span>
                  <small className="text-muted">{formatDate(f.createdAt)}</small>
                </div>
                <div className="alert alert-warning py-2 px-3 mb-0" style={{ fontSize: '0.85rem' }}>
                  <i className="bi bi-lightbulb-fill me-1"></i>{f.suggestedAction}
                </div>
              </div>
              <div className="card-footer bg-transparent px-4 pb-3">
                <button
                  className="btn btn-sm btn-outline-primary w-100"
                  onClick={() => handleAnalyze(f.issueId)}
                  disabled={triggered === f.issueId}
                >
                  {triggered === f.issueId
                    ? <><i className="bi bi-check-circle me-1"></i>Analysis Queued</>
                    : <><i className="bi bi-arrow-clockwise me-1"></i>Re-Analyze</>
                  }
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AIInvestigation;
