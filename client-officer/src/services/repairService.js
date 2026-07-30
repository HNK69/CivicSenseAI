import api from './api';

const MOCK_REPAIRS = [
  {
    _id: 'rep-001', issueId: 'iss-001', title: 'Pothole Repair — MG Road',
    status: 'PENDING_VERIFICATION',
    beforeImage: { url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=400&q=80' },
    afterImage:  { url: 'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?w=400&q=80' },
    contractor: 'BuildRight Pvt Ltd', completedAt: '2025-07-28T15:00:00Z',
  },
  {
    _id: 'rep-002', issueId: 'iss-003', title: 'Garbage Clearance — Ward 7B',
    status: 'VERIFIED',
    beforeImage: { url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&q=80' },
    afterImage:  { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80' },
    contractor: 'CleanCity Services', completedAt: '2025-07-27T10:00:00Z',
  },
  {
    _id: 'rep-003', issueId: 'iss-002', title: 'Streetlight Fix — Gandhi Nagar',
    status: 'PENDING_VERIFICATION',
    beforeImage: { url: 'https://images.unsplash.com/photo-1610555356070-d0efdeaa8a8d?w=400&q=80' },
    afterImage:  { url: 'https://images.unsplash.com/photo-1501699169021-3759ee435d66?w=400&q=80' },
    contractor: 'PowerLine Electric', completedAt: '2025-07-29T08:00:00Z',
  },
];

/** GET all repair verification records */
export async function getRepairs() {
  try {
    const res = await api.get('/work-orders/repairs');
    const docs = res?.data?.repairs || res?.data?.docs || res?.repairs || res?.docs || res;
    if (Array.isArray(docs) && docs.length > 0) return docs;
    return MOCK_REPAIRS;
  } catch (err) {
    console.warn('[repairService] Failed to fetch repairs, using fallback:', err.message);
    return MOCK_REPAIRS;
  }
}

/** POST verify/reject a repair using AI verify-repair endpoint */
export async function verifyRepair(id, verdict) {
  try {
    const res = await api.post(`/officer/repairs/${id}/verify`, { verdict });
    return res?.data || res;
  } catch (err) {
    console.warn('[repairService] Failed to verify repair:', err.message);
    return { success: false, error: err.response?.data?.message || err.message };
  }
}
