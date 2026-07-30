// import api from './api';

const MOCK_WORK_ORDERS = [
  { _id: 'wo-001', issueId: 'iss-001', issueTitle: 'Pothole on MG Road',        department: 'PWD',    assignedTo: 'Rajiv Sharma',   status: 'PENDING',     dueDate: '2025-08-05' },
  { _id: 'wo-002', issueId: 'iss-003', issueTitle: 'Garbage not collected',      department: 'SANIT',  assignedTo: 'Meena Devi',     status: 'IN_PROGRESS', dueDate: '2025-07-31' },
  { _id: 'wo-003', issueId: 'iss-002', issueTitle: 'Broken streetlight',         department: 'ELEC',   assignedTo: 'Unassigned',     status: 'PENDING',     dueDate: '2025-08-02' },
  { _id: 'wo-004', issueId: 'iss-005', issueTitle: 'Fallen tree blocking road',  department: 'ROADS',  assignedTo: 'Abdul Wahab',    status: 'IN_PROGRESS', dueDate: '2025-07-30' },
];

/** GET all work orders. TODO: return api.get('/work-orders') */
export async function getWorkOrders()                            { return Promise.resolve(MOCK_WORK_ORDERS); }

/** POST assign a work order to a department/officer. TODO: return api.post('/work-orders', payload) */
export async function assignWorkOrder(issueId, dept, assignedTo) { return Promise.resolve({ success: true, issueId, dept, assignedTo }); }

/** PATCH update work order status. TODO: return api.patch(`/work-orders/${id}`, { status }) */
export async function updateWorkOrderStatus(id, status)          { return Promise.resolve({ success: true, id, status }); }
