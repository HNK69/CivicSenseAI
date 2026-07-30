import api from './api.js';

/* ---- MOCK DATA (remove when backend is ready) ---- */
const MOCK_NOTIFICATIONS = [
  {
    id: 'notif-001',
    type: 'assignment',
    title: 'New Issue Assigned',
    detail: 'Pothole on Station Road has been assigned to you for inspection.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    read: false,
  },
  {
    id: 'notif-002',
    type: 'status',
    title: 'Issue Status Updated',
    detail: 'Garbage bin overflow at Ward 7B has been marked as In Progress.',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    read: false,
  },
  {
    id: 'notif-003',
    type: 'verification',
    title: 'Repair Verified by Citizen',
    detail: 'Citizen confirmed the street light repair on Gandhi Nagar Lane is complete.',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    read: true,
  },
];

/**
 * notificationService.js — Officer notification API calls.
 * TODO: replace mock returns with real API calls once backend is ready.
 */

/** Get all notifications for the logged-in officer */
export const getOfficerNotifications = async () => {
  // TODO: connect to backend endpoint — GET /api/officer/notifications
  // const res = await api.get('/officer/notifications');
  // return res.data.data;
  return MOCK_NOTIFICATIONS;
};

/** Mark a single notification as read */
export const markOfficerNotificationRead = async (id) => {
  // TODO: connect to backend endpoint — PATCH /api/officer/notifications/:id/read
  // return api.patch(`/officer/notifications/${id}/read`);
  console.log('[MOCK] markOfficerNotificationRead', id);
  return { success: true };
};

/** Mark all notifications as read */
export const markAllOfficerNotificationsRead = async () => {
  // TODO: connect to backend endpoint — PATCH /api/officer/notifications/mark-all-read
  // return api.patch('/officer/notifications/mark-all-read');
  console.log('[MOCK] markAllOfficerNotificationsRead');
  return { success: true };
};
