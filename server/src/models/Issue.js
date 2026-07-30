const mongoose = require('mongoose');

/**
 * Issue.js — Shared model used by both citizen and officer sides.
 *
 * Status flow:
 *   reported → acknowledged → assigned → in_progress → resolved
 *   Any state → rejected | reopened
 *
 * Officer-side statuses from client-officer mock data:
 *   OPEN, IN_PROGRESS, RESOLVED — mapped to: reported/acknowledged, in_progress, resolved
 *
 * Priority values (client-officer uses): CRITICAL, HIGH, MEDIUM, LOW
 */

const statusHistorySchema = new mongoose.Schema(
  {
    status:    { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'changedByModel' },
    changedByModel: { type: String, enum: ['User', 'Officer'], default: 'Officer' },
    note:      { type: String, default: null },
  },
  { _id: false }
);

const internalNoteSchema = new mongoose.Schema(
  {
    text:      { type: String, required: true },
    author:    { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const issueSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category:    {
      type: String,
      enum: ['Roads', 'Water', 'Electricity', 'Sanitation', 'Parks', 'Other'],
      required: true,
    },
    subCategory: { type: String, default: null },

    // Media
    images: [{ url: String, publicId: String }],
    videos: [{ url: String, publicId: String }],

    // Location — GeoJSON Point for $near queries
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    address: { type: String, default: null },

    // Status (citizen-facing + officer-facing combined)
    status: {
      type: String,
      enum: ['reported', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'rejected', 'reopened'],
      default: 'reported',
    },

    // Priority — client-officer uses CRITICAL/HIGH/MEDIUM/LOW
    priority: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'LOW',
    },

    // Ownership
    createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedOfficer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', default: null },
    assignedDepartment: { type: String, default: null }, // e.g. "PWD", "Sanitation"

    // Officer-side
    internalNotes: [internalNoteSchema],
    workOrder:     { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', default: null },

    // Audit trail
    statusHistory: [statusHistorySchema],

    // Community engagement
    upvoteCount: { type: Number, default: 0 },
    upvotedBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // AI metadata — placeholder only, populated by ai-service
    aiMeta: {
      duplicateOf:    { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
      priorityScore:  { type: Number, default: null },
      analysisTags:   [{ type: String }],
      verifiedByAI:   { type: Boolean, default: false },
      confidence:     { type: Number, default: null },
      summary:        { type: String, default: null },
      suggestedAction:{ type: String, default: null },
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 2dsphere index for geo queries
issueSchema.index({ location: '2dsphere' });

// Text search
issueSchema.index({ title: 'text', description: 'text' });

// Common query patterns
issueSchema.index({ createdBy: 1, status: 1 });
issueSchema.index({ assignedDepartment: 1, status: 1 });
issueSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model('Issue', issueSchema);
