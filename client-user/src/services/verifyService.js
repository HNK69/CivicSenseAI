import api from '../utils/axiosInstance.js';

/* ---- MOCK DATA ---- */
const MOCK_COMPLETED = [
  {
    id: 'ISS-2380',
    title: 'Overflowing garbage bin',
    location: 'Infantry Road, Ballari',
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    beforeImg: null,
    afterImg: null,
    awaitingVerification: true,
  },
  {
    id: 'ISS-2355',
    title: 'Street light not working',
    location: 'Koramangala 4th Block',
    completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    beforeImg: null,
    afterImg: null,
    awaitingVerification: true,
  },
];

/**
 * verifyService.js — Repair verification API calls.
 * TODO: connect to real backend endpoints when ready.
 */

/** Get completed issues awaiting citizen verification */
export const getPendingVerifications = async () => {
  // TODO: connect to backend endpoint — GET /api/issues/mine?status=completed&verified=false
  // return api.get('/issues/mine', { params: { status: 'completed', verified: false } });
  return MOCK_COMPLETED;
};

/** Citizen confirms repair is fixed */
export const confirmRepair = async (issueId) => {
  // TODO: connect to backend endpoint — PATCH /api/issues/:id/verify
  // return api.patch(`/issues/${issueId}/verify`, { confirmed: true });
  console.log('[MOCK] confirmRepair', issueId);
  return { success: true, message: 'Repair confirmed. Thank you!' };
};

/** Citizen disputes — marks issue as still broken */
export const disputeRepair = async (issueId, reason = '') => {
  // TODO: connect to backend endpoint — PATCH /api/issues/:id/verify
  // return api.patch(`/issues/${issueId}/verify`, { confirmed: false, reason });
  console.log('[MOCK] disputeRepair', issueId, reason);
  return { success: true, message: 'Issue re-opened. Officials have been notified.' };
};
