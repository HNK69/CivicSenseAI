import api from './api';

/** GET all work orders */
export async function getWorkOrders() {
  const res = await api.get('/officer/work-orders');
  return res?.data?.docs || res?.docs || res?.data?.workOrders || res?.data || [];
}

/** POST assign a work order to a department/contractor */
export async function assignWorkOrder(issueId, department, contractorId, notes) {
  const res = await api.post('/officer/work-orders', { issueId, department, contractorId, notes });
  return res?.data || res;
}

/** PATCH update work order status */
export async function updateWorkOrderStatus(id, status) {
  const res = await api.patch(`/officer/work-orders/${id}`, { status });
  return res?.data || res;
}
