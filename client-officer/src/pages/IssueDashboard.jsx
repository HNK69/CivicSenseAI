import React, { useState } from 'react';
import { getIssues } from '../services/issueService';
import { useFetch } from '../hooks/useFetch';
import { getStatusBadgeColor, formatDate } from '../utils/helpers';

function IssueDashboard() {
  const { data: issues, loading } = useFetch(getIssues, []);
  const [view, setView] = useState('list'); // 'list' | 'map'
  const [filter, setFilter] = useState('ALL');

  const filtered = (issues || []).filter(i => filter === 'ALL' || i.status === filter);

  return (
    <div>
      <div className="scr-page-header">
        <h1><i className="bi bi-map me-2"></i>Issue Dashboard</h1>
        <p>Browse, filter, and manage all reported civic issues across the municipality.</p>
      </div>

      {/* Toolbar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        {/* Status filter */}
        <div className="d-flex gap-2 flex-wrap">
          {['ALL','OPEN','IN_PROGRESS','RESOLVED'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilter(s)}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="btn-group btn-group-sm">
          <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('list')}>
            <i className="bi bi-list-ul me-1"></i>List
          </button>
          <button className={`btn ${view === 'map' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setView('map')}>
            <i className="bi bi-map me-1"></i>Map
          </button>
        </div>
      </div>

      {/* Map placeholder */}
      {view === 'map' && (
        <div className="card scr-card mb-4" style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8ecf0' }}>
          <div className="text-center text-muted">
            <i className="bi bi-map" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
            <p className="mt-2 mb-0">Leaflet map will render here.</p>
            <small>Install <code>react-leaflet</code> and replace this div with &lt;MapContainer&gt;.</small>
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <>
          {loading && <div className="text-center py-4"><div className="spinner-border text-primary"></div></div>}
          <div className="card scr-card p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{ background: 'var(--scr-navy)', color: '#fff' }}>
                  <tr>
                    <th className="py-3 px-4">Issue</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Upvotes</th>
                    <th>Reported</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(issue => (
                    <tr key={issue._id}>
                      <td className="px-4 py-3 fw-600" style={{ maxWidth: 220, fontSize: '0.875rem' }}>{issue.title}</td>
                      <td><span className="badge bg-light text-dark border">{issue.category}</span></td>
                      <td><span className={`badge ${issue.priority === 'CRITICAL' ? 'bg-danger' : issue.priority === 'HIGH' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>{issue.priority}</span></td>
                      <td><span className={`badge ${getStatusBadgeColor(issue.status)}`}>{issue.status.replace('_', ' ')}</span></td>
                      <td><i className="bi bi-hand-thumbs-up me-1 text-muted"></i>{issue.upvotes}</td>
                      <td style={{ fontSize: '0.8rem', color: '#6c757d' }}>{formatDate(issue.createdAt)}</td>
                      <td style={{ fontSize: '0.8rem' }}>{issue.location?.address}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !loading && (
                    <tr><td colSpan={7} className="text-center text-muted py-4">No issues match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default IssueDashboard;
