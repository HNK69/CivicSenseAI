import api from '../utils/axiosInstance.js';

/**
 * notificationService.js — Citizen notification API calls.
 * axiosInstance interceptor returns response.data,
 * so `res` here is the server JSON body.
 * paginated() → { success, data: [...notifications], pagination }
 * success()   → { success, message, data: { ... } }
 */

/** Get all notifications for the logged-in citizen */
export const getNotifications = async () => {
  try {
    const res = await api.get('/notifications');
    // paginated response: res = { success, data: [...], pagination }
    return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (err) {
    console.warn('[notificationService] getNotifications failed:', err?.response?.status, err?.message);
    return [];
  }
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
