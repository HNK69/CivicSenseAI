const mongoose = require('mongoose');

/**
 * Contractor.js — External contractor / vendor entity.
 * client-officer's contractorService mock shape:
 *   { _id, name, category, rating, completedJobs, complaints, flagged, lastActive }
 */
const contractorSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    company: { type: String, default: null, trim: true },
    phone:   { type: String, default: null },
    email:   { type: String, default: null, lowercase: true, trim: true },

    // Matches client-officer 'category' field (single primary specialization)
    // and allows multiple specializations
    category:        { type: String, default: null },       // primary
    specialization:  [{ type: String }],                    // additional

    rating:        { type: Number, default: 0, min: 0, max: 5 },
    completedJobs: { type: Number, default: 0 },
    complaints:    { type: Number, default: 0 },
    flagged:       { type: Boolean, default: false },
    flagReason:    { type: String, default: null },

    lastActive:  { type: Date, default: null },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contractor', contractorSchema);
