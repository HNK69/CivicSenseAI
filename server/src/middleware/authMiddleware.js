const { verifyAccessToken } = require('../utils/tokens');
const { error }             = require('../utils/response');
const User                  = require('../models/User');
const Officer               = require('../models/Officer');

/**
 * verifyToken — validates Bearer JWT in Authorization header.
 * Attaches req.user (citizen) or req.officer (officer) based on token role.
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
 * @param {...string} roles — allowed roles
 * Usage: router.get('/admin', verifyToken, requireRole('admin'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  const role = req.tokenPayload?.role;
  if (!role || !roles.includes(role)) {
    return error(res, `Access denied. Required role(s): ${roles.join(', ')}`, 403);
  }
  next();
};

/**
 * requireCitizen — shorthand for requireRole('citizen').
 */
const requireCitizen = requireRole('citizen');

/**
 * requireOfficer — shorthand that accepts officer, supervisor, or admin.
 */
const requireOfficer = requireRole('officer', 'supervisor', 'admin');

/**
 * requireAdmin — admin-only.
 */
const requireAdmin = requireRole('admin');

/**
 * requireSupervisorOrAdmin
 */
const requireSupervisorOrAdmin = requireRole('supervisor', 'admin');

module.exports = {
  verifyToken,
  requireRole,
  requireCitizen,
  requireOfficer,
  requireAdmin,
  requireSupervisorOrAdmin,
};
