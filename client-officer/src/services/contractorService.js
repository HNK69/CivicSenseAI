// import api from './api';

const MOCK_CONTRACTORS = [
  { _id: 'con-001', name: 'BuildRight Pvt Ltd',   category: 'Roads',       rating: 4.2, completedJobs: 34, complaints: 2, flagged: false, lastActive: '2025-07-28' },
  { _id: 'con-002', name: 'CleanCity Services',   category: 'Sanitation',  rating: 3.8, completedJobs: 58, complaints: 7, flagged: false, lastActive: '2025-07-27' },
  { _id: 'con-003', name: 'PowerLine Electric',   category: 'Electricity', rating: 4.7, completedJobs: 22, complaints: 0, flagged: false, lastActive: '2025-07-29' },
  { _id: 'con-004', name: 'AquaFlow Pipes Ltd',   category: 'Water',       rating: 2.9, completedJobs: 15, complaints: 9, flagged: true,  lastActive: '2025-07-15' },
  { _id: 'con-005', name: 'GreenThumb Parks Co',  category: 'Parks',       rating: 4.0, completedJobs: 11, complaints: 1, flagged: false, lastActive: '2025-07-26' },
];

/** GET all contractors. TODO: return api.get('/contractors') */
export async function getContractors()              { return Promise.resolve(MOCK_CONTRACTORS); }

/** POST flag a contractor. TODO: return api.post(`/contractors/${id}/flag`) */
export async function flagContractor(id)            { return Promise.resolve({ success: true, id, flagged: true }); }

/** DELETE unflag a contractor. TODO: return api.delete(`/contractors/${id}/flag`) */
export async function unflagContractor(id)          { return Promise.resolve({ success: true, id, flagged: false }); }
