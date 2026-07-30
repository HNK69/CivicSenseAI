const mongoose = require('mongoose');

/**
 * Notification.js — Persisted notifications for both citizens and officers.
 * recipientType discriminates between User and Officer refs.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient:     {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'recipientType',
    },
    recipientType: { type: String, required: true, enum: ['User', 'Officer'] },

    title:   { type: String, required: true },
    message: { type: String, required: true },
    detail:  { type: String, default: null },

    type: {
      type: String,
      enum: ['status_update', 'verify_request', 'new_assignment', 'alert', 'upvote', 'system', 'copilot'],
      default: 'system',
    },

    // Icon metadata (mirrors client-user NotificationItem props)
    icon:      { type: String, default: 'bi-bell-fill' },
    iconBg:    { type: String, default: '#f1f5f9' },
    iconColor: { type: String, default: '#64748b' },

    relatedIssue:     { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
    relatedWorkOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', default: null },

    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
