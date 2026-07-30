// import api from './api'; // Uncomment when backend is ready

const MOCK_ISSUES = [
  { _id: 'iss-001', title: 'Pothole on MG Road near Bus Stop 12', category: 'Roads',    status: 'OPEN',        priority: 'HIGH',     location: { address: 'MG Road, Sector 5' },      reportedBy: 'citizen-001', upvotes: 23, createdAt: '2025-07-20T09:00:00Z' },
  { _id: 'iss-002', title: 'Broken streetlight — Gandhi Nagar Lane 4', category: 'Electricity', status: 'IN_PROGRESS', priority: 'MEDIUM',   location: { address: 'Gandhi Nagar, Lane 4' },   reportedBy: 'citizen-002', upvotes: 14, createdAt: '2025-07-22T11:00:00Z' },
  { _id: 'iss-003', title: 'Garbage not collected — Ward 7B',  category: 'Sanitation', status: 'OPEN',        priority: 'CRITICAL', location: { address: 'Ward 7B, Sector 11' },      reportedBy: 'citizen-003', upvotes: 41, createdAt: '2025-07-24T08:30:00Z' },
  { _id: 'iss-004', title: 'Water supply disruption — Block C', category: 'Water',     status: 'RESOLVED',    priority: 'HIGH',     location: { address: 'Block C, Anand Colony' },  reportedBy: 'citizen-004', upvotes: 19, createdAt: '2025-07-18T07:00:00Z' },
  { _id: 'iss-005', title: 'Fallen tree blocking road',         category: 'Roads',     status: 'IN_PROGRESS', priority: 'HIGH',     location: { address: 'Park Road, Near School' }, reportedBy: 'citizen-005', upvotes: 8,  createdAt: '2025-07-25T14:00:00Z' },
];

/** GET all issues. TODO: return api.get('/issues') */
export async function getIssues()        { return Promise.resolve(MOCK_ISSUES); }

/** GET single issue by id. TODO: return api.get(`/issues/${id}`) */
export async function getIssueById(id)   { return Promise.resolve(MOCK_ISSUES.find(i => i._id === id) || null); }

/** PATCH issue status. TODO: return api.patch(`/issues/${id}/status`, { status }) */
export async function updateIssueStatus(id, status) { return Promise.resolve({ success: true, id, status }); }

/** DELETE issue. TODO: return api.delete(`/issues/${id}`) */
export async function deleteIssue(id)   { return Promise.resolve({ success: true, id }); }
