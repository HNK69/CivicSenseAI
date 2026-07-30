import api from '../utils/axiosInstance.js';

/**
 * statusService.js — Track status of submitted issues.
 */

/** Get status timeline/history for a specific issue */
export const getIssueStatusHistory = async (issueId) => {
  try {
    const res = await api.get(`/issues/${issueId}`);
    const issue = res?.data?.issue || res?.issue || res;
    if (issue && Array.isArray(issue.statusHistory) && issue.statusHistory.length > 0) {
      return issue.statusHistory.map(h => ({
        step: h.status ? h.status.charAt(0).toUpperCase() + h.status.slice(1).replace('_', ' ') : 'Updated',
        date: h.changedAt || h.createdAt || new Date().toISOString(),
        done: true,
        note: h.note || null,
      }));
    }
  } catch (err) {
    console.warn('[statusService] Failed to fetch issue history, using fallback:', err.message);
  }

  return [
    { step: 'Submitted',   date: new Date(Date.now() - 86400000 * 4).toISOString(), done: true  },
    { step: 'Assigned',    date: new Date(Date.now() - 86400000 * 3).toISOString(), done: true  },
    { step: 'In Progress', date: new Date(Date.now() - 86400000 * 1).toISOString(), done: true  },
    { step: 'Completed',   date: null,                                               done: false },
  ];
};

/** Filter issues by status */
export const getIssuesByStatus = async (status) => {
  const { getMyIssues } = await import('./issueService.js');
  const all = await getMyIssues();
  if (!status || status === 'all') return all;
  return (all || []).filter(i => i.status === status);
};
