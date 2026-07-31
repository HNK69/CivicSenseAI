import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getIssues, updateIssueStatus, deleteIssue } from '../services/issueService';
import { useFetch } from '../hooks/useFetch';
import { getStatusBadgeColor, formatDate } from '../utils/helpers';
import BackButton from '../components/BackButton';
import MapView from '../components/MapView';

const STATUS_FILTERS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];

function IssueDashboard() {
  const { data: fetchedIssues, loading } = useFetch(getIssues, []);
  const [issuesList, setIssuesList] = useState([]);
  const [view,   setView]   = useState('list');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (fetchedIssues) {
      setIssuesList(fetchedIssues);
    }
  }, [fetchedIssues]);

  const handleResolve = async (id) => {
    try {
      await updateIssueStatus(id, 'resolved', 'Manually marked resolved by officer.');
      setIssuesList(prev => prev.map(item => item._id === id ? { ...item, status: 'resolved' } : item));
    } catch (err) {
      console.error('Failed to resolve issue:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this issue?')) return;
    try {
      await deleteIssue(id);
      setIssuesList(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      console.error('Failed to delete issue:', err);
    }
  };

  const filtered = issuesList.filter(i => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return i.status === 'reported' || i.status === 'acknowledged' || i.status === 'assigned';
    if (filter === 'IN_PROGRESS') return i.status === 'in_progress';
    if (filter === 'RESOLVED') return i.status === 'resolved';
    return i.status === filter;
  });

  const priorityStyle = (p) => {
    if (p === 'CRITICAL') return { background: 'var(--o-red-bg)',    color: 'var(--o-red)',    border: '1px solid #fecaca' };
    if (p === 'HIGH')     return { background: 'var(--o-orange-bg)', color: 'var(--o-orange)', border: '1px solid #fed7aa' };
    return                       { background: 'var(--o-blue-light)', color: 'var(--o-blue)',  border: '1px solid var(--o-blue-muted)' };
  };

  return (
    <div>
      <motion.div
        className="scr-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <BackButton fallback="/dashboard" />
        <h1 style={{ marginTop: 8 }}><i className="bi bi-map" />Issue Dashboard</h1>
        <p>Browse, filter, and manage all reported civic issues.</p>
      </motion.div>

      {/* ── Toolbar ── */}
      <motion.div
        className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.22 }}
      >
        {/* Status filters */}
        <div className="d-flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <motion.button
              key={s}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(s)}
              style={{
                background: filter === s ? 'var(--o-blue)' : 'var(--o-surface)',
                color: filter === s ? '#fff' : 'var(--o-text-2)',
                border: '1px solid',
                borderColor: filter === s ? 'var(--o-blue)' : 'var(--o-border)',
                borderRadius: 8,
                padding: '5px 14px',
                fontSize: '.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all .15s',
              }}
            >
              {s.replace('_', ' ')}
            </motion.button>
          ))}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--o-border)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { id: 'list', icon: 'bi-list-ul', label: 'List' },
            { id: 'map',  icon: 'bi-map',     label: 'Map'  },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                background: view === v.id ? 'var(--o-blue)' : 'var(--o-surface)',
                color: view === v.id ? '#fff' : 'var(--o-text-2)',
                border: 'none',
                padding: '6px 16px',
                fontSize: '.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all .15s',
              }}
            >
              <i className={`bi ${v.icon}`} />{v.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Map view ── */}
      <AnimatePresence mode="wait">
        {view === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="card scr-card mb-4 p-2"
          >
            <MapView issues={filtered} height="440px" />
          </motion.div>
        )}

        {/* ── List view ── */}
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {loading && (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" style={{ width: '1.75rem', height: '1.75rem' }} />
              </div>
            )}
            <div className="card scr-card p-0" style={{ overflow: 'hidden' }}>
              <div className="table-responsive">
                <table className="table scr-table mb-0">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '1.25rem' }}>Issue</th>
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Upvotes</th>
                      <th>Reported</th>
                      <th>Location</th>
                      <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((issue, idx) => (
                      <motion.tr
                        key={issue._id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.2 }}
                      >
                        <td style={{ paddingLeft: '1.25rem', maxWidth: 220 }}>
                          <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{issue.title}</div>
                        </td>
                        <td>
                          <span
                            style={{
                              background: 'var(--o-elevated)',
                              border: '1px solid var(--o-border)',
                              borderRadius: 6,
                              padding: '2px 9px',
                              fontSize: '.75rem',
                              fontWeight: 600,
                              color: 'var(--o-text-2)',
                            }}
                          >
                            {issue.category}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              ...priorityStyle(issue.priority),
                              borderRadius: 6,
                              padding: '2px 9px',
                              fontSize: '.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {issue.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadgeColor(issue.status)}`} style={{ fontSize: '.73rem' }}>
                            {issue.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '.84rem', color: 'var(--o-text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="bi bi-hand-thumbs-up" style={{ color: 'var(--o-text-3)' }} />{issue.upvotes}
                          </span>
                        </td>
                        <td style={{ fontSize: '.8rem', color: 'var(--o-text-3)' }}>{formatDate(issue.createdAt)}</td>
                        <td style={{ fontSize: '.8rem', color: 'var(--o-text-2)', maxWidth: 160 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {issue.location?.address}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                          <div className="d-inline-flex gap-1">
                            {issue.status !== 'resolved' ? (
                              <button
                                className="btn btn-sm btn-success d-inline-flex align-items-center gap-1"
                                style={{ borderRadius: 6, padding: '3px 8px', fontSize: '.75rem', fontWeight: 600 }}
                                onClick={() => handleResolve(issue._id)}
                                title="Mark Issue Resolved"
                              >
                                <i className="bi bi-check-circle-fill" /> Done
                              </button>
                            ) : (
                              <span className="badge bg-success me-1" style={{ fontSize: '.7rem', padding: '5px 8px' }}>
                                <i className="bi bi-check2-all me-1" />Done
                              </span>
                            )}
                            <button
                              className="btn btn-sm btn-outline-danger"
                              style={{ borderRadius: 6, padding: '3px 7px', fontSize: '.75rem' }}
                              onClick={() => handleDelete(issue._id)}
                              title="Delete Issue"
                            >
                              <i className="bi bi-trash-fill" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                    {filtered.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--o-text-3)', padding: '2.5rem', fontSize: '.875rem' }}>
                          <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '1.8rem' }} />
                          No issues match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default IssueDashboard;
