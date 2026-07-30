import React, { useState } from 'react';
import { getContractors, flagContractor, unflagContractor } from '../services/contractorService';
import { useFetch } from '../hooks/useFetch';
import { renderStars, formatDate } from '../utils/helpers';
import BackButton from '../components/BackButton';

function ContractorPerformance() {
  const { data: contractors, loading, refetch } = useFetch(getContractors, []);
  const [flagging, setFlagging] = useState(null);

  const handleFlag = async (id, isFlagged) => {
    setFlagging(id);
    isFlagged ? await unflagContractor(id) : await flagContractor(id);
    setFlagging(null);
    refetch();
  };

  return (
    <div>
      <div className="scr-page-header">
        <BackButton fallback="/dashboard" />
        <h1><i className="bi bi-star me-2"></i>Contractor Performance</h1>
        <p>Monitor contractor ratings, complaint counts, and flag underperformers.</p>
      </div>

      {loading && <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>}

      <div className="card scr-card p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead style={{ background: 'var(--scr-navy)', color: '#fff' }}>
              <tr>
                <th className="py-3 px-4">Contractor</th>
                <th>Category</th>
                <th>Rating</th>
                <th>Completed Jobs</th>
                <th>Complaints</th>
                <th>Last Active</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.875rem' }}>
              {(contractors || []).map(c => (
                <tr key={c._id} style={{ background: c.flagged ? 'rgba(192,57,43,0.04)' : 'transparent' }}>
                  <td className="px-4 py-3 fw-600">{c.name}</td>
                  <td><span className="badge bg-light text-dark border">{c.category}</span></td>
                  <td>
                    <span style={{ color: '#f39c12', fontSize: '0.95rem' }}>{renderStars(c.rating)}</span>
                    <span className="ms-1 text-muted" style={{ fontSize: '0.78rem' }}>({c.rating})</span>
                  </td>
                  <td className="text-center">{c.completedJobs}</td>
                  <td className="text-center">
                    <span className={`badge ${c.complaints > 5 ? 'bg-danger' : c.complaints > 2 ? 'bg-warning text-dark' : 'bg-success'}`}>
                      {c.complaints}
                    </span>
                  </td>
                  <td className="text-muted">{formatDate(c.lastActive)}</td>
                  <td>
                    {c.flagged
                      ? <span className="badge bg-danger"><i className="bi bi-flag-fill me-1"></i>Flagged</span>
                      : <span className="badge bg-success">Active</span>
                    }
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${c.flagged ? 'btn-outline-success' : 'btn-outline-danger'}`}
                      disabled={flagging === c._id}
                      onClick={() => handleFlag(c._id, c.flagged)}
                    >
                      {flagging === c._id
                        ? <span className="spinner-border spinner-border-sm"></span>
                        : c.flagged
                          ? <><i className="bi bi-check me-1"></i>Unflag</>
                          : <><i className="bi bi-flag me-1"></i>Flag</>
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ContractorPerformance;
