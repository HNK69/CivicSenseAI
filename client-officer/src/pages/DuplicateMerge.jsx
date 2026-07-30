import React, { useState } from 'react';
import { getDuplicateGroups, mergeDuplicates } from '../services/duplicateService';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';

function DuplicateMerge() {
  const { data: groups, loading, refetch } = useFetch(getDuplicateGroups, []);
  const [activeGroup, setActiveGroup] = useState(null);
  const [selected, setSelected]       = useState([]);
  const [merging, setMerging]         = useState(false);
  const [success, setSuccess]         = useState('');

  const openModal = (group) => { setActiveGroup(group); setSelected([]); setSuccess(''); };

  const toggleSelect = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleMerge = async () => {
    if (!selected.length) return;
    setMerging(true);
    await mergeDuplicates(activeGroup.primaryIssueId, selected);
    setMerging(false);
    setSuccess(`${selected.length} duplicate(s) merged into primary issue.`);
    setSelected([]);
    refetch();
  };

  return (
    <div>
      <div className="scr-page-header">
        <h1><i className="bi bi-files me-2"></i>Duplicate Merge</h1>
        <p>Identify and merge citizen-reported duplicates to reduce noise and consolidate upvotes.</p>
      </div>

      {loading && <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>}

      {(groups || []).map(group => (
        <div className="card scr-card mb-3 p-4" key={group._id}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <span className="badge bg-primary me-2">Primary: {group.primaryIssueId}</span>
              <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                {group.duplicates.length} duplicate(s) detected
              </span>
            </div>
            <button className="btn btn-sm btn-outline-danger" onClick={() => openModal(group)}
              data-bs-toggle="modal" data-bs-target="#mergeModal">
              <i className="bi bi-merge me-1"></i>Review &amp; Merge
            </button>
          </div>
          <ul className="list-group list-group-flush mt-3">
            {group.duplicates.map(d => (
              <li className="list-group-item px-0 py-2" key={d._id} style={{ fontSize: '0.875rem' }}>
                <i className="bi bi-files text-muted me-2"></i>
                <strong>{d.title}</strong>
                <span className="text-muted ms-2">— {formatDate(d.createdAt)} · {d.upvotes} upvotes</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Bootstrap Modal */}
      <div className="modal fade" id="mergeModal" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header" style={{ background: 'var(--scr-navy)', color: '#fff' }}>
              <h5 className="modal-title"><i className="bi bi-merge me-2"></i>Merge Duplicates</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              {success && <div className="alert alert-success py-2">{success}</div>}
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                Select which reports to merge into the primary issue <strong>{activeGroup?.primaryIssueId}</strong>:
              </p>
              {activeGroup?.duplicates.map(d => (
                <div className="form-check mb-2" key={d._id}>
                  <input
                    className="form-check-input" type="checkbox" id={`dup-${d._id}`}
                    checked={selected.includes(d._id)}
                    onChange={() => toggleSelect(d._id)}
                  />
                  <label className="form-check-label" htmlFor={`dup-${d._id}`} style={{ fontSize: '0.875rem' }}>
                    {d.title} <span className="text-muted">({d.upvotes} upvotes)</span>
                  </label>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
              <button
                className="btn btn-danger btn-sm" onClick={handleMerge}
                disabled={!selected.length || merging}
              >
                {merging ? 'Merging…' : `Merge ${selected.length} Selected`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DuplicateMerge;
