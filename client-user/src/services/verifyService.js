import api from '../utils/axiosInstance.js';

/* ---- MOCK FALLBACK DATA ---- */
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

/** Get completed issues awaiting citizen verification */
export const getPendingVerifications = async () => {
  try {
    const res = await api.get('/issues/mine', { params: { status: 'completed' } });
    const docs = res?.data?.issues || res?.data?.docs || res?.issues || res?.docs || res;
    if (Array.isArray(docs) && docs.length > 0) return docs;
  } catch (err) {
    console.warn('[verifyService] Failed to fetch pending verifications, using fallback:', err.message);
  }
  return MOCK_COMPLETED;
};

/** Citizen confirms repair is fixed */
export const confirmRepair = async (issueId) => {
  try {
    const res = await api.patch(`/issues/${issueId}/verify`, { confirmed: true });
    return res?.data || res || { success: true, message: 'Repair confirmed. Thank you!' };
  } catch (err) {
    console.warn('[verifyService] confirmRepair failed:', err.message);
    return { success: false, error: err.response?.data?.message || err.message };
  }
};

/** Citizen disputes — marks issue as still broken */
export const disputeRepair = async (issueId, reason = '') => {
  try {
    const res = await api.patch(`/issues/${issueId}/verify`, { confirmed: false, reason });
    return res?.data || res || { success: true, message: 'Issue re-opened. Officials have been notified.' };
  } catch (err) {
    console.warn('[verifyService] disputeRepair failed:', err.message);
    return { success: false, error: err.response?.data?.message || err.message };
  }
};
