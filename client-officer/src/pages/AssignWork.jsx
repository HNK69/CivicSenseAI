import React, { useState } from 'react';
import { getWorkOrders, assignWorkOrder } from '../services/assignService';
import { getIssues } from '../services/issueService';
import { useFetch } from '../hooks/useFetch';
import { DEPARTMENTS } from '../utils/constants';
import { formatDate } from '../utils/helpers';
import BackButton from '../components/BackButton';

function AssignWork() {
  const { data: orders, loading: ordersLoading, refetch } = useFetch(getWorkOrders, []);
  const { data: issues, loading: issuesLoading } = useFetch(getIssues, []);
  const [form, setForm] = useState({ issueId: '', dept: '', assignedTo: '' });
  const [msg, setMsg] = useState('');

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!form.issueId || !form.dept) return;
    await assignWorkOrder(form.issueId, form.dept, form.assignedTo);
    setMsg(`Work order assigned to ${form.dept}.`);
    setForm({ issueId: '', dept: '', assignedTo: '' });
    refetch();
  };

  const STATUS_BADGE = { PENDING: 'bg-warning text-dark', IN_PROGRESS: 'bg-info text-dark', COMPLETED: 'bg-success' };

  return (
    <div>
      <div className="scr-page-header">
        <BackButton fallback="/dashboard" />
        <h1><i className="bi bi-person-check me-2"></i>Assign Work</h1>
        <p>Create and track work orders — assign issues to municipal departments.</p>
      </div>

      {/* Assignment form */}
      <div className="card scr-card p-4 mb-4">
        <h6 className="fw-700 mb-3" style={{ color: 'var(--scr-navy)' }}>
          <i className="bi bi-plus-circle me-2"></i>New Work Order
        </h6>
        {msg && <div className="alert alert-success py-2 mb-3" style={{ fontSize: '0.875rem' }}>{msg}</div>}
        <form onSubmit={handleAssign}>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-600" style={{ fontSize: '0.8rem' }}>Select Issue / Complaint</label>
              <select
                className="form-select form-select-sm"
                value={form.issueId}
                onChange={e => setForm(p => ({ ...p, issueId: e.target.value }))}
                required
                disabled={issuesLoading}
              >
                <option value="">{issuesLoading ? 'Loading issues…' : 'Select Issue…'}</option>
                {(issues || []).map(i => (
                  <option key={i._id} value={i._id}>
                    {i.title || i.description?.slice(0, 40) || 'Untitled Issue'} ({i.category || 'General'})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-600" style={{ fontSize: '0.8rem' }}>Department</label>
              <select className="form-select form-select-sm" value={form.dept}
                onChange={e => setForm(p => ({ ...p, dept: e.target.value }))} required>
                <option value="">Select Department…</option>
                {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-600" style={{ fontSize: '0.8rem' }}>Assigned Officer</label>
              <input className="form-control form-control-sm" placeholder="Officer name"
                value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="btn btn-sm mt-3" style={{ background: 'var(--scr-navy)', color: '#fff' }}>
            <i className="bi bi-send me-2"></i>Assign Work Order
          </button>
        </form>
      </div>

      {/* Work orders table */}
      <div className="card scr-card p-0">
        <div className="px-4 py-3 border-bottom fw-600" style={{ color: 'var(--scr-navy)' }}>
          <i className="bi bi-clipboard-check me-2"></i>Pending Work Orders
        </div>
        {ordersLoading && <div className="text-center py-4"><div className="spinner-border text-primary spinner-border-sm"></div></div>}
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr style={{ fontSize: '0.8rem' }}>
                <th className="px-4 py-3">Issue</th>
                <th>Department</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.875rem' }}>
              {(orders || []).map(o => (
                <tr key={o._id}>
                  <td className="px-4 py-3">{o.issueTitle}</td>
                  <td><span className="badge bg-light text-dark border">{o.department}</span></td>
                  <td>{o.assignedTo}</td>
                  <td><span className={`badge ${STATUS_BADGE[o.status] || 'bg-secondary'}`}>{o.status.replace('_', ' ')}</span></td>
                  <td className="text-muted">{formatDate(o.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AssignWork;
