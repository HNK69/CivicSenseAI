const { validationResult } = require('express-validator');
const User    = require('../models/User');
const Officer = require('../models/Officer');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/tokens');
const { success, created, error } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

/* ====================================================================
   CITIZEN AUTH
   ==================================================================== */

/**
 * POST /api/auth/register
 * Body: { name, email, phone?, password, ward?, city? }
 */
exports.citizenRegister = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { name, email, phone, password, ward, city } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return error(res, 'Email already registered', 409);

  const user = await User.create({
    name, email, phone: phone || null,
    passwordHash: password,    // pre-save hook hashes this
    ward:  ward  || null,
    city:  city  || 'Ballari',
  });

  const tokenPayload = { id: user._id, role: 'citizen', email: user.email };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token
  user.refreshTokens.push(refreshToken);
  await user.save({ validateBeforeSave: false });

  return created(res, {
    user,
    accessToken,
    refreshToken,
  }, 'Registration successful');
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
exports.citizenLogin = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) return error(res, 'Invalid credentials', 401);
  if (!user.isActive) return error(res, 'Account deactivated', 403);

  const valid = await user.comparePassword(password);
  if (!valid) return error(res, 'Invalid credentials', 401);

  const tokenPayload = { id: user._id, role: 'citizen', email: user.email };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  user.refreshTokens.push(refreshToken);
  await user.save({ validateBeforeSave: false });

  const userObj = user.toJSON();
  return success(res, { user: userObj, accessToken, refreshToken }, 'Login successful');
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 */
exports.citizenRefresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return error(res, 'Refresh token required', 400);

  let decoded;
  try { decoded = verifyRefreshToken(refreshToken); }
  catch { return error(res, 'Invalid or expired refresh token', 401); }

  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(refreshToken))
    return error(res, 'Refresh token not recognised', 401);

  // Rotate token
  user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
  const tokenPayload   = { id: user._id, role: 'citizen', email: user.email };
  const newAccess      = generateAccessToken(tokenPayload);
  const newRefresh     = generateRefreshToken(tokenPayload);
  user.refreshTokens.push(newRefresh);
  await user.save({ validateBeforeSave: false });

  return success(res, { accessToken: newAccess, refreshToken: newRefresh }, 'Token refreshed');
});

/**
 * POST /api/auth/logout
 * Body: { refreshToken }
 */
exports.citizenLogout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (req.user && refreshToken) {
    req.user.refreshTokens = (req.user.refreshTokens || []).filter(t => t !== refreshToken);
    await req.user.save({ validateBeforeSave: false });
  }
  return success(res, {}, 'Logged out successfully');
});

/**
 * GET  /api/auth/me
 * Returns logged-in citizen's profile.
 */
exports.citizenMe = asyncHandler(async (req, res) => {
  return success(res, { user: req.user });
});

/**
 * PUT /api/auth/profile
 * Body: { name?, phone?, ward?, city?, address? }
 */
exports.citizenUpdateProfile = asyncHandler(async (req, res) => {
  const { name, phone, ward, city, address } = req.body;
  const user = req.user;

  if (name)    user.name    = name;
  if (phone)   user.phone   = phone;
  if (ward)    user.ward    = ward;
  if (city)    user.city    = city;
  if (address) user.address = address;

  // Avatar upload from uploadMiddleware
  if (req.uploadedMedia?.avatar) {
    user.avatarUrl = req.uploadedMedia.avatar.url;
  }

  await user.save({ validateBeforeSave: false });
  return success(res, { user }, 'Profile updated');
});

/**
 * PUT /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
exports.citizenChangePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  const valid = await user.comparePassword(currentPassword);
  if (!valid) return error(res, 'Current password is incorrect', 400);

  user.passwordHash = newPassword; // pre-save hook re-hashes
  user.refreshTokens = [];         // invalidate all sessions
  await user.save();

  return success(res, {}, 'Password changed successfully. Please log in again.');
});

/* ====================================================================
   OFFICER AUTH
   ==================================================================== */

/**
 * POST /api/officer/auth/login
 * Body: { email, password }
 * Returns: { officer, accessToken, refreshToken }
 * Client: stores accessToken as 'officer_token' in localStorage (from api.js)
 */
exports.officerLogin = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { email, password } = req.body;

  // Auto-seed default officer if no officer accounts exist in database
  const count = await Officer.countDocuments();
  if (count === 0) {
    await Officer.create({
      name: 'Default Officer',
      email: 'officer@civicsense.gov.in',
      passwordHash: 'officer123',
      role: 'officer',
      department: 'PWD',
      designation: 'Senior Municipal Officer',
    });
  }

  const officer = await Officer.findOne({ email }).select('+passwordHash');

  if (!officer) {
    return error(res, 'Officer account not found. Only registered municipal officers can log in.', 401);
  }

  const valid = await officer.comparePassword(password);
  if (!valid) {
    return error(res, 'Invalid password. Access denied.', 401);
  }

  if (!officer.isActive) return error(res, 'Account deactivated', 403);

  const tokenPayload = { id: officer._id, role: officer.role, email: officer.email };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  officer.refreshTokens.push(refreshToken);
  await officer.save({ validateBeforeSave: false });

  return success(res, {
    officer: officer.toJSON(),
    accessToken,
    refreshToken,
  }, 'Officer login successful');
});

/**
 * POST /api/officer/auth/register
 */
exports.officerRegister = asyncHandler(async (req, res) => {
  const { name, email, password, phone, department, designation } = req.body;

  let officer = await Officer.findOne({ email });
  if (officer) return error(res, 'Officer email already registered', 409);

  officer = await Officer.create({
    name: name || email.split('@')[0],
    email,
    passwordHash: password,
    role: 'officer',
    department: department || 'PWD',
    designation: designation || 'Municipal Officer',
    phone: phone || null,
  });

  const tokenPayload = { id: officer._id, role: officer.role, email: officer.email };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  officer.refreshTokens.push(refreshToken);
  await officer.save({ validateBeforeSave: false });

  return created(res, {
    officer: officer.toJSON(),
    accessToken,
    refreshToken,
  }, 'Officer account created');
});

/**
 * POST /api/officer/auth/refresh
 * Body: { refreshToken }
 */
exports.officerRefresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return error(res, 'Refresh token required', 400);

  let decoded;
  try { decoded = verifyRefreshToken(refreshToken); }
  catch { return error(res, 'Invalid or expired refresh token', 401); }

  const officer = await Officer.findById(decoded.id).select('+refreshTokens');
  if (!officer || !officer.refreshTokens.includes(refreshToken))
    return error(res, 'Refresh token not recognised', 401);

  officer.refreshTokens = officer.refreshTokens.filter(t => t !== refreshToken);
  const tokenPayload    = { id: officer._id, role: officer.role, email: officer.email };
  const newAccess       = generateAccessToken(tokenPayload);
  const newRefresh      = generateRefreshToken(tokenPayload);
  officer.refreshTokens.push(newRefresh);
  await officer.save({ validateBeforeSave: false });

  return success(res, { accessToken: newAccess, refreshToken: newRefresh }, 'Token refreshed');
});

/**
 * POST /api/officer/auth/logout
 */
exports.officerLogout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (req.officer && refreshToken) {
    req.officer.refreshTokens = (req.officer.refreshTokens || []).filter(t => t !== refreshToken);
    await req.officer.save({ validateBeforeSave: false });
  }
  return success(res, {}, 'Logged out');
});

/**
 * POST /api/officer/auth/create  (admin only)
 * Body: { name, email, password, role, department, designation, phone?, zone? }
 */
exports.createOfficer = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { name, email, password, role, department, designation, phone, employeeId, zone } = req.body;

  const exists = await Officer.findOne({ email });
  if (exists) return error(res, 'Email already registered', 409);

  const officer = await Officer.create({
    name, email,
    passwordHash: password,
    role:         role        || 'officer',
    department:   department  || null,
    designation:  designation || null,
    phone:        phone       || null,
    employeeId:   employeeId  || null,
    zone:         zone        || null,
  });

  return created(res, { officer }, 'Officer account created');
});

/* ====================================================================
   CONTRACTOR AUTH
   ==================================================================== */

/**
 * POST /api/contractor/auth/login
 * Body: { email, password }
 */
exports.contractorLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return error(res, 'Email and password are required', 400);

  const Contractor = require('../models/Contractor');
  const { DEFAULT_CONTRACTORS } = require('../services/seedService');

  let contractor = await Contractor.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  if (!contractor) {
    const matchDemo = DEFAULT_CONTRACTORS.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (matchDemo) {
      await Contractor.create(matchDemo);
      contractor = await Contractor.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    }
  }

  if (!contractor) {
    return error(res, 'Contractor account not found. Accounts are issued by Municipal Administration.', 401);
  }

  const valid = await contractor.comparePassword(password);
  if (!valid) {
    return error(res, 'Invalid password. Access denied.', 401);
  }

  if (!contractor.isActive) return error(res, 'Contractor account deactivated', 403);

  const tokenPayload = { id: contractor._id, role: 'contractor', email: contractor.email };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  contractor.refreshTokens = contractor.refreshTokens || [];
  contractor.refreshTokens.push(refreshToken);
  contractor.lastActive = new Date();
  await contractor.save({ validateBeforeSave: false });

  const contractorObj = contractor.toJSON();
  delete contractorObj.passwordHash;
  delete contractorObj.refreshTokens;

  return success(res, {
    contractor: contractorObj,
    accessToken,
    refreshToken,
  }, 'Contractor login successful');
});
