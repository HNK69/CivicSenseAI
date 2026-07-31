import api from '../utils/axiosInstance.js';

/**
 * Get issues belonging to the logged-in citizen that are completed/verified/resolved.
 * axiosInstance interceptor already returns response.data, so `res` here is the server JSON body:
 *   { success, data: [...docs], pagination }
 */
export const getPendingVerifications = async () => {
  try {
    const res = await api.get('/issues/mine', {
      params: { status: 'completed' },
    });
    // Server paginated() returns: { success, data: [...], pagination }
    // axiosInstance interceptor returns response.data, so res = { success, data, pagination }
    return Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];
  } catch (err) {
    console.warn('[verifyService] getPendingVerifications failed:', err?.response?.status, err?.message);
    return [];
  }
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
