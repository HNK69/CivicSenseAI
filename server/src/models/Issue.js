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

/* ── AI Analysis (from /api/v1/analyze) ────────────────────────────── */
const mediaFailedSchema = new mongoose.Schema(
  { url: String, reason: String },
  { _id: false }
);

const aiAnalysisSchema = new mongoose.Schema(
  {
    // Core classification
    category:          { type: String, default: null },
    severity:          { type: String, default: null },
    priority:          { type: String, default: null },

    // Department routing — iterate departments[], not just primary_department
    primary_department: { type: String, default: null },
    departments:        [{ type: String }],       // always contains primary_department, no duplicates
    department:         { type: String, default: null }, // alias === primary_department (back-compat)

    // Narrative
    summary:      { type: String, default: null },
    confidence:   { type: Number, default: null },
    analysisTags: [{ type: String }],
    reasoning:    { type: String, default: null },

    // Media processing status — informational, never blocks the request
    media_processed: { type: Number, default: 0 },
    media_failed:    [mediaFailedSchema],

    analyzed_at: { type: Date, default: null },
  },
  { _id: false }
);

/* ── Duplicate Check (from /api/v1/check-duplicate) ─────────────────── */
const duplicateCheckSchema = new mongoose.Schema(
  {
    is_duplicate:         { type: Boolean, default: null },
    duplicate_of:         { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
    similarity_score:     { type: Number, default: null },
    confidence:           { type: Number, default: null },
    candidates_evaluated: { type: Number, default: null },
    checked_at:           { type: Date, default: null },
  },
  { _id: false }
);

/* ── Repair Verification (from /api/v1/verify-repair) ───────────────── */
const diffSummarySchema = new mongoose.Schema(
  {
    pixel_diff_score:  { type: Number, default: null },
    change_percentage: { type: Number, default: null },
    pairs_compared:    { type: Number, default: null },
  },
  { _id: false }
);

const repairVerificationSchema = new mongoose.Schema(
  {
    verified:         { type: Boolean, default: null },
    confidence:       { type: Number, default: null },
    explanation:      { type: String, default: null },
    remaining_issues: [{ type: String }],
    diff_summary:     { type: diffSummarySchema, default: null },
    verified_at:      { type: Date, default: null },
  },
  { _id: false }
);

/* ── Main Issue Schema ───────────────────────────────────────────────── */
const issueSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['Roads', 'Water', 'Electricity', 'Sanitation', 'Parks', 'Other'],
      required: true,
    },
    subCategory: { type: String, default: null },

    // Media (Cloudinary URLs — always long-lived/public)
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
    assignedDepartment: { type: String, default: null }, // primary department for routing

    // Officer-side
    internalNotes: [internalNoteSchema],
    workOrder:     { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
    workOrders:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder' }], // multi-dept routing

    // Audit trail
    statusHistory: [statusHistorySchema],

    // Community engagement
    upvoteCount: { type: Number, default: 0 },
    upvotedBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ── Full AI results from FastAPI ai-service ──────────────────────
    ai_analysis:       { type: aiAnalysisSchema, default: null },
    duplicate_check:   { type: duplicateCheckSchema, default: null },
    repair_verification: { type: repairVerificationSchema, default: null },

    // ── Legacy aiMeta (kept for backward-compat with existing queries) ──
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

// AI fields
issueSchema.index({ 'ai_analysis.category': 1 });
issueSchema.index({ 'duplicate_check.is_duplicate': 1 });

module.exports = mongoose.model('Issue', issueSchema);
