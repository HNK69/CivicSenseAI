const mongoose = require('mongoose');

/**
 * WorkOrder.js — Links an Issue to an Officer/Department/Contractor for execution.
 * client-officer's assignService uses: issueId, department, assignedTo, status, dueDate.
 * repairService adds: beforeImage, afterImage, contractor, completedAt.
 */
const workOrderHistorySchema = new mongoose.Schema(
  {
    action:    { type: String, required: true },
    note:      { type: String, default: null },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const workOrderSchema = new mongoose.Schema(
  {
    issue:           { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
    issueTitle:      { type: String, default: null },                    // denormalized for quick listing
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', default: null },
    department:      { type: String, required: true },                   // e.g. "PWD"
    contractor:      { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', default: null },

    status: {
      type: String,
      enum: ['pending', 'scheduled', 'in_progress', 'completed', 'verified', 'cancelled',
             // client-officer mock values (normalised):
             'PENDING', 'IN_PROGRESS', 'RESOLVED', 'PENDING_VERIFICATION'],
      default: 'pending',
    },

    scheduledDate: { type: Date, default: null },
    dueDate:       { type: Date, default: null },
    completedAt:   { type: Date, default: null },

    cost:  { type: Number, default: null },
    notes: { type: String, default: null },

    // Repair verification media
    beforeImage: { url: String, publicId: String },
    afterImage:  { url: String, publicId: String },

    // Verdict from officer (or AI) verification
    verificationVerdict: {
      type: String,
      enum: ['approved', 'rejected', 'pending', 'VERIFIED', 'PENDING_VERIFICATION', null],
      default: null,
    },
    verificationNote: { type: String, default: null },

    history: [workOrderHistorySchema],
  },
  { timestamps: true }
);

workOrderSchema.index({ issue: 1 });
workOrderSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
