const router = require('express').Router();
const nc = require('../controllers/notificationController');
const {
  verifyToken,
  requireCitizen,
  requireOfficer,
} = require('../middleware/authMiddleware');

/**
 * notificationRoutes.js — mounted at /api/notifications
 *
 * Role-aware: both citizens AND officers call the same endpoints.
 * verifyToken populates req.user OR req.officer depending on token role.
 * notificationController.getRecipient() handles the discrimination.
 *
 * Supports client-user's notificationService:
 *   getNotifications()           → GET  /api/notifications
 *   markNotificationRead(id)     → PATCH /api/notifications/:id/read
 *   markAllNotificationsRead()   → PATCH /api/notifications/mark-all-read
 *
 * Also usable by client-officer for officer notification inbox.
 */

// Allow any authenticated user (citizen or officer) via token
const anyAuthenticated = [verifyToken];

// GET /api/notifications/unread-count
router.get('/unread-count', ...anyAuthenticated, nc.getUnreadCount);

// PATCH /api/notifications/mark-all-read  — must be before /:id
router.patch('/mark-all-read', ...anyAuthenticated, nc.markAllRead);

// GET /api/notifications
router.get('/', ...anyAuthenticated, nc.getNotifications);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', ...anyAuthenticated, nc.markRead);

module.exports = router;
