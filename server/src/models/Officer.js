const mongoose = require('mongoose');
const bcrypt    = require('bcryptjs');

/**
 * Officer.js — Municipal officer/supervisor/admin account.
 * Departments are stored as plain strings (e.g. "PWD", "Sanitation").
 * No separate Department model — category→department mapping lives in
 * officerController.js as DEPT_MAP.
 */
const officerSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    employeeId:   { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone:        { type: String, default: null },
    avatarUrl:    { type: String, default: null },
    designation:  { type: String, default: null },   // "Senior Municipal Officer" etc.

    // Role hierarchy
    role: {
      type: String,
      enum: ['officer', 'supervisor', 'admin'],
      default: 'officer',
    },

    // Department assignment (plain string, e.g. "PWD", "Sanitation", "Electrical")
    department: { type: String, default: null },
    zone:       { type: String, default: null },

    isActive: { type: Boolean, default: true },

    // Refresh tokens
    refreshTokens: [{ type: String }],

    // Password reset
    resetPasswordToken:   { type: String, default: null },
    resetPasswordExpires: { type: Date,   default: null },
  },
  { timestamps: true }
);

/* ---- Hash password before save ---- */
officerSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

/* ---- Compare password ---- */
officerSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/* ---- Strip sensitive fields from JSON ---- */
officerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

module.exports = mongoose.model('Officer', officerSchema);
