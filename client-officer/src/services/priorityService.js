import api from './api';

/** GET priority-ranked issues */
export async function getPrioritizedIssues() {
  const res = await api.get('/officer/issues/prioritized');
  return res?.data?.issues || res?.issues || res?.data || [];
}

/** PATCH override priority for an issue */
export async function overridePriority(id, priority) {
  const res = await api.patch(`/officer/issues/${id}/priority`, { priority });
  return res?.data || res;
}
