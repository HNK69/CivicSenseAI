const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

/**
 * Contractor.js — External contractor / vendor entity with authentication.
 */
const contractorSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    company: { type: String, default: null, trim: true },
    phone:   { type: String, default: null },
    email:   { type: String, required: true, unique: true, lowercase: true, trim: true },

    passwordHash: { type: String, select: false },
    refreshTokens: [{ type: String, select: false }],

    category:       { type: String, default: 'General' }, // primary
    specialization: [{ type: String }],                  // additional

    rating:        { type: Number, default: 4.5, min: 0, max: 5 },
    completedJobs: { type: Number, default: 0 },
    complaints:    { type: Number, default: 0 },
    flagged:       { type: Boolean, default: false },
    flagReason:    { type: String, default: null },

    lastActive:  { type: Date, default: Date.now },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before saving
contractorSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
contractorSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('Contractor', contractorSchema);
