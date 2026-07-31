const router  = require('express').Router();
const { body } = require('express-validator');
const auth    = require('../controllers/authController');
const { verifyToken, requireCitizen } = require('../middleware/authMiddleware');
const { uploadAvatar, handleCloudinaryUpload } = require('../middleware/uploadMiddleware');

/* ====================================================================
   CITIZEN AUTH  —  mounted at /api/auth
   ==================================================================== */

// POST /api/auth/register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be ≥ 6 characters'),
], auth.citizenRegister);

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], auth.citizenLogin);

// POST /api/auth/refresh
router.post('/refresh', auth.citizenRefresh);

// POST /api/auth/logout  (protected — sends refresh token in body)
router.post('/logout', verifyToken, requireCitizen, auth.citizenLogout);

// GET /api/auth/me
router.get('/me', verifyToken, requireCitizen, auth.citizenMe);

// PUT /api/auth/profile
router.put(
  '/profile',
  verifyToken, requireCitizen,
  uploadAvatar, handleCloudinaryUpload,
  auth.citizenUpdateProfile,
);

// PUT /api/auth/change-password
router.put('/change-password', verifyToken, requireCitizen, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], auth.citizenChangePassword);

/* ====================================================================
   OFFICER AUTH  —  mounted at /api/officer/auth
   ==================================================================== */
const officerAuthRouter = require('express').Router();
const { verifyToken: vt, requireAdmin, requireOfficer } = require('../middleware/authMiddleware');

// POST /api/officer/auth/login
officerAuthRouter.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], auth.officerLogin);

// POST /api/officer/auth/register
officerAuthRouter.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
], auth.officerRegister);

// POST /api/officer/auth/refresh
officerAuthRouter.post('/refresh', auth.officerRefresh);

// POST /api/officer/auth/logout
officerAuthRouter.post('/logout', vt, requireOfficer, auth.officerLogout);

// POST /api/officer/auth/create  (admin only)
officerAuthRouter.post('/create', vt, requireAdmin, [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['officer', 'supervisor', 'admin']).optional(),
], auth.createOfficer);

module.exports = { citizenAuthRouter: router, officerAuthRouter };
