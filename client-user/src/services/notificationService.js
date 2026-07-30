import api from '../utils/axiosInstance.js';

/* ---- MOCK DATA ---- */
const MOCK_NOTIFICATIONS = [
  {
    id: 'N001',
    type: 'status_update',
    icon: 'bi-arrow-repeat',
    iconBg: '#dbeafe',
    iconColor: '#1a56db',
    title: 'Your issue ISS-2401 is now In Progress',
    detail: 'Officials have started working on "Pothole on MG Road".',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    issueId: 'ISS-2401',
  },
  {
    id: 'N002',
    type: 'verify_request',
    icon: 'bi-check-circle-fill',
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    title: 'Please verify repair for ISS-2380',
    detail: '"Overflowing garbage bin" has been marked as completed. Please confirm.',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    read: false,
    issueId: 'ISS-2380',
  },
  {
    id: 'N003',
    type: 'upvote',
    icon: 'bi-hand-thumbs-up-fill',
    iconBg: '#fef9c3',
    iconColor: '#ca8a04',
    title: '5 citizens upvoted your issue',
    detail: '"Water pipe leakage" is gaining community attention.',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    read: true,
    issueId: 'ISS-2392',
  },
  {
    id: 'N004',
    type: 'alert',
    icon: 'bi-exclamation-triangle-fill',
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
    title: 'Severe flooding alert in your ward',
    detail: 'Heavy rainfall advisory issued for Ward 42 by BBMP.',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    read: true,
    issueId: null,
  },
  {
    id: 'N005',
    type: 'status_update',
    icon: 'bi-person-fill-check',
    iconBg: '#f3e8ff',
    iconColor: '#7c3aed',
    title: 'Issue ISS-2355 assigned to Field Officer',
    detail: '"Street light not working" has been assigned to an officer.',
    timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
    read: true,
    issueId: 'ISS-2355',
  },
];

/**
 * notificationService.js — Notification API calls.
 * TODO: connect to real backend endpoints when ready.
 */

/** Get all notifications for the logged-in citizen */
export const getNotifications = async () => {
  // TODO: connect to backend endpoint — GET /api/notifications
  // return api.get('/notifications');
  return MOCK_NOTIFICATIONS;
};

/** Mark a single notification as read */
export const markNotificationRead = async (id) => {
  // TODO: connect to backend endpoint — PATCH /api/notifications/:id/read
  // return api.patch(`/notifications/${id}/read`);
  return { success: true };
};

/** Mark all notifications as read */
export const markAllNotificationsRead = async () => {
  // TODO: connect to backend endpoint — PATCH /api/notifications/mark-all-read
  // return api.patch('/notifications/mark-all-read');
  return { success: true };
};
