import api from './api';

/** GET all duplicate groups */
export async function getDuplicateGroups() {
  const res = await api.get('/officer/duplicates');
  return res?.data?.groups || res?.groups || res?.data || [];
}

/** POST merge selected duplicates into primary */
export async function mergeDuplicates(primaryId, dupIds) {
  const res = await api.post('/officer/duplicates/merge', { primaryId, dupIds });
  return res?.data || res;
}
