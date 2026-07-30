import api from '../utils/axiosInstance.js';

/* ---- MOCK FALLBACK DATA ---- */
const MOCK_NOTIFICATIONS = [
  {
    _id: 'N001',
    type: 'status_update',
    icon: 'bi-arrow-repeat',
    iconBg: '#dbeafe',
    iconColor: '#1a56db',
    title: 'Your issue ISS-2401 is now In Progress',
    detail: 'Officials have started working on "Pothole on MG Road".',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    isRead: false,
    issueId: 'ISS-2401',
  },
  {
    _id: 'N002',
    type: 'verify_request',
    icon: 'bi-check-circle-fill',
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    title: 'Please verify repair for ISS-2380',
    detail: '"Overflowing garbage bin" has been marked as completed. Please confirm.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isRead: false,
    issueId: 'ISS-2380',
  },
  {
    _id: 'N003',
    type: 'upvote',
    icon: 'bi-hand-thumbs-up-fill',
    iconBg: '#fef9c3',
    iconColor: '#ca8a04',
    title: '5 citizens upvoted your issue',
    detail: '"Water pipe leakage" is gaining community attention.',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    isRead: true,
    issueId: 'ISS-2392',
  },
];

/** Get all notifications for the logged-in citizen */
export const getNotifications = async () => {
  try {
    const res = await api.get('/notifications');
    const notifs = res?.data?.notifications || res?.notifications || res?.data?.docs || res?.docs || res;
    if (Array.isArray(notifs) && notifs.length > 0) return notifs;
  } catch (err) {
    console.warn('[notificationService] Failed to fetch citizen notifications, using fallback:', err.message);
  }
  return MOCK_NOTIFICATIONS;
};

/** Mark a single notification as read */
export const markNotificationRead = async (id) => {
  try {
    const res = await api.patch(`/notifications/${id}/read`);
    return res?.data || res || { success: true };
  } catch (err) {
    console.warn('[notificationService] markNotificationRead failed:', err.message);
    return { success: false, error: err.message };
  }
};

/** Mark all notifications as read */
export const markAllNotificationsRead = async () => {
  try {
    const res = await api.patch('/notifications/mark-all-read');
    return res?.data || res || { success: true };
  } catch (err) {
    console.warn('[notificationService] markAllNotificationsRead failed:', err.message);
    return { success: false, error: err.message };
  }
};
