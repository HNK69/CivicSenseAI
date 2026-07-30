import api from '../utils/axiosInstance.js';

/** Get all notifications for the logged-in citizen */
export const getNotifications = async () => {
  const res = await api.get('/notifications');
  return res?.data?.notifications || res?.notifications || res?.data?.docs || res?.docs || res || [];
};

/** Mark a single notification as read */
export const markNotificationRead = async (id) => {
  const res = await api.patch(`/notifications/${id}/read`);
  return res?.data || res || { success: true };
};

/** Mark all notifications as read */
export const markAllNotificationsRead = async () => {
  const res = await api.patch('/notifications/mark-all-read');
  return res?.data || res || { success: true };
};
