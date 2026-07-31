import api from '../utils/axiosInstance.js';

/**
 * issueService.js — All civic issue API calls.
 * axiosInstance interceptor returns response.data,
 * so `res` here is the server JSON body: { success, data, pagination }
 */

export const reportIssue = async (formData) => {
  const res = await api.post('/issues', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // res = { success, message, data: { issue, issueId, ... } }
  const data = res?.data || res || {};
  const issueId =
    data?.issueId ||
    data?.issue?._id ||
    data?.issue?.id ||
    data?.duplicate_of ||
    `ISS-${Date.now().toString().slice(-6)}`;
  return { success: true, issueId, isDuplicate: data?.isDuplicate, message: res?.message || 'Report submitted' };
};

/** Get all issues (my reports) — GET /api/issues/mine
 * Server paginated() → { success, data: [...docs], pagination }
 * After interceptor: res = { success, data, pagination }
 */
export const getMyIssues = async () => {
  try {
    const res = await api.get('/issues/mine');
    return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[issueService] getMyIssues failed:', err?.response?.status, err?.message);
    return [];
  }
};

/** Get a single issue by ID — GET /api/issues/:id */
export const getIssueById = async (id) => {
  const res = await api.get(`/issues/${id}`);
  // success() → { success, data: { issue } }
  return res?.data?.issue || res?.issue || null;
};

/** Delete / retract a submitted issue — DELETE /api/issues/:id */
export const deleteIssue = async (id) => {
  await api.delete(`/issues/${id}`);
  return { success: true };
};
