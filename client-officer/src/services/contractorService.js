import api from './api';

/** GET all contractors */
export async function getContractors() {
  const res = await api.get('/officer/contractors');
  return res?.data?.contractors || res?.data?.docs || res?.data || res?.contractors || [];
}

/** POST flag a contractor */
export async function flagContractor(id) {
  const res = await api.post(`/officer/contractors/${id}/flag`);
  return res?.data || res;
}

/** DELETE unflag a contractor */
export async function unflagContractor(id) {
  const res = await api.delete(`/officer/contractors/${id}/flag`);
  return res?.data || res;
}

/** PUT update flag status of a contractor */
export async function updateFlagStatus(id, flagStatus) {
  const res = await api.put(`/officer/contractors/${id}/flag-status`, { flagStatus });
  return res?.data || res;
}
