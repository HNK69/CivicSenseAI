// import api from './api';

const MOCK_REPAIRS = [
  {
    _id: 'rep-001', issueId: 'iss-001', title: 'Pothole Repair — MG Road',
    status: 'PENDING_VERIFICATION',
    beforeImage: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=400&q=80',
    afterImage:  'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?w=400&q=80',
    contractor: 'BuildRight Pvt Ltd', completedAt: '2025-07-28T15:00:00Z',
  },
  {
    _id: 'rep-002', issueId: 'iss-003', title: 'Garbage Clearance — Ward 7B',
    status: 'VERIFIED',
    beforeImage: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&q=80',
    afterImage:  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    contractor: 'CleanCity Services', completedAt: '2025-07-27T10:00:00Z',
  },
  {
    _id: 'rep-003', issueId: 'iss-002', title: 'Streetlight Fix — Gandhi Nagar',
    status: 'PENDING_VERIFICATION',
    beforeImage: 'https://images.unsplash.com/photo-1610555356070-d0efdeaa8a8d?w=400&q=80',
    afterImage:  'https://images.unsplash.com/photo-1501699169021-3759ee435d66?w=400&q=80',
    contractor: 'PowerLine Electric', completedAt: '2025-07-29T08:00:00Z',
  },
];

/** GET all repair verification records. TODO: return api.get('/repairs') */
export async function getRepairs()                  { return Promise.resolve(MOCK_REPAIRS); }

/** POST verify/reject a repair. TODO: return api.post(`/repairs/${id}/verify`, { verdict }) */
export async function verifyRepair(id, verdict)     { return Promise.resolve({ success: true, id, verdict }); }
