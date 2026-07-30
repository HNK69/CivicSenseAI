const router = require('express').Router();
const { body } = require('express-validator');
const cc = require('../controllers/contractorController');
const {
  verifyToken,
  requireOfficer,
  requireSupervisorOrAdmin,
} = require('../middleware/authMiddleware');

/**
 * contractorRoutes.js — mounted at /api/officer/contractors
 *
 * Supports client-officer's contractorService:
 *   getContractors()     → GET  /api/officer/contractors
 *   flagContractor(id)   → POST /api/officer/contractors/:id/flag
 *   unflagContractor(id) → DELETE /api/officer/contractors/:id/flag
 */

// GET /api/officer/contractors/stats  — must be before /:id
router.get('/stats', verifyToken, requireOfficer, cc.getAllContractorStats);

// GET /api/officer/contractors
router.get('/', verifyToken, requireOfficer, cc.getContractors);

// POST /api/officer/contractors  (supervisor/admin)
router.post('/', verifyToken, requireSupervisorOrAdmin, [
  body('name').trim().notEmpty().withMessage('Contractor name is required'),
  body('category').notEmpty().withMessage('Category is required'),
], cc.createContractor);

// GET /api/officer/contractors/:id
router.get('/:id', verifyToken, requireOfficer, cc.getContractor);

// PATCH /api/officer/contractors/:id
router.patch('/:id', verifyToken, requireSupervisorOrAdmin, cc.updateContractor);

// GET /api/officer/contractors/:id/performance
router.get('/:id/performance', verifyToken, requireOfficer, cc.getPerformance);

// POST /api/officer/contractors/:id/flag
router.post('/:id/flag', verifyToken, requireOfficer, cc.flagContractor);

// DELETE /api/officer/contractors/:id/flag
router.delete('/:id/flag', verifyToken, requireOfficer, cc.unflagContractor);

module.exports = router;
