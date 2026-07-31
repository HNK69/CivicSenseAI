const router = require('express').Router();
const { body } = require('express-validator');
const cc = require('../controllers/contractorController');
const {
  verifyToken,
  requireOfficer,
  requireContractor,
  requireSupervisorOrAdmin,
} = require('../middleware/authMiddleware');

/**
 * Officer-facing contractor routes — mounted at /api/officer/contractors
 */

// GET /api/officer/contractors/stats
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

/**
 * Contractor Portal routes — mounted at /api/contractor
 */
const contractorPortalRouter = require('express').Router();

// GET /api/contractor/work-orders
contractorPortalRouter.get('/work-orders', verifyToken, requireContractor, cc.getMyWorkOrders);

// GET /api/contractor/work-orders/:id
contractorPortalRouter.get('/work-orders/:id', verifyToken, requireContractor, cc.getMyWorkOrderDetails);

// POST /api/contractor/work-orders/:id/submit-completion
contractorPortalRouter.post('/work-orders/:id/submit-completion', verifyToken, requireContractor, cc.submitWorkOrderCompletion);

module.exports = { officerContractorRouter: router, contractorPortalRouter };
