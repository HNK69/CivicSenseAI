import api from '../utils/axiosInstance.js';

/** Get completed issues awaiting citizen verification */
export const getPendingVerifications = async () => {
  const res = await api.get('/issues/mine', { params: { status: 'completed' } });
  return res?.data?.issues || res?.data?.docs || res?.issues || res?.docs || res || [];
};

/** Citizen confirms repair is fixed */
export const confirmRepair = async (issueId) => {
  const res = await api.patch(`/issues/${issueId}/verify`, { confirmed: true });
  return res?.data || res || { success: true, message: 'Repair confirmed. Thank you!' };
};

/** Citizen disputes — marks issue as still broken */
export const disputeRepair = async (issueId, reason = '') => {
  const res = await api.patch(`/issues/${issueId}/verify`, { confirmed: false, reason });
  return res?.data || res || { success: true, message: 'Issue re-opened. Officials have been notified.' };
};
