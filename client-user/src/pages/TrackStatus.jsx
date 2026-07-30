import { useState } from 'react';
import { motion } from 'framer-motion';
import { Container, Card, Table, Badge, Spinner, Button, ButtonGroup, Form, InputGroup } from 'react-bootstrap';
import StatusBadge from '../components/StatusBadge.jsx';
import useFetch from '../hooks/useFetch.js';
import { getMyIssues } from '../services/issueService.js';
import { categoryIconMap } from '../utils/statusColorMap.js';
import { formatDate, timeAgo } from '../utils/formatDate.js';
import BackButton from '../components/BackButton.jsx';

/**
 * TrackStatus.jsx — Full table of citizen's reported issues with
 * filter chips (All / Pending / In Progress / Completed).
 */
const FILTERS = [
  { key: 'all',         label: 'All',         variant: 'outline-secondary' },
  { key: 'reported',    label: 'Pending',      variant: 'outline-warning'   },
  { key: 'in_progress', label: 'In Progress',  variant: 'outline-info'      },
  { key: 'resolved',    label: 'Completed',    variant: 'outline-success'   },
];

// Normalise backend status to a display label
const STATUS_LABEL = {
  reported:     'Reported',
  acknowledged: 'Acknowledged',
  assigned:     'Assigned',
  in_progress:  'In Progress',
  resolved:     'Resolved',
  rejected:     'Rejected',
  reopened:     'Reopened',
};

const TrackStatus = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');

  const { data: issues, loading, error, refetch } = useFetch(getMyIssues, []);

  const filtered = (issues || []).filter(issue => {
    const matchesFilter =
      activeFilter === 'all' || issue.status === activeFilter;
    const issueId = issue._id || issue.id || '';
    const matchesSearch =
      search === '' ||
      (issue.title || '').toLowerCase().includes(search.toLowerCase()) ||
      issueId.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <>
      {/* Sticky Hero Header */}
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <h1 className="mb-1">
            <i className="bi bi-list-check me-2" />My Issue Reports
          </h1>
          <p className="mb-0">Track real-time status of every issue you've reported.</p>
        </Container>
      </div>

      <Container className="py-5">
        <Card className="feature-card border-0">
          <Card.Body className="p-4">

            {/* ---- Toolbar ---- */}
            <div className="d-flex flex-wrap gap-3 mb-4 align-items-center justify-content-between">
              {/* Filter chips */}
              <ButtonGroup>
                {FILTERS.map(f => (
                  <Button
                    key={f.key}
                    variant={activeFilter === f.key ? f.variant.replace('outline-', '') : f.variant}
                    className="filter-chip"
                    onClick={() => setActiveFilter(f.key)}
                    id={`filter-${f.key}`}
                  >
                    {f.label}
                    {f.key !== 'all' && issues && (
                      <Badge
                        bg="white"
                        text="dark"
                        pill
                        className="ms-1"
                        style={{ fontSize: '.65rem' }}
                      >
                        {issues.filter(i => i.status === f.key).length}
                      </Badge>
                    )}
                  </Button>
                ))}
              </ButtonGroup>

              {/* Search */}
              <InputGroup style={{ maxWidth: 260 }}>
                <InputGroup.Text style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <i className="bi bi-search text-muted" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search issues…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ border: '1px solid #e2e8f0', fontSize: '.875rem' }}
                  id="issue-search-input"
                />
              </InputGroup>
            </div>

            {/* ---- Table ---- */}
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="text-muted mt-2 mb-0">Loading your reports…</p>
              </div>
            ) : error ? (
              <div className="text-center py-5 text-danger">
                <i className="bi bi-exclamation-circle-fill fs-3 d-block mb-2" />
                {error} —{' '}
                <button className="btn btn-link p-0" onClick={refetch}>Retry</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox fs-2 d-block mb-2" />
                No issues found. Try a different filter.
              </div>
            ) : (
              <div className="table-responsive">
                <Table className="status-table align-middle mb-0" hover>
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
                  <tbody>
                    {filtered.map(issue => {
                      const issueId = issue._id || issue.id;
                      const lastUpdate = issue.updatedAt ||
                        issue.statusHistory?.at(-1)?.changedAt ||
                        issue.createdAt;
                      return (
                        <tr
                          key={issueId}
                          className="report-row"
                          data-status={issue.status}
                          id={`row-${issueId}`}
                        >
                          <td>
                            <span className="badge bg-light text-dark fw-semibold" style={{ fontSize: '.75rem' }}>
                              {String(issueId).slice(-8).toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div className="fw-semibold" style={{ fontSize: '.875rem' }}>{issue.title}</div>
                            <div className="text-muted" style={{ fontSize: '.75rem' }}>
                              <i className="bi bi-geo-alt-fill text-danger me-1" />
                              {issue.address || issue.location?.address || '—'}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '.82rem', color: '#64748b' }}>
                              <i className={`bi ${categoryIconMap[issue.category?.toLowerCase()] ?? 'bi-three-dots'} me-1`} />
                              {issue.category}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '.82rem' }}>{formatDate(issue.createdAt)}</div>
                            <div className="text-muted" style={{ fontSize: '.72rem' }}>{timeAgo(issue.createdAt)}</div>
                          </td>
                          <td style={{ fontSize: '.82rem' }}>{formatDate(lastUpdate)}</td>
                          <td><StatusBadge status={issue.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}

            {/* ---- Footer stats ---- */}
            {!loading && !error && issues && (
              <div className="d-flex flex-wrap gap-3 mt-4 pt-3 border-top" style={{ fontSize: '.8rem', color: '#64748b' }}>
                <span><strong>{issues.length}</strong> total reports</span>
                <span><strong>{issues.filter(i => i.status === 'reported').length}</strong> pending</span>
                <span><strong>{issues.filter(i => i.status === 'in_progress').length}</strong> in progress</span>
                <span><strong>{issues.filter(i => i.status === 'resolved').length}</strong> resolved</span>
              </div>
            )}

          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default TrackStatus;
