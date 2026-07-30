const router = require('express').Router();
const { body } = require('express-validator');
const oc = require('../controllers/officerController');
const {
  verifyToken,
  requireOfficer,
  requireAdmin,
  requireSupervisorOrAdmin,
} = require('../middleware/authMiddleware');
const { uploadAvatar, handleCloudinaryUpload } = require('../middleware/uploadMiddleware');

/* ====================================================================
   OFFICER PROFILE
   ==================================================================== */

// GET /api/officer/me
router.get('/me', verifyToken, requireOfficer, oc.getMyProfile);

// PATCH /api/officer/me
router.patch(
  '/me',
  verifyToken, requireOfficer,
  uploadAvatar, handleCloudinaryUpload,
  oc.updateMyProfile,
);

/* ====================================================================
   OFFICER MANAGEMENT (admin/supervisor only)
   ==================================================================== */

// GET /api/officer/officers
router.get('/officers', verifyToken, requireSupervisorOrAdmin, oc.listOfficers);

// GET /api/officer/officers/:id
router.get('/officers/:id', verifyToken, requireSupervisorOrAdmin, oc.getOfficer);

// PATCH /api/officer/officers/:id
router.patch('/officers/:id', verifyToken, requireAdmin, oc.updateOfficer);

// DELETE /api/officer/officers/:id  (deactivate)
router.delete('/officers/:id', verifyToken, requireAdmin, oc.deactivateOfficer);

/* ====================================================================
   WORK ORDERS
   Supports client-officer's assignService:
     getWorkOrders()            → GET  /api/officer/work-orders
     assignWorkOrder()          → POST /api/officer/work-orders
     updateWorkOrderStatus()    → PATCH /api/officer/work-orders/:id
   ==================================================================== */

// GET /api/officer/work-orders
router.get('/work-orders', verifyToken, requireOfficer, oc.getWorkOrders);

// GET /api/officer/work-orders/:id
router.get('/work-orders/:id', verifyToken, requireOfficer, oc.getWorkOrder);

// POST /api/officer/work-orders
router.post('/work-orders', verifyToken, requireOfficer, [
  body('issueId').notEmpty().withMessage('issueId is required'),
  body('department').notEmpty().withMessage('department is required'),
], oc.createWorkOrder);

// PATCH /api/officer/work-orders/:id
router.patch('/work-orders/:id', verifyToken, requireOfficer, oc.updateWorkOrder);

// DELETE /api/officer/work-orders/:id  (cancel)
router.delete('/work-orders/:id', verifyToken, requireSupervisorOrAdmin, oc.cancelWorkOrder);

/* ====================================================================
   REPAIR VERIFICATION
   Supports client-officer's repairService:
     getRepairs()                → GET  /api/officer/repairs
     verifyRepair(id, verdict)   → POST /api/officer/repairs/:id/verify
   ==================================================================== */

// GET /api/officer/repairs
router.get('/repairs', verifyToken, requireOfficer, oc.getRepairs);

// POST /api/officer/repairs/:id/verify
router.post('/repairs/:id/verify', verifyToken, requireOfficer, [
  body('verdict').isIn(['approved','rejected']).withMessage('verdict must be approved or rejected'),
], oc.verifyRepairOfficer);

/* ====================================================================
   DASHBOARD STATS
   ==================================================================== */

// GET /api/officer/stats
router.get('/stats', verifyToken, requireOfficer, oc.getDashboardStats);

/* ====================================================================
   DEPARTMENT HELPERS
   ==================================================================== */

// GET /api/officer/departments
router.get('/departments', verifyToken, requireOfficer, oc.getDepartments);

/* ====================================================================
   COPILOT
   Supports client-officer's copilotService:
     getChatHistory() → GET  /api/officer/copilot/history
     sendMessage()    → POST /api/officer/copilot/chat
   ==================================================================== */

// GET /api/officer/copilot/history
router.get('/copilot/history', verifyToken, requireOfficer, oc.getCopilotHistory);

// POST /api/officer/copilot/chat
router.post('/copilot/chat', verifyToken, requireOfficer, [
  body('message').trim().notEmpty().withMessage('message is required'),
], oc.sendCopilotMessage);

/* ====================================================================
   DUPLICATE & AI — also accessible directly from officerIssueRouter,
   but aliased here too for client-officer's convenience.
   Supports:
     getDuplicateGroups()   → GET  /api/officer/duplicates
     mergeDuplicates()      → POST /api/officer/duplicates/merge
     getFindings()          → GET  /api/officer/ai/findings
     triggerAnalysis(id)    → POST /api/officer/ai/analyze/:id
   ==================================================================== */
const ic = require('../controllers/issueController');

router.get('/duplicates',        verifyToken, requireOfficer, ic.officerGetDuplicates);
router.post('/duplicates/merge', verifyToken, requireOfficer, ic.officerMergeDuplicates);
router.get('/ai/findings',       verifyToken, requireOfficer, ic.officerGetAIFindings);
router.post('/ai/analyze/:id',   verifyToken, requireOfficer, ic.officerInvestigate);

module.exports = router;
