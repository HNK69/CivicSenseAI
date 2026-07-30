import api from './api';

/** GET all work orders */
export async function getWorkOrders() {
  const res = await api.get('/officer/work-orders');
  return res?.data?.docs || res?.data || res?.docs || res?.workOrders || [];
}

/** POST assign a work order to a department/officer */
export async function assignWorkOrder(issueId, department, officerId) {
  const res = await api.patch(`/officer/issues/${issueId}/assign`, { department, officerId });
  return res?.data || res;
}

/** PATCH update work order status */
export async function updateWorkOrderStatus(id, status) {
  const res = await api.patch(`/officer/work-orders/${id}`, { status });
  return res?.data || res;
}
