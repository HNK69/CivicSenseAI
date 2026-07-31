import api from '../utils/axiosInstance.js';

/**
 * issueService.js — All civic issue API calls (no auth for now).
 */

export const reportIssue = async (formData) => {
  // axiosInstance interceptor returns response.data
  // Server shape: { success, message, data: { issue, issueId } } or { success, message, data: { isDuplicate, duplicate_of } }
  const res = await api.post('/issues', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const data = res?.data || res;
  const issueId = data?.issueId || data?.issue?._id || data?.issue?.id || data?.duplicate_of || `ISS-${Date.now().toString().slice(-6)}`;
  return { success: true, issueId, isDuplicate: data?.isDuplicate, message: res?.message || 'Report submitted' };
};

/** Get all issues (my reports) — GET /api/issues/mine */
export const getMyIssues = async () => {
  // Server returns paginated: { success, data: [...issues], pagination }
  const res = await api.get('/issues/mine');
  return res.data || [];
};

/** Get a single issue by ID — GET /api/issues/:id */
export const getIssueById = async (id) => {
  const res = await api.get(`/issues/${id}`);
  return res.data?.issue || null;
};

/** Delete / retract a submitted issue — DELETE /api/issues/:id */
export const deleteIssue = async (id) => {
  await api.delete(`/issues/${id}`);
  return { success: true };
};

