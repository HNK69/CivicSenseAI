import api from './api';

const MOCK_GROUPS = [
  { _id: 'dup-grp-001', primaryIssueId: 'iss-001', duplicates: [
    { _id: 'dup-001', title: 'Big hole on MG Road bus stop', reportedBy: 'citizen-010', createdAt: '2025-07-21T08:00:00Z', upvotes: 5 },
    { _id: 'dup-002', title: 'Road damage near stop 12 MG Road', reportedBy: 'citizen-015', createdAt: '2025-07-21T14:00:00Z', upvotes: 3 },
  ]},
  { _id: 'dup-grp-002', primaryIssueId: 'iss-003', duplicates: [
    { _id: 'dup-003', title: 'No garbage pickup Ward 7', reportedBy: 'citizen-022', createdAt: '2025-07-23T07:00:00Z', upvotes: 12 },
  ]},
];

/** GET all duplicate groups */
export async function getDuplicateGroups() {
  try {
    const res = await api.get('/officer/duplicates');
    const groups = res?.data?.groups || res?.groups || res;
    if (Array.isArray(groups) && groups.length > 0) return groups;
    return MOCK_GROUPS;
  } catch (err) {
    console.warn('[duplicateService] Failed to fetch duplicates, using fallback:', err.message);
    return MOCK_GROUPS;
  }
}

/** POST merge selected duplicates into primary */
export async function mergeDuplicates(primaryId, dupIds) {
  try {
    const res = await api.post('/officer/duplicates/merge', { primaryId, dupIds });
    return res?.data || res;
  } catch (err) {
    console.warn('[duplicateService] Failed to merge duplicates:', err.message);
    return { success: false, error: err.message };
  }
}
