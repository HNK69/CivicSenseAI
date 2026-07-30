import { useState } from 'react';
import { Container, Card, Spinner, Button, ButtonGroup, Form, InputGroup } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import StatusBadge from '../components/StatusBadge.jsx';
import useFetch from '../hooks/useFetch.js';
import { getMyIssues } from '../services/issueService.js';
import { categoryIconMap } from '../utils/statusColorMap.js';
import { formatDate, timeAgo } from '../utils/formatDate.js';
import BackButton from '../components/BackButton.jsx';

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'reported',    label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Resolved' },
];

const TrackStatus = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const { data: issues, loading, error, refetch } = useFetch(getMyIssues, []);

  const filtered = (issues || []).filter(issue => {
    const matchesFilter = activeFilter === 'all' || issue.status === activeFilter;
    const issueId = issue._id || issue.id || '';
    const matchesSearch =
      search === '' ||
      (issue.title || '').toLowerCase().includes(search.toLowerCase()) ||
      issueId.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <>
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <h1><i className="bi bi-list-check" />My Issue Reports</h1>
          <p>Track real-time status of every issue you've reported.</p>
        </Container>
      </div>

      <Container className="py-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Card className="feature-card">
            <Card.Body className="p-4">

              {/* ── Toolbar ── */}
              <div className="d-flex flex-wrap gap-3 mb-4 align-items-center justify-content-between">
                {/* Filter chips */}
                <div className="d-flex gap-2 flex-wrap">
                  {FILTERS.map(f => (
                    <motion.button
                      key={f.key}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveFilter(f.key)}
                      style={{
                        background: activeFilter === f.key ? 'var(--civic-blue)' : 'var(--bg-elevated)',
                        color: activeFilter === f.key ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid',
                        borderColor: activeFilter === f.key ? 'var(--civic-blue)' : 'var(--border-base)',
                        borderRadius: 8,
                        padding: '5px 14px',
                        fontSize: '.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        transition: 'all .15s ease',
                      }}
                    >
                      {f.label}
                      {f.key !== 'all' && issues && (
                        <span
                          style={{
                            marginLeft: 6,
                            background: activeFilter === f.key ? 'rgba(255,255,255,.25)' : 'var(--border-base)',
                            color: activeFilter === f.key ? '#fff' : 'var(--text-muted)',
                            borderRadius: 10,
                            padding: '1px 6px',
                            fontSize: '.7rem',
                          }}
                        >
                          {issues.filter(i => i.status === f.key).length}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', maxWidth: 260 }}>
                  <i
                    className="bi bi-search"
                    style={{
                      position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', fontSize: '.85rem', pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search issues…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    id="issue-search-input"
                    style={{
                      paddingLeft: 32,
                      border: '1px solid var(--border-base)',
                      borderRadius: 8,
                      fontSize: '.84rem',
                      padding: '7px 12px 7px 32px',
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      transition: 'border-color .15s',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--civic-blue)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-base)'}
                  />
                </div>
              </div>

              {/* ── Content ── */}
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p style={{ color: 'var(--text-muted)', marginTop: 10, fontSize: '.875rem' }}>Loading your reports…</p>
                </div>
              ) : error ? (
                <div className="text-center py-5" style={{ color: 'var(--red)' }}>
                  <i className="bi bi-exclamation-circle-fill d-block mb-2" style={{ fontSize: '2rem' }} />
                  {error} — <button className="btn btn-link p-0" onClick={refetch}>Retry</button>
                </div>
              ) : filtered.length === 0 ? (
                <motion.div
                  className="text-center py-5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2.2rem' }} />
                  <p style={{ fontSize: '.875rem' }}>No issues found. Try a different filter.</p>
                </motion.div>
              ) : (
                <div className="table-responsive">
                  <table className="status-table w-100" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>Issue ID</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Submitted</th>
                        <th>Last Update</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <AnimatePresence>
                      <tbody>
                        {filtered.map((issue, idx) => {
                          const issueId = issue._id || issue.id;
                          const lastUpdate = issue.updatedAt || issue.statusHistory?.at(-1)?.changedAt || issue.createdAt;
                          return (
                            <motion.tr
                              key={issueId}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04, duration: 0.2 }}
                              data-status={issue.status}
                              id={`row-${issueId}`}
                            >
                              <td>
                                <span
                                  style={{
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-base)',
                                    borderRadius: 6,
                                    padding: '2px 8px',
                                    fontSize: '.72rem',
                                    fontWeight: 600,
                                    fontFamily: 'monospace',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {String(issueId).slice(-8).toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{issue.title}</div>
                                <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                  <i className="bi bi-geo-alt-fill me-1" style={{ color: 'var(--red)' }} />
                                  {issue.address || issue.location?.address || '—'}
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: '.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <i className={`bi ${categoryIconMap[issue.category?.toLowerCase()] ?? 'bi-three-dots'}`} />
                                  {issue.category}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontSize: '.82rem' }}>{formatDate(issue.createdAt)}</div>
                                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{timeAgo(issue.createdAt)}</div>
                              </td>
                              <td style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>{formatDate(lastUpdate)}</td>
                              <td><StatusBadge status={issue.status} /></td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </AnimatePresence>
                  </table>
                </div>
              )}

              {/* Footer stats */}
              {!loading && !error && issues && (
                <div
                  className="d-flex flex-wrap gap-3 mt-4 pt-3"
                  style={{ borderTop: '1px solid var(--border-base)', fontSize: '.8rem', color: 'var(--text-muted)' }}
                >
                  <span><strong style={{ color: 'var(--text-primary)' }}>{issues.length}</strong> total</span>
                  <span><strong style={{ color: 'var(--orange)' }}>{issues.filter(i => i.status === 'reported').length}</strong> pending</span>
                  <span><strong style={{ color: 'var(--civic-blue)' }}>{issues.filter(i => i.status === 'in_progress').length}</strong> in progress</span>
                  <span><strong style={{ color: 'var(--green)' }}>{issues.filter(i => i.status === 'resolved').length}</strong> resolved</span>
                </div>
              )}

            </Card.Body>
          </Card>
        </motion.div>
      </Container>
    </>
  );
};

export default TrackStatus;
