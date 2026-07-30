import api from './api';

const MOCK_WORK_ORDERS = [
  { _id: 'wo-001', issueId: 'iss-001', issueTitle: 'Pothole on MG Road',        department: 'PWD',    assignedTo: 'Rajiv Sharma',   status: 'PENDING',     dueDate: '2025-08-05' },
  { _id: 'wo-002', issueId: 'iss-003', issueTitle: 'Garbage not collected',      department: 'SANIT',  assignedTo: 'Meena Devi',     status: 'IN_PROGRESS', dueDate: '2025-07-31' },
  { _id: 'wo-003', issueId: 'iss-002', issueTitle: 'Broken streetlight',         department: 'ELEC',   assignedTo: 'Unassigned',     status: 'PENDING',     dueDate: '2025-08-02' },
  { _id: 'wo-004', issueId: 'iss-005', issueTitle: 'Fallen tree blocking road',  department: 'ROADS',  assignedTo: 'Abdul Wahab',    status: 'IN_PROGRESS', dueDate: '2025-07-30' },
];

/** GET all work orders (CRIT-1 fix: /officer/work-orders) */
export async function getWorkOrders() {
  try {
    const res = await api.get('/officer/work-orders');
    const docs = res?.data?.docs || res?.data || res?.docs || res?.workOrders || res;
    if (Array.isArray(docs) && docs.length > 0) return docs;
    return MOCK_WORK_ORDERS;
  } catch (err) {
    console.warn('[assignService] Failed to fetch work orders, using fallback:', err.message);
    return MOCK_WORK_ORDERS;
  }
}

/** POST assign a work order to a department/officer */
export async function assignWorkOrder(issueId, department, officerId) {
  try {
    const res = await api.patch(`/officer/issues/${issueId}/assign`, { department, officerId });
    return res?.data || res;
  } catch (err) {
    console.warn('[assignService] Failed to assign work order:', err.message);
    return { success: false, error: err.message };
  }
}

/** PATCH update work order status (CRIT-2 fix: /officer/work-orders/:id) */
export async function updateWorkOrderStatus(id, status) {
  try {
    const res = await api.patch(`/officer/work-orders/${id}`, { status });
    return res?.data || res;
  } catch (err) {
    console.warn('[assignService] Failed to update work order status:', err.message);
    return { success: false, error: err.message };
  }
}
