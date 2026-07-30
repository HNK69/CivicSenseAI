import api from '../utils/axiosInstance.js';

/* ---- MOCK DATA (remove when backend is ready) ---- */
const MOCK_ISSUES = [
  {
    id: 'ISS-2401',
    category: 'roads',
    title: 'Pothole on Station Road',
    description: 'Large pothole near the traffic signal causing accidents.',
    status: 'in-progress',
    severity: 'high',
    location: { lat: 15.1394, lng: 76.9214, address: 'Station Road, Ballari' },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    mediaUrl: null,
  },
  {
    id: 'ISS-2392',
    category: 'water',
    title: 'Water pipe leakage',
    description: 'Pipe burst on 5th cross, water wasting.',
    status: 'pending',
    severity: 'medium',
    location: { lat: 15.1400, lng: 76.9200, address: '5th Cross, Gandhi Nagar, Ballari' },
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    mediaUrl: null,
  },
  {
    id: 'ISS-2380',
    category: 'sanitation',
    title: 'Overflowing garbage bin',
    description: 'The garbage bin at park entrance has not been cleared for 5 days.',
    status: 'completed',
    severity: 'low',
    location: { lat: 15.1350, lng: 76.9250, address: 'Infantry Road, Ballari' },
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    mediaUrl: null,
  },
];

/**
 * issueService.js — All civic issue reporting API calls.
 * TODO: replace mock returns with real API calls once backend is ready.
 */

/** Submit a new issue report (multipart for file uploads) */
export const reportIssue = async (formData) => {
  // TODO: connect to backend endpoint — POST /api/issues
  // return api.post('/issues', formData, {
  //   headers: { 'Content-Type': 'multipart/form-data' },
  // });
  console.log('[MOCK] reportIssue called with', formData);
  return { success: true, issueId: 'ISS-' + Date.now() };
};

/** Get all issues reported by the logged-in citizen */
export const getMyIssues = async () => {
  // TODO: connect to backend endpoint — GET /api/issues/mine
  // return api.get('/issues/mine');
  return MOCK_ISSUES;
};

/** Get a single issue by ID */
export const getIssueById = async (id) => {
  // TODO: connect to backend endpoint — GET /api/issues/:id
  // return api.get(`/issues/${id}`);
  return MOCK_ISSUES.find(i => i.id === id) || null;
};

/** Delete / retract a submitted issue */
export const deleteIssue = async (id) => {
  // TODO: connect to backend endpoint — DELETE /api/issues/:id
  // return api.delete(`/issues/${id}`);
  console.log('[MOCK] deleteIssue', id);
  return { success: true };
};
