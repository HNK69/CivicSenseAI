import api from './api';

const MOCK_FINDINGS = [
  { _id: 'ai-001', issueId: 'iss-001', category: 'Roads',    severity: 'HIGH',     summary: 'AI detected pothole cluster — 4 reports in 200m radius. Likely cause: heavy vehicle overload.', confidence: 0.92, suggestedAction: 'Deploy road repair crew Zone-A', createdAt: '2025-07-25T10:00:00Z' },
  { _id: 'ai-002', issueId: 'iss-003', category: 'Sanitation', severity: 'CRITICAL', summary: 'Garbage accumulation detected for 5+ days. Health risk elevated. Possible civic holiday delay.', confidence: 0.88, suggestedAction: 'Emergency sanitation sweep Ward 7B', createdAt: '2025-07-25T11:30:00Z' },
  { _id: 'ai-003', issueId: 'iss-002', category: 'Electricity', severity: 'MEDIUM', summary: 'Single streetlight outage. No cluster pattern. Likely bulb/fuse failure.', confidence: 0.78, suggestedAction: 'Schedule routine maintenance visit', createdAt: '2025-07-24T09:00:00Z' },
];

/** GET AI investigation findings */
export async function getFindings() {
  try {
    const res = await api.get('/officer/ai/findings');
    const findings = res?.data?.findings || res?.findings || res;
    if (Array.isArray(findings) && findings.length > 0) return findings;
    return MOCK_FINDINGS;
  } catch (err) {
    console.warn('[aiInvestigationService] Failed to fetch AI findings, using fallback:', err.message);
    return MOCK_FINDINGS;
  }
}

/** POST trigger AI re-analysis for an issue */
export async function triggerAnalysis(issueId) {
  try {
    const res = await api.post(`/officer/issues/${issueId}/investigate`);
    return res?.data || res;
  } catch (err) {
    console.warn('[aiInvestigationService] Failed to trigger AI analysis:', err.message);
    return { success: false, error: err.message };
  }
}
