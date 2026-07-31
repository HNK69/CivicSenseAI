const { verifyAccessToken } = require('../utils/tokens');
const { error }             = require('../utils/response');
const User                  = require('../models/User');
const Officer               = require('../models/Officer');
const Contractor            = require('../models/Contractor');

/**
 * verifyToken — validates Bearer JWT in Authorization header.
 * Attaches req.user (citizen), req.officer (officer), or req.contractor (contractor).
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'No token provided', 401);
    }

    const token   = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.tokenPayload = decoded;

    // Load the full document based on role
    if (decoded.role === 'citizen') {
      const user = await User.findById(decoded.id).select('-passwordHash -refreshTokens');
      if (!user || !user.isActive) return error(res, 'Account not found or deactivated', 401);
      req.user = user;
    } else if (decoded.role === 'contractor') {
      const contractor = await Contractor.findById(decoded.id).select('-passwordHash -refreshTokens');
      if (!contractor || !contractor.isActive) return error(res, 'Contractor account not found or deactivated', 401);
      req.contractor = contractor;
    } else {
      // officer / supervisor / admin
      const officer = await Officer.findById(decoded.id).select('-passwordHash -refreshTokens');
      if (!officer || !officer.isActive) return error(res, 'Officer account not found or deactivated', 401);
      req.officer = officer;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return error(res, 'Token expired', 401);
    if (err.name === 'JsonWebTokenError')  return error(res, 'Invalid token', 401);
    next(err);
  }
};

/**
 * requireRole — role-based access control middleware factory.
 */
const requireRole = (...roles) => (req, res, next) => {
  const role = req.tokenPayload?.role;
  if (!role || !roles.includes(role)) {
    return error(res, `Access denied. Required role(s): ${roles.join(', ')}`, 403);
  }
  next();
};

const requireCitizen    = requireRole('citizen');
const requireOfficer    = requireRole('officer', 'supervisor', 'admin');
const requireContractor = requireRole('contractor');
const requireAdmin      = requireRole('admin');
const requireSupervisorOrAdmin = requireRole('supervisor', 'admin');

module.exports = {
  verifyToken,
  requireRole,
  requireCitizen,
  requireOfficer,
  requireContractor,
  requireAdmin,
  requireSupervisorOrAdmin,
};
