// import api from './api';

const MOCK_FINDINGS = [
  { _id: 'ai-001', issueId: 'iss-001', category: 'Roads',    severity: 'HIGH',     summary: 'AI detected pothole cluster — 4 reports in 200m radius. Likely cause: heavy vehicle overload.', confidence: 0.92, suggestedAction: 'Deploy road repair crew Zone-A', createdAt: '2025-07-25T10:00:00Z' },
  { _id: 'ai-002', issueId: 'iss-003', category: 'Sanitation', severity: 'CRITICAL', summary: 'Garbage accumulation detected for 5+ days. Health risk elevated. Possible civic holiday delay.', confidence: 0.88, suggestedAction: 'Emergency sanitation sweep Ward 7B', createdAt: '2025-07-25T11:30:00Z' },
  { _id: 'ai-003', issueId: 'iss-002', category: 'Electricity', severity: 'MEDIUM', summary: 'Single streetlight outage. No cluster pattern. Likely bulb/fuse failure.', confidence: 0.78, suggestedAction: 'Schedule routine maintenance visit', createdAt: '2025-07-24T09:00:00Z' },
];

/** GET AI investigation findings. TODO: return api.get('/ai/findings') */
export async function getFindings()              { return Promise.resolve(MOCK_FINDINGS); }

/** POST trigger AI re-analysis for an issue. TODO: return api.post(`/ai/analyze/${issueId}`) */
export async function triggerAnalysis(issueId)   { return Promise.resolve({ success: true, issueId, message: 'Analysis queued' }); }
