import React, { useState } from 'react';
import { getContractors, flagContractor, unflagContractor, updateFlagStatus } from '../services/contractorService';
import { useFetch } from '../hooks/useFetch';
import { renderStars, formatDate } from '../utils/helpers';
import BackButton from '../components/BackButton';

function ContractorPerformance() {
  const { data: contractors, loading, refetch } = useFetch(getContractors, []);
  const [flagging, setFlagging] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const handleFlagStatusChange = async (id, newStatus) => {
    setFlagging(id);
    await updateFlagStatus(id, newStatus);
    setFlagging(null);
    setToastMsg(`Flag status updated to "${newStatus}"`);
    setTimeout(() => setToastMsg(''), 3000);
    refetch();
  };

  const handleQuickFlagToggle = async (id, isFlagged) => {
    setFlagging(id);
    isFlagged ? await unflagContractor(id) : await flagContractor(id);
    setFlagging(null);
    setToastMsg(isFlagged ? 'Contractor unflagged' : 'Contractor flagged as underperformer');
    setTimeout(() => setToastMsg(''), 3000);
    refetch();
  };

  const getStatusBadge = (status, flagged) => {
    switch (status) {
      case 'Blacklisted':
        return <span className="badge bg-dark text-white"><i className="bi bi-x-octagon-fill me-1"></i>Blacklisted</span>;
      case 'Flagged':
        return <span className="badge bg-danger"><i className="bi bi-flag-fill me-1"></i>Flagged</span>;
      case 'Under Warning':
        return <span className="badge bg-warning text-dark"><i className="bi bi-exclamation-triangle-fill me-1"></i>Under Warning</span>;
      case 'Active':
      default:
        return <span className="badge bg-success"><i className="bi bi-check-circle-fill me-1"></i>Active</span>;
    }
  };

  return (
    <div>
      <div className="scr-page-header">
        <BackButton fallback="/dashboard" />
        <h1><i className="bi bi-star me-2"></i>Contractor Performance</h1>
        <p>Monitor contractor ratings, complaint counts, and change flag status.</p>
      </div>

      {toastMsg && (
        <div className="alert alert-info alert-dismissible fade show shadow-sm mb-3" role="alert">
          <i className="bi bi-info-circle-fill me-2"></i>{toastMsg}
          <button type="button" className="btn-close" onClick={() => setToastMsg('')}></button>
        </div>
      )}

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
                <th>Current Flag Status</th>
                <th>Change Flag Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.875rem' }}>
              {(contractors || []).map(c => {
                const currentStatus = c.flagStatus || (c.flagged ? 'Flagged' : 'Active');
                return (
                  <tr key={c._id} style={{ background: c.flagged || currentStatus === 'Blacklisted' ? 'rgba(192,57,43,0.05)' : 'transparent' }}>
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
                      {getStatusBadge(currentStatus, c.flagged)}
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm fw-semibold"
                        style={{ width: 145, fontSize: '0.8rem', borderRadius: 6 }}
                        value={currentStatus}
                        disabled={flagging === c._id}
                        onChange={e => handleFlagStatusChange(c._id, e.target.value)}
                      >
                        <option value="Active">🟢 Active</option>
                        <option value="Under Warning">🟡 Under Warning</option>
                        <option value="Flagged">🔴 Flagged</option>
                        <option value="Blacklisted">⚫ Blacklisted</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${c.flagged || currentStatus === 'Flagged' ? 'btn-outline-success' : 'btn-outline-danger'}`}
                        disabled={flagging === c._id}
                        onClick={() => handleQuickFlagToggle(c._id, c.flagged || currentStatus === 'Flagged')}
                      >
                        {flagging === c._id
                          ? <span className="spinner-border spinner-border-sm"></span>
                          : (c.flagged || currentStatus === 'Flagged')
                            ? <><i className="bi bi-check me-1"></i>Unflag</>
                            : <><i className="bi bi-flag me-1"></i>Flag</>
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ContractorPerformance;
