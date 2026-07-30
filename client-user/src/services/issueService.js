import api from '../utils/axiosInstance.js';

/**
 * issueService.js — All civic issue API calls (no auth for now).
 */

/** Submit a new issue report (multipart for file uploads) */
export const reportIssue = async (formData) => {
  // axiosInstance interceptor returns response.data
  // Server shape: { success, message, data: { issue } }
  const res = await api.post('/issues', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { success: true, issueId: res.data?.issue?._id || res.data?.issue?.id };
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

