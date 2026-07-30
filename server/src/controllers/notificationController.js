const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { success, error, paginated } = require('../utils/response');
const paginate = require('../utils/paginate');

/**
 * notificationController.js — Handles notification list + read actions.
 * Role-aware: works for both citizens (req.user) and officers (req.officer).
 *
 * Citizen routes:  GET/PATCH /api/notifications/...
 * Officer routes:  same controller, different auth middleware — req.officer used
 *
 * Matches client-user's notificationService:
 *   getNotifications()             → GET  /api/notifications
 *   markNotificationRead(id)       → PATCH /api/notifications/:id/read
 *   markAllNotificationsRead()     → PATCH /api/notifications/mark-all-read
 */

/* ---- Helper: determine recipient from request ---- */
const getRecipient = (req) => {
  if (req.user)    return { recipientId: req.user._id,    recipientType: 'User'    };
  if (req.officer) return { recipientId: req.officer._id, recipientType: 'Officer' };
  return null;
};

/**
 * GET /api/notifications
 * Query: read (true|false), type, page, limit
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const recipient = getRecipient(req);
  if (!recipient) return error(res, 'Not authenticated', 401);

  const { read, type, page = 1, limit = 30 } = req.query;
  const filter = {
    recipient:     recipient.recipientId,
    recipientType: recipient.recipientType,
  };

  if (read !== undefined) filter.read = read === 'true';
  if (type)               filter.type = type;

  const { docs, total } = await paginate(Notification, filter, {
    page, limit,
    sort:     { createdAt: -1 },
    populate: [
      { path: 'relatedIssue', select: 'title category status' },
    ],
  });

  // Map to the shape client-user expects:
  // { id, type, icon, iconBg, iconColor, title, detail, timestamp, read, issueId }
  const mapped = docs.map(n => ({
    id:          n._id,
    type:        n.type,
    icon:        n.icon,
    iconBg:      n.iconBg,
    iconColor:   n.iconColor,
    title:       n.title,
    detail:      n.detail || n.message,
    timestamp:   n.createdAt,
    read:        n.read,
    issueId:     n.relatedIssue?._id || null,
  }));

  return paginated(res, mapped, total, page, limit);
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
exports.markRead = asyncHandler(async (req, res) => {
  const recipient = getRecipient(req);
  if (!recipient) return error(res, 'Not authenticated', 401);

  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: recipient.recipientId },
    { read: true },
    { new: true }
  );

  if (!notif) return error(res, 'Notification not found', 404);
  return success(res, { notification: notif }, 'Marked as read');
});

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications for this recipient as read.
 */
exports.markAllRead = asyncHandler(async (req, res) => {
  const recipient = getRecipient(req);
  if (!recipient) return error(res, 'Not authenticated', 401);

  const result = await Notification.updateMany(
    { recipient: recipient.recipientId, recipientType: recipient.recipientType, read: false },
    { read: true }
  );

  return success(res, { modifiedCount: result.modifiedCount }, 'All notifications marked as read');
});

/**
 * GET /api/notifications/unread-count
 * Quick count for navbar badge.
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const recipient = getRecipient(req);
  if (!recipient) return error(res, 'Not authenticated', 401);

  const count = await Notification.countDocuments({
    recipient:     recipient.recipientId,
    recipientType: recipient.recipientType,
    read:          false,
  });

  return success(res, { count });
});
