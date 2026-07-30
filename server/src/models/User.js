const mongoose = require('mongoose');
const bcrypt    = require('bcryptjs');

/**
 * User.js — Citizen account model.
 * role is always "citizen" — officers use Officer.js.
 */
const userSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:         { type: String, trim: true, default: null },
    passwordHash:  { type: String, required: true, select: false },
    avatarUrl:     { type: String, default: null },
    address:       { type: String, default: null },
    ward:          { type: String, default: null },
    city:          { type: String, default: 'Ballari' },
    role:          { type: String, enum: ['citizen'], default: 'citizen' },

    // Refresh tokens — stored hashed for security
    refreshTokens: [{ type: String }],

    // Password reset
    resetPasswordToken:   { type: String,  default: null },
    resetPasswordExpires: { type: Date,    default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ---- Hash password before save ---- */
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

/* ---- Instance method: compare password ---- */
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/* ---- Never return passwordHash / tokens in JSON ---- */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
