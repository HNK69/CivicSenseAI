const Notification   = require('../models/Notification');
const { emitToUser, emitToOfficer } = require('../sockets/socketHandler');

/**
 * notificationService.js — Creates a persisted Notification doc AND emits
 * a real-time Socket.IO event to the recipient.
 *
 * @param {Object} payload
 * @param {string|ObjectId} payload.recipientId   — User or Officer _id
 * @param {string}          payload.recipientType — 'User' | 'Officer'
 * @param {string}          payload.title
 * @param {string}          payload.message
 * @param {string}          [payload.detail]
 * @param {string}          [payload.type]         — Notification type enum value
 * @param {string}          [payload.icon]
 * @param {string}          [payload.iconBg]
 * @param {string}          [payload.iconColor]
 * @param {string|ObjectId} [payload.relatedIssue]
 * @param {string|ObjectId} [payload.relatedWorkOrder]
 * @returns {Promise<Notification>}
 */
const createNotification = async (payload) => {
  const {
    recipientId,
    recipientType,
    title,
    message,
    detail       = null,
    type         = 'system',
    icon         = 'bi-bell-fill',
    iconBg       = '#f1f5f9',
    iconColor    = '#64748b',
    relatedIssue = null,
    relatedWorkOrder = null,
  } = payload;

  // Persist to DB
  const notif = await Notification.create({
    recipient:     recipientId,
    recipientType,
    title,
    message,
    detail,
    type,
    icon,
    iconBg,
    iconColor,
    relatedIssue,
    relatedWorkOrder,
    read: false,
  });

  // Emit real-time event
  const socketPayload = {
    id:        notif._id,
    title,
    message,
    detail,
    type,
    icon,
    iconBg,
    iconColor,
    relatedIssue,
    timestamp: notif.createdAt,
    read:      false,
  };

  try {
    if (recipientType === 'User') {
      emitToUser(recipientId.toString(), 'notification:new', socketPayload);
    } else {
      emitToOfficer(recipientId.toString(), 'notification:new', socketPayload);
    }
  } catch (err) {
    // Socket emit failure should not break the request flow
    console.warn('[notificationService] Socket emit failed:', err.message);
  }

  return notif;
};

/**
 * notifyStatusChange — convenience wrapper for issue status changes.
 */
const notifyStatusChange = async ({ userId, issueId, issueTitle, newStatus }) => {
  const statusLabels = {
    acknowledged: 'Acknowledged',
    assigned:     'Assigned',
    in_progress:  'In Progress',
    resolved:     'Resolved',
    rejected:     'Rejected',
    reopened:     'Reopened',
  };

  return createNotification({
    recipientId:   userId,
    recipientType: 'User',
    title:         `Issue ${statusLabels[newStatus] || newStatus}`,
    message:       `Your issue "${issueTitle}" is now ${statusLabels[newStatus] || newStatus}.`,
    type:          'status_update',
    icon:          'bi-arrow-repeat',
    iconBg:        '#dbeafe',
    iconColor:     '#1a56db',
    relatedIssue:  issueId,
  });
};

/**
 * notifyNewAssignment — notify an officer of a newly assigned issue/work order.
 */
const notifyNewAssignment = async ({ officerId, issueId, issueTitle, workOrderId }) => {
  return createNotification({
    recipientId:      officerId,
    recipientType:    'Officer',
    title:            'New Issue Assignment',
    message:          `You have been assigned to: "${issueTitle}".`,
    type:             'new_assignment',
    icon:             'bi-person-fill-check',
    iconBg:           '#f5f3ff',
    iconColor:        '#7c3aed',
    relatedIssue:     issueId,
    relatedWorkOrder: workOrderId,
  });
};

module.exports = { createNotification, notifyStatusChange, notifyNewAssignment };
