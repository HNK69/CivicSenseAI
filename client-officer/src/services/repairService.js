import api from './api';

/** GET all repair verification records */
export async function getRepairs() {
  const res = await api.get('/officer/repairs');
  return res?.data?.repairs || res?.data?.docs || res?.data || res?.repairs || [];
}

/** POST verify/reject a repair using AI verify-repair endpoint */
export async function verifyRepair(id, verdict) {
  const res = await api.post(`/officer/repairs/${id}/verify`, { verdict });
  return res?.data || res;
}
