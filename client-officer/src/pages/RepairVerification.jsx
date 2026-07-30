import React, { useState } from 'react';
import { getRepairs, verifyRepair } from '../services/repairService';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/helpers';

const STATUS_BADGE = {
  PENDING_VERIFICATION: 'bg-warning text-dark',
  VERIFIED: 'bg-success',
  REJECTED: 'bg-danger',
};

function RepairVerification() {
  const { data: repairs, loading, refetch } = useFetch(getRepairs, []);
  const [verdicts, setVerdicts] = useState({});

  const handleVerdict = async (id, verdict) => {
    await verifyRepair(id, verdict);
    setVerdicts(prev => ({ ...prev, [id]: verdict }));
    refetch();
  };

  return (
    <div>
      <div className="scr-page-header">
        <h1><i className="bi bi-camera me-2"></i>Repair Verification</h1>
        <p>Compare before/after images and verify or reject contractor repair submissions.</p>
      </div>

      {loading && <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>}

      <div className="row g-4">
        {(repairs || []).map(rep => {
          const verdict = verdicts[rep._id];
          const status  = verdict || rep.status;
          return (
            <div className="col-lg-6" key={rep._id}>
              <div className="card scr-card h-100">
                <div className="card-header d-flex align-items-center justify-content-between py-3 px-4"
                     style={{ background: 'var(--scr-navy)', color: '#fff', borderRadius: '10px 10px 0 0' }}>
                  <span className="fw-600" style={{ fontSize: '0.9rem' }}>{rep.title}</span>
                  <span className={`badge ${STATUS_BADGE[status] || 'bg-secondary'}`}>
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="card-body p-4">
                  {/* Before / After images */}
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <p className="text-muted mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>BEFORE</p>
                      <img src={rep.beforeImage} alt="Before repair" className="img-fluid rounded"
                           style={{ height: 140, objectFit: 'cover', width: '100%' }} />
                    </div>
                    <div className="col-6">
                      <p className="text-muted mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>AFTER</p>
                      <img src={rep.afterImage} alt="After repair" className="img-fluid rounded"
                           style={{ height: 140, objectFit: 'cover', width: '100%' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                    <i className="bi bi-building me-1"></i>{rep.contractor}
                    <span className="ms-3"><i className="bi bi-calendar me-1"></i>{formatDate(rep.completedAt)}</span>
                  </div>
                </div>
                {status === 'PENDING_VERIFICATION' && (
                  <div className="card-footer bg-transparent px-4 pb-3 d-flex gap-2">
                    <button className="btn btn-success btn-sm flex-grow-1"
                      onClick={() => handleVerdict(rep._id, 'VERIFIED')}>
                      <i className="bi bi-check-lg me-1"></i>Verify
                    </button>
                    <button className="btn btn-danger btn-sm flex-grow-1"
                      onClick={() => handleVerdict(rep._id, 'REJECTED')}>
                      <i className="bi bi-x-lg me-1"></i>Reject
                    </button>
                  </div>
                )}
                {verdict && (
                  <div className="card-footer bg-transparent px-4 pb-3">
                    <span className={`badge ${verdict === 'VERIFIED' ? 'bg-success' : 'bg-danger'}`}>
                      {verdict === 'VERIFIED' ? '✓ Verified' : '✗ Rejected'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RepairVerification;
