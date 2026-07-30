import api from './api.js';

/** Get all notifications for the logged-in officer */
export const getOfficerNotifications = async () => {
  const res = await api.get('/notifications');
  return res?.data?.notifications || res?.notifications || res?.data?.docs || res?.docs || res || [];
};

/** Mark a single notification as read */
export const markOfficerNotificationRead = async (id) => {
  const res = await api.patch(`/notifications/${id}/read`);
  return res?.data || res || { success: true };
};

/** Mark all notifications as read */
export const markAllOfficerNotificationsRead = async () => {
  const res = await api.patch('/notifications/mark-all-read');
  return res?.data || res || { success: true };
};
