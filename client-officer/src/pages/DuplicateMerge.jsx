import React, { useState } from 'react';
import { getDuplicateGroups, mergeDuplicates } from '../services/duplicateService';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';
import BackButton from '../components/BackButton';

function DuplicateMerge() {
  const { data: groups, loading, refetch } = useFetch(getDuplicateGroups, []);
  const [activeGroup, setActiveGroup]     = useState(null);
  const [selected, setSelected]           = useState([]);
  const [merging, setMerging]             = useState(false);
  const [success, setSuccess]             = useState('');
  const [errorMsg, setErrorMsg]           = useState('');

  const openModal = (group) => {
    setActiveGroup(group);
    setSelected([]);
    setSuccess('');
    setErrorMsg('');
  };

  const closeModal = () => {
    setActiveGroup(null);
    setSelected([]);
    setSuccess('');
    setErrorMsg('');
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleMerge = async () => {
    if (!selected.length || !activeGroup) return;
    setMerging(true);
    setErrorMsg('');
    try {
      await mergeDuplicates(activeGroup.primaryIssueId, selected);
      setSuccess(`${selected.length} duplicate(s) merged into primary issue successfully.`);
      setSelected([]);
      setTimeout(() => {
        closeModal();
        refetch();
      }, 1500);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || 'Merge failed. Please try again.');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div>
      <div className="scr-page-header">
        <BackButton fallback="/dashboard" />
        <h1><i className="bi bi-files me-2"></i>Duplicate Merge</h1>
        <p>Identify and merge citizen-reported duplicates to reduce noise and consolidate upvotes.</p>
      </div>

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      )}

      {(!groups || groups.length === 0) && !loading && (
        <div className="card scr-card p-5 text-center text-muted">
          <i className="bi bi-check-circle text-success display-4 mb-3"></i>
          <h5>No Unmerged Duplicate Groups Found</h5>
          <p className="mb-0 small">All reported complaints are unique or have already been merged.</p>
        </div>
      )}

      {(groups || []).map((group, idx) => (
        <div className="card scr-card mb-3 p-4" key={group._id || group.primaryIssueId || idx}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <span className="badge bg-primary me-2">Primary ID: {group.primaryIssueId}</span>
              <span className="fw-bold me-2">{group.primaryTitle || 'Primary Issue'}</span>
              <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                ({group.duplicates?.length || 0} candidate duplicate(s))
              </span>
            </div>
            <button className="btn btn-sm btn-outline-danger" onClick={() => openModal(group)}>
              <i className="bi bi-merge me-1"></i>Review &amp; Merge
            </button>
          </div>
          <ul className="list-group list-group-flush mt-3">
            {(group.duplicates || []).map(d => (
              <li className="list-group-item px-0 py-2 d-flex align-items-center justify-content-between" key={d._id} style={{ fontSize: '0.875rem' }}>
                <div>
                  <i className="bi bi-files text-muted me-2"></i>
                  <strong>{d.title}</strong>
                  <span className="text-muted ms-2">— {formatDate(d.createdAt)}</span>
                </div>
                {d.similarity != null && (
                  <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '.75rem' }}>
                    {(d.similarity * 100).toFixed(0)}% Match
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Clean React Modal Overlay */}
      {activeGroup && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={closeModal}
        >
          <div
            className="card scr-card shadow-lg"
            style={{ maxWidth: 540, width: '100%', borderRadius: 12, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between" style={{ background: 'var(--scr-navy)', color: '#fff' }}>
              <h6 className="mb-0 fw-bold"><i className="bi bi-merge me-2"></i>Merge Duplicate Reports</h6>
              <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
            </div>
            <div className="p-4">
              {success && <div className="alert alert-success py-2 mb-3 small">{success}</div>}
              {errorMsg && <div className="alert alert-danger py-2 mb-3 small">{errorMsg}</div>}
              
              <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
                Select which duplicate reports to merge into primary issue <strong>#{activeGroup.primaryIssueId}</strong>:
              </p>

              <div className="d-flex flex-column gap-2 mb-4">
                {(activeGroup.duplicates || []).map(d => (
                  <div
                    key={d._id}
                    className={`p-3 border rounded d-flex align-items-center gap-3 cursor-pointer ${selected.includes(d._id) ? 'border-danger bg-light' : ''}`}
                    onClick={() => toggleSelect(d._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      className="form-check-input flex-shrink-0"
                      type="checkbox"
                      checked={selected.includes(d._id)}
                      onChange={() => toggleSelect(d._id)}
                    />
                    <div className="flex-grow-1">
                      <div className="fw-600" style={{ fontSize: '.875rem' }}>{d.title}</div>
                      <div className="text-muted" style={{ fontSize: '.78rem' }}>ID: {d._id} · Reported {formatDate(d.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button className="btn btn-sm btn-secondary px-3" onClick={closeModal} disabled={merging}>Cancel</button>
                <button
                  className="btn btn-sm btn-danger px-4"
                  onClick={handleMerge}
                  disabled={!selected.length || merging}
                >
                  {merging ? 'Merging…' : `Merge ${selected.length} Selected`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DuplicateMerge;
