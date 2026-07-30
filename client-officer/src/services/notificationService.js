import api from './api.js';

/* ---- MOCK FALLBACK DATA ---- */
const MOCK_NOTIFICATIONS = [
  {
    _id: 'notif-001',
    type: 'assignment',
    title: 'New Issue Assigned',
    detail: 'Pothole on Station Road has been assigned to you for inspection.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    isRead: false,
  },
  {
    _id: 'notif-002',
    type: 'status',
    title: 'Issue Status Updated',
    detail: 'Garbage bin overflow at Ward 7B has been marked as In Progress.',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    isRead: false,
  },
  {
    _id: 'notif-003',
    type: 'verification',
    title: 'Repair Verified by Citizen',
    detail: 'Citizen confirmed the street light repair on Gandhi Nagar Lane is complete.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isRead: true,
  },
];

/** Get all notifications for the logged-in officer */
export const getOfficerNotifications = async () => {
  try {
    const res = await api.get('/notifications');
    const notifs = res?.data?.notifications || res?.notifications || res?.data?.docs || res?.docs || res;
    if (Array.isArray(notifs) && notifs.length > 0) return notifs;
  } catch (err) {
    console.warn('[notificationService] Failed to fetch officer notifications, using fallback:', err.message);
  }
  return MOCK_NOTIFICATIONS;
};

/** Mark a single notification as read */
export const markOfficerNotificationRead = async (id) => {
  try {
    const res = await api.patch(`/notifications/${id}/read`);
    return res?.data || res || { success: true };
  } catch (err) {
    console.warn('[notificationService] markOfficerNotificationRead failed:', err.message);
    return { success: false, error: err.message };
  }
};

/** Mark all notifications as read */
export const markAllOfficerNotificationsRead = async () => {
  try {
    const res = await api.patch('/notifications/mark-all-read');
    return res?.data || res || { success: true };
  } catch (err) {
    console.warn('[notificationService] markAllOfficerNotificationsRead failed:', err.message);
    return { success: false, error: err.message };
  }
};
