import api from './api';

/** GET AI investigation findings */
export async function getFindings() {
  const res = await api.get('/officer/ai/findings');
  return res?.data?.findings || res?.findings || res?.data || [];
}

/** POST trigger AI re-analysis for an issue */
export async function triggerAnalysis(issueId) {
  const res = await api.post(`/officer/issues/${issueId}/investigate`);
  return res?.data || res;
}
