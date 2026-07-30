// import api from './api';

const MOCK_GROUPS = [
  { _id: 'dup-grp-001', primaryIssueId: 'iss-001', duplicates: [
    { _id: 'dup-001', title: 'Big hole on MG Road bus stop', reportedBy: 'citizen-010', createdAt: '2025-07-21T08:00:00Z', upvotes: 5 },
    { _id: 'dup-002', title: 'Road damage near stop 12 MG Road', reportedBy: 'citizen-015', createdAt: '2025-07-21T14:00:00Z', upvotes: 3 },
  ]},
  { _id: 'dup-grp-002', primaryIssueId: 'iss-003', duplicates: [
    { _id: 'dup-003', title: 'No garbage pickup Ward 7', reportedBy: 'citizen-022', createdAt: '2025-07-23T07:00:00Z', upvotes: 12 },
  ]},
];

/** GET all duplicate groups. TODO: return api.get('/duplicates') */
export async function getDuplicateGroups()              { return Promise.resolve(MOCK_GROUPS); }

/** POST merge selected duplicates into primary. TODO: return api.post('/duplicates/merge', payload) */
export async function mergeDuplicates(primaryId, dupIds) { return Promise.resolve({ success: true, primaryId, mergedCount: dupIds.length }); }
