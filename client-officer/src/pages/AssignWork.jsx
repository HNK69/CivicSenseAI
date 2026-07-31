import React, { useState } from 'react';
import { getWorkOrders, assignWorkOrder } from '../services/assignService';
import { getIssues } from '../services/issueService';
import { getContractors } from '../services/contractorService';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';
import BackButton from '../components/BackButton';

function AssignWork() {
  const { data: orders, loading: ordersLoading, refetch } = useFetch(getWorkOrders, []);
  const { data: issues, loading: issuesLoading }         = useFetch(getIssues, []);
  const { data: contractors, loading: contractorsLoading } = useFetch(getContractors, []);

  const [form, setForm] = useState({ issueId: '', contractorId: '', notes: '' });
  const [msg, setMsg]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!form.issueId) return;

    setSubmitting(true);
    // Find selected issue to resolve department automatically
    const selectedIssue = (issues || []).find(i => i._id === form.issueId);
    const department    = selectedIssue?.assignedDepartment || selectedIssue?.category || 'General';

    await assignWorkOrder(form.issueId, department, form.contractorId, form.notes);
    
    // Find contractor name for notification message
    const selectedContractor = (contractors || []).find(c => c._id === form.contractorId);
    const contractorName = selectedContractor?.name || 'contractor';

    setMsg(`Work order assigned successfully to ${contractorName}.`);
    setForm({ issueId: '', contractorId: '', notes: '' });
    setSubmitting(false);
    refetch();
  };

  const STATUS_BADGE = { PENDING: 'bg-warning text-dark', IN_PROGRESS: 'bg-info text-dark', COMPLETED: 'bg-success', pending: 'bg-warning text-dark', in_progress: 'bg-info text-dark', completed: 'bg-success' };

  return (
    <div>
      <div className="scr-page-header">
        <BackButton fallback="/dashboard" />
        <h1><i className="bi bi-person-check me-2"></i>Assign Work to Contractor</h1>
        <p>Create and track work orders — assign issues directly to registered municipal contractors.</p>
      </div>

      {/* Assignment form */}
      <div className="card scr-card p-4 mb-4">
        <h6 className="fw-700 mb-3" style={{ color: 'var(--scr-navy)' }}>
          <i className="bi bi-plus-circle me-2"></i>New Work Order
        </h6>
        {msg && <div className="alert alert-success py-2 mb-3" style={{ fontSize: '0.875rem' }}>{msg}</div>}
        <form onSubmit={handleAssign}>
          <div className="row g-3">
            {/* 1. Select Issue / Complaint */}
            <div className="col-md-6">
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

            {/* 2. Select Contractor (Replaces Officer & Department dropdown) */}
            <div className="col-md-6">
              <label className="form-label fw-600" style={{ fontSize: '0.8rem' }}>Assigned Contractor</label>
              <select
                className="form-select form-select-sm"
                value={form.contractorId}
                onChange={e => setForm(p => ({ ...p, contractorId: e.target.value }))}
                required
                disabled={contractorsLoading}
              >
                <option value="">{contractorsLoading ? 'Loading contractors…' : 'Select Contractor…'}</option>
                {(contractors || []).map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.company ? `(${c.company})` : ''} — {c.category || 'General'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-sm mt-3"
            style={{ background: 'var(--scr-navy)', color: '#fff' }}
            disabled={submitting}
          >
            <i className="bi bi-send me-2"></i>{submitting ? 'Assigning…' : 'Assign Work Order'}
          </button>
        </form>
      </div>

      {/* Work orders table */}
      <div className="card scr-card p-0">
        <div className="px-4 py-3 border-bottom fw-600 d-flex align-items-center justify-content-between" style={{ color: 'var(--scr-navy)' }}>
          <span><i className="bi bi-clipboard-check me-2"></i>Pending Work Orders</span>
          <span className="badge bg-secondary">{(orders || []).length} Work Orders</span>
        </div>
        {ordersLoading && <div className="text-center py-4"><div className="spinner-border text-primary spinner-border-sm"></div></div>}
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr style={{ fontSize: '0.8rem' }}>
                <th className="px-4 py-3">Issue</th>
                <th>Department</th>
                <th>Assigned Contractor</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.875rem' }}>
              {(!orders || orders.length === 0) && !ordersLoading && (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">
                    No work orders assigned yet. Select an issue above to assign a contractor.
                  </td>
                </tr>
              )}
              {(orders || []).map(o => {
                const issueTitle = o.issueTitle || o.issue?.title || 'Civic Work Order';
                const department = o.department || o.issue?.category || 'General';
                const contractorName = o.contractor?.name || o.contractor?.company || o.contractorName || 'Unassigned Contractor';
                const statusStr = (o.status || 'pending').toUpperCase();

                return (
                  <tr key={o._id}>
                    <td className="px-4 py-3 fw-600">{issueTitle}</td>
                    <td><span className="badge bg-light text-dark border">{department}</span></td>
                    <td><i className="bi bi-building me-1 text-primary"></i>{contractorName}</td>
                    <td><span className={`badge ${STATUS_BADGE[o.status] || STATUS_BADGE[statusStr] || 'bg-secondary'}`}>{statusStr.replace('_', ' ')}</span></td>
                    <td className="text-muted">{formatDate(o.createdAt || o.dueDate)}</td>
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

export default AssignWork;
