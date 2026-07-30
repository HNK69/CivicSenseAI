import api from './api';

/** GET all issues for officer dashboard */
export async function getIssues() {
  const res = await api.get('/officer/issues');
  return res?.data?.docs || res?.data || res?.docs || [];
}

/** GET single issue by id */
export async function getIssueById(id) {
  const res = await api.get(`/officer/issues/${id}`);
  return res?.data?.issue || res?.issue || res;
}

/** PATCH issue status */
export async function updateIssueStatus(id, status, note) {
  const res = await api.patch(`/officer/issues/${id}/status`, { status, note });
  return res?.data || res;
}

/** DELETE issue */
export async function deleteIssue(id) {
  const res = await api.delete(`/officer/issues/${id}`);
  return res?.data || res;
}
