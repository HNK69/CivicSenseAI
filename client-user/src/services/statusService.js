import api from '../utils/axiosInstance.js';

/**
 * statusService.js — Track status of submitted issues.
 * TODO: connect to real backend endpoints when ready.
 */

/** Get status timeline/history for a specific issue */
export const getIssueStatusHistory = async (issueId) => {
  // TODO: connect to backend endpoint — GET /api/issues/:id/history
  // return api.get(`/issues/${issueId}/history`);
  return [
    { step: 'Submitted',   date: new Date(Date.now() - 86400000 * 4).toISOString(), done: true  },
    { step: 'Assigned',    date: new Date(Date.now() - 86400000 * 3).toISOString(), done: true  },
    { step: 'In Progress', date: new Date(Date.now() - 86400000 * 1).toISOString(), done: true  },
    { step: 'Completed',   date: null,                                               done: false },
  ];
};

/** Filter issues by status */
export const getIssuesByStatus = async (status) => {
  // TODO: connect to backend endpoint — GET /api/issues/mine?status=:status
  // return api.get('/issues/mine', { params: { status } });
  const { getMyIssues } = await import('./issueService.js');
  const all = await getMyIssues();
  if (!status || status === 'all') return all;
  return all.filter(i => i.status === status);
};
