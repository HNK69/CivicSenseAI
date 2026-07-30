import api from './api';

const MOCK_ISSUES = [
  { _id: 'iss-001', title: 'Pothole on MG Road near Bus Stop 12', category: 'Roads',    status: 'reported', priority: 'HIGH',     location: { address: 'MG Road, Sector 5' },      reportedBy: 'citizen-001', upvotes: 23, createdAt: '2025-07-20T09:00:00Z' },
  { _id: 'iss-002', title: 'Broken streetlight — Gandhi Nagar Lane 4', category: 'Electricity', status: 'in_progress', priority: 'MEDIUM',   location: { address: 'Gandhi Nagar, Lane 4' },   reportedBy: 'citizen-002', upvotes: 14, createdAt: '2025-07-22T11:00:00Z' },
  { _id: 'iss-003', title: 'Garbage not collected — Ward 7B',  category: 'Sanitation', status: 'reported', priority: 'CRITICAL', location: { address: 'Ward 7B, Sector 11' },      reportedBy: 'citizen-003', upvotes: 41, createdAt: '2025-07-24T08:30:00Z' },
  { _id: 'iss-004', title: 'Water supply disruption — Block C', category: 'Water',     status: 'resolved', priority: 'HIGH',     location: { address: 'Block C, Anand Colony' },  reportedBy: 'citizen-004', upvotes: 19, createdAt: '2025-07-18T07:00:00Z' },
  { _id: 'iss-005', title: 'Fallen tree blocking road',         category: 'Roads',     status: 'in_progress', priority: 'HIGH',     location: { address: 'Park Road, Near School' }, reportedBy: 'citizen-005', upvotes: 8,  createdAt: '2025-07-25T14:00:00Z' },
];

/** GET all issues from real backend with fallback */
export async function getIssues() {
  try {
    const res = await api.get('/officer/issues');
    const docs = res?.data?.docs || res?.docs || res?.issues || res;
    if (Array.isArray(docs) && docs.length > 0) return docs;
    return MOCK_ISSUES;
  } catch (err) {
    console.warn('[issueService] Backend issue fetch failed, using fallback:', err.message);
    return MOCK_ISSUES;
  }
}

/** GET single issue by id */
export async function getIssueById(id) {
  try {
    const res = await api.get(`/officer/issues/${id}`);
    const issue = res?.data?.issue || res?.issue || res;
    if (issue && issue._id) return issue;
    return MOCK_ISSUES.find(i => i._id === id) || null;
  } catch (err) {
    console.warn('[issueService] Backend fetch issue by ID failed:', err.message);
    return MOCK_ISSUES.find(i => i._id === id) || null;
  }
}

/** PATCH issue status */
export async function updateIssueStatus(id, status, note) {
  try {
    const res = await api.patch(`/officer/issues/${id}/status`, { status, note });
    return res?.data || res;
  } catch (err) {
    console.warn('[issueService] Backend status update failed:', err.message);
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

/** DELETE issue */
export async function deleteIssue(id) {
  try {
    const res = await api.delete(`/issues/${id}`);
    return res?.data || res;
  } catch (err) {
    console.warn('[issueService] Backend delete issue failed:', err.message);
    return { success: false, error: err.message };
  }
}
