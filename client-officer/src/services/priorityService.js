import api from './api';

const MOCK_RANKED = [
  { _id: 'iss-003', title: 'Garbage not collected — Ward 7B',          priority: 'CRITICAL', score: 97, upvotes: 41, daysOpen: 6, category: 'Sanitation' },
  { _id: 'iss-001', title: 'Pothole on MG Road near Bus Stop 12',       priority: 'HIGH',     score: 84, upvotes: 23, daysOpen: 10, category: 'Roads' },
  { _id: 'iss-004', title: 'Water supply disruption — Block C',         priority: 'HIGH',     score: 78, upvotes: 19, daysOpen: 12, category: 'Water' },
  { _id: 'iss-005', title: 'Fallen tree blocking road',                 priority: 'HIGH',     score: 72, upvotes: 8,  daysOpen: 5,  category: 'Roads' },
  { _id: 'iss-002', title: 'Broken streetlight — Gandhi Nagar Lane 4',  priority: 'MEDIUM',   score: 55, upvotes: 14, daysOpen: 8,  category: 'Electricity' },
];

/** GET priority-ranked issues */
export async function getPrioritizedIssues() {
  try {
    const res = await api.get('/officer/issues/prioritized');
    const issues = res?.data?.issues || res?.issues || res;
    if (Array.isArray(issues) && issues.length > 0) return issues;
    return MOCK_RANKED;
  } catch (err) {
    console.warn('[priorityService] Failed to fetch prioritized issues, using fallback:', err.message);
    return MOCK_RANKED;
  }
}

/** PATCH override priority for an issue */
export async function overridePriority(id, priority) {
  try {
    const res = await api.patch(`/officer/issues/${id}/priority`, { priority });
    return res?.data || res;
  } catch (err) {
    console.warn('[priorityService] Failed to override priority:', err.message);
    return { success: false, error: err.message };
  }
}
