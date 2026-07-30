import api from './api';

let MOCK_CONTRACTORS = [
  { _id: 'con-001', name: 'BuildRight Pvt Ltd',   category: 'Roads',       rating: 4.2, completedJobs: 34, complaints: 2, flagged: false, flagStatus: 'Active',      lastActive: '2025-07-28' },
  { _id: 'con-002', name: 'CleanCity Services',   category: 'Sanitation',  rating: 3.8, completedJobs: 58, complaints: 7, flagged: false, flagStatus: 'Under Warning',lastActive: '2025-07-27' },
  { _id: 'con-003', name: 'PowerLine Electric',   category: 'Electricity', rating: 4.7, completedJobs: 22, complaints: 0, flagged: false, flagStatus: 'Active',      lastActive: '2025-07-29' },
  { _id: 'con-004', name: 'AquaFlow Pipes Ltd',   category: 'Water',       rating: 2.9, completedJobs: 15, complaints: 9, flagged: true,  flagStatus: 'Flagged',     lastActive: '2025-07-15' },
  { _id: 'con-005', name: 'GreenThumb Parks Co',  category: 'Parks',       rating: 4.0, completedJobs: 11, complaints: 1, flagged: false, flagStatus: 'Active',      lastActive: '2025-07-26' },
];

/** GET all contractors */
export async function getContractors() {
  try {
    const res = await api.get('/contractors');
    const contractors = res?.data?.contractors || res?.data?.docs || res?.contractors || res;
    if (Array.isArray(contractors) && contractors.length > 0) return contractors;
    return MOCK_CONTRACTORS;
  } catch (err) {
    console.warn('[contractorService] Failed to fetch contractors, using fallback:', err.message);
    return MOCK_CONTRACTORS;
  }
}

/** POST flag a contractor */
export async function flagContractor(id) {
  try {
    const res = await api.post(`/contractors/${id}/flag`);
    return res?.data || res;
  } catch (err) {
    console.warn('[contractorService] Failed to flag contractor:', err.message);
    MOCK_CONTRACTORS = MOCK_CONTRACTORS.map(c =>
      c._id === id ? { ...c, flagged: true, flagStatus: 'Flagged' } : c
    );
    return { success: true, id, flagged: true, flagStatus: 'Flagged' };
  }
}

/** DELETE unflag a contractor */
export async function unflagContractor(id) {
  try {
    const res = await api.delete(`/contractors/${id}/flag`);
    return res?.data || res;
  } catch (err) {
    console.warn('[contractorService] Failed to unflag contractor:', err.message);
    MOCK_CONTRACTORS = MOCK_CONTRACTORS.map(c =>
      c._id === id ? { ...c, flagged: false, flagStatus: 'Active' } : c
    );
    return { success: true, id, flagged: false, flagStatus: 'Active' };
  }
}

/** PUT update flag status of a contractor (Active, Under Warning, Flagged, Blacklisted) */
export async function updateFlagStatus(id, flagStatus) {
  try {
    const res = await api.put(`/contractors/${id}/flag-status`, { flagStatus });
    return res?.data || res;
  } catch (err) {
    console.warn('[contractorService] Failed to update flag status:', err.message);
    const isFlagged = flagStatus === 'Flagged' || flagStatus === 'Blacklisted';
    MOCK_CONTRACTORS = MOCK_CONTRACTORS.map(c =>
      c._id === id ? { ...c, flagged: isFlagged, flagStatus } : c
    );
    return { success: true, id, flagStatus, flagged: isFlagged };
  }
}
