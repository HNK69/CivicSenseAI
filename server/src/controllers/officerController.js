const { validationResult } = require('express-validator');
const Officer    = require('../models/Officer');
const Issue      = require('../models/Issue');
const WorkOrder  = require('../models/WorkOrder');
const Contractor = require('../models/Contractor');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, error, paginated } = require('../utils/response');
const paginate = require('../utils/paginate');
const { notifyNewAssignment } = require('../services/notificationService');
const { emitToIssueRoom, emitToDepartment, emitToOfficer } = require('../sockets/socketHandler');

/* ====================================================================
   CATEGORY → DEPARTMENT mapping (kept consistent with issueController)
   ==================================================================== */
const DEPT_MAP = {
  Roads:       'PWD',
  Water:       'Water Supply',
  Electricity: 'Electrical',
  Sanitation:  'Sanitation',
  Parks:       'Parks & Gardens',
  Other:       'General',
};

/* ====================================================================
   OFFICER ACCOUNT MANAGEMENT
   ==================================================================== */

/**
 * GET /api/officer/officers  (admin/supervisor only)
 * List all officers with optional department filter.
 */
exports.listOfficers = asyncHandler(async (req, res) => {
  const { department, role, page = 1, limit = 20 } = req.query;
  const filter = { isActive: true };
  if (department) filter.department = department;
  if (role)       filter.role       = role;

  const { docs, total } = await paginate(Officer, filter, { page, limit });
  return paginated(res, docs, total, page, limit);
});

/**
 * GET /api/officer/officers/:id
 */
exports.getOfficer = asyncHandler(async (req, res) => {
  const officer = await Officer.findById(req.params.id);
  if (!officer) return error(res, 'Officer not found', 404);
  return success(res, { officer });
});

/**
 * PATCH /api/officer/officers/:id  (admin only)
 * Update officer details.
 */
exports.updateOfficer = asyncHandler(async (req, res) => {
  const { name, phone, department, designation, role, zone, isActive } = req.body;
  const officer = await Officer.findById(req.params.id);
  if (!officer) return error(res, 'Officer not found', 404);

  if (name)        officer.name        = name;
  if (phone)       officer.phone       = phone;
  if (department)  officer.department  = department;
  if (designation) officer.designation = designation;
  if (role)        officer.role        = role;
  if (zone)        officer.zone        = zone;
  if (isActive !== undefined) officer.isActive = isActive;

  await officer.save({ validateBeforeSave: false });
  return success(res, { officer }, 'Officer updated');
});

/**
 * DELETE /api/officer/officers/:id  (admin only — deactivate)
 */
exports.deactivateOfficer = asyncHandler(async (req, res) => {
  const officer = await Officer.findById(req.params.id);
  if (!officer) return error(res, 'Officer not found', 404);
  officer.isActive = false;
  await officer.save({ validateBeforeSave: false });
  return success(res, {}, 'Officer deactivated');
});

/**
 * GET /api/officer/me
 * Current logged-in officer's profile.
 */
exports.getMyProfile = asyncHandler(async (req, res) => {
  return success(res, { officer: req.officer });
});

/**
 * PATCH /api/officer/me
 * Update own profile.
 */
exports.updateMyProfile = asyncHandler(async (req, res) => {
  const { name, phone, designation } = req.body;
  const officer = req.officer;

  if (name)        officer.name        = name;
  if (phone)       officer.phone       = phone;
  if (designation) officer.designation = designation;

  if (req.uploadedMedia?.avatar) officer.avatarUrl = req.uploadedMedia.avatar.url;

  await officer.save({ validateBeforeSave: false });
  return success(res, { officer }, 'Profile updated');
});

/* ====================================================================
   WORK ORDERS
   Supports client-officer's assignService:
     getWorkOrders()      → GET  /api/officer/work-orders
     assignWorkOrder()    → POST /api/officer/work-orders
     updateWorkOrderStatus() → PATCH /api/officer/work-orders/:id
   ==================================================================== */

/**
 * GET /api/officer/work-orders
 * Query: status, department, page, limit
 */
exports.getWorkOrders = asyncHandler(async (req, res) => {
  const { status, department, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status)     filter.status     = status;
  if (department) filter.department = department;

  // If officer (not admin/supervisor), only show their department
  if (req.officer.role === 'officer' && req.officer.department) {
    filter.department = req.officer.department;
  }

  const { docs, total } = await paginate(WorkOrder, filter, {
    page, limit,
    populate: [
      { path: 'issue',            select: 'title category status priority location' },
      { path: 'assignedOfficer',  select: 'name designation' },
      { path: 'contractor',       select: 'name company category rating' },
    ],
  });

  return paginated(res, docs, total, page, limit);
});

/**
 * GET /api/officer/work-orders/:id
 */
exports.getWorkOrder = asyncHandler(async (req, res) => {
  const wo = await WorkOrder.findById(req.params.id)
    .populate('issue', 'title category status priority location address')
    .populate('assignedOfficer', 'name designation department')
    .populate('contractor', 'name company phone email category rating');

  if (!wo) return error(res, 'Work order not found', 404);
  return success(res, { workOrder: wo });
});

/**
 * POST /api/officer/work-orders
 * Create a work order from an issue.
 * Body: { issueId, department, assignedTo (officerId), dueDate?, contractorId?, notes? }
 * Supports: client-officer's assignWorkOrder(issueId, dept, assignedTo)
 */
exports.createWorkOrder = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { issueId, department, assignedTo, dueDate, contractorId, notes } = req.body;

  const issue = await Issue.findById(issueId);
  if (!issue || issue.isDeleted) return error(res, 'Issue not found', 404);

  const wo = await WorkOrder.create({
    issue:           issueId,
    issueTitle:      issue.title,
    department:      department || DEPT_MAP[issue.category] || 'General',
    assignedOfficer: assignedTo   || null,
    contractor:      contractorId || null,
    dueDate:         dueDate      || null,
    notes:           notes        || null,
    status:          'pending',
    history: [{
      action:    'created',
      changedBy: req.officer._id,
      changedAt: new Date(),
    }],
  });

  // Link work order back to issue + update issue status
  issue.workOrder = wo._id;
  if (['reported', 'acknowledged'].includes(issue.status)) {
    issue.status = 'assigned';
    issue.statusHistory.push({
      status:    'assigned',
      changedAt: new Date(),
      changedByModel: 'Officer',
      changedBy: req.officer._id,
      note:      `Work order ${wo._id} created`,
    });
  }
  if (department) issue.assignedDepartment = department;
  if (assignedTo) issue.assignedOfficer    = assignedTo;
  await issue.save();

  // Notify assigned officer
  if (assignedTo) {
    await notifyNewAssignment({
      officerId:   assignedTo,
      issueId:     issue._id,
      issueTitle:  issue.title,
      workOrderId: wo._id,
    });
    emitToOfficer(assignedTo.toString(), 'issue:newAssignment', {
      workOrderId: wo._id,
      issueId:     issue._id,
      issueTitle:  issue.title,
      department:  wo.department,
    });
  }

  // Notify department room
  emitToDepartment(wo.department, 'issue:assigned', {
    issueId:     issue._id,
    title:       issue.title,
    workOrderId: wo._id,
    department:  wo.department,
  });

  return created(res, { workOrder: wo }, 'Work order created');
});

/**
 * PATCH /api/officer/work-orders/:id
 * Update status, notes, contractor, completedAt, etc.
 * Supports: client-officer's updateWorkOrderStatus(id, status)
 */
exports.updateWorkOrder = asyncHandler(async (req, res) => {
  const { status, notes, contractorId, dueDate, completedAt } = req.body;
  if (!status && !notes && !contractorId && !dueDate && !completedAt) {
    return error(res, 'At least one field to update must be provided', 400);
  }

  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) return error(res, 'Work order not found', 404);

  const prevStatus = wo.status;
  if (status)      wo.status      = status;
  if (notes)       wo.notes       = notes;
  if (contractorId) wo.contractor = contractorId;
  if (dueDate)     wo.dueDate     = dueDate;
  if (completedAt) wo.completedAt = completedAt;

  wo.history.push({
    action:    `status changed from ${prevStatus} to ${status || prevStatus}`,
    note:      notes || null,
    changedBy: req.officer._id,
    changedAt: new Date(),
  });

  await wo.save();

  // Emit workOrder:updated to issue room
  emitToIssueRoom(wo.issue.toString(), 'workOrder:updated', {
    workOrderId: wo._id,
    status:      wo.status,
  });

  return success(res, { workOrder: wo }, 'Work order updated');
});

/**
 * DELETE /api/officer/work-orders/:id  (admin only)
 */
exports.cancelWorkOrder = asyncHandler(async (req, res) => {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) return error(res, 'Work order not found', 404);
  wo.status = 'cancelled';
  wo.history.push({ action: 'cancelled', changedBy: req.officer._id, changedAt: new Date() });
  await wo.save();
  return success(res, {}, 'Work order cancelled');
});

/* ====================================================================
   REPAIR VERIFICATION
   Supports client-officer's repairService:
     getRepairs()        → GET  /api/officer/repairs
     verifyRepair(id, verdict) → POST /api/officer/repairs/:id/verify
   ==================================================================== */

/**
 * GET /api/officer/repairs
 */
exports.getRepairs = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.verificationVerdict = status;
  else        filter.status = { $in: ['completed', 'in_progress', 'PENDING_VERIFICATION'] };

  const { docs, total } = await paginate(WorkOrder, filter, {
    page, limit,
    populate: [
      { path: 'issue',      select: 'title category' },
      { path: 'contractor', select: 'name company' },
    ],
  });

  // Map to repairService response shape
  const repairs = docs.map(wo => ({
    _id:          wo._id,
    issueId:      wo.issue?._id,
    title:        wo.issueTitle || wo.issue?.title,
    status:       wo.verificationVerdict ? wo.verificationVerdict.toUpperCase() : 'PENDING_VERIFICATION',
    beforeImage:  wo.beforeImage?.url  || null,
    afterImage:   wo.afterImage?.url   || null,
    contractor:   wo.contractor?.name  || null,
    completedAt:  wo.completedAt       || wo.updatedAt,
  }));

  return paginated(res, repairs, total, page, limit);
});

/**
 * POST /api/officer/repairs/:id/verify
 * Body: { verdict: 'approved' | 'rejected', note? }
 * Supports: client-officer's verifyRepair(id, verdict)
 */
exports.verifyRepairOfficer = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { verdict, note } = req.body;
  if (!['approved', 'rejected'].includes(verdict))
    return error(res, 'verdict must be "approved" or "rejected"', 400);

  const wo = await WorkOrder.findById(req.params.id).populate('issue');
  if (!wo) return error(res, 'Work order not found', 404);

  wo.verificationVerdict = verdict;
  wo.verificationNote    = note || null;
  wo.status              = verdict === 'approved' ? 'verified' : 'in_progress';
  wo.history.push({
    action:    `repair ${verdict}`,
    note:      note || null,
    changedBy: req.officer._id,
    changedAt: new Date(),
  });
  await wo.save();

  // Update linked issue
  if (wo.issue && verdict === 'approved') {
    await Issue.findByIdAndUpdate(wo.issue._id, {
      status: 'resolved',
      $push: { statusHistory: {
        status:    'resolved',
        changedAt: new Date(),
        changedByModel: 'Officer',
        changedBy: req.officer._id,
        note:      'Repair verified by officer',
      }},
    });

    emitToIssueRoom(wo.issue._id.toString(), 'issue:statusUpdated', {
      issueId: wo.issue._id, status: 'resolved',
    });
  }

  // AI stub
  const { verifyRepair: aiVerify } = require('../services/aiService');
  aiVerify(wo._id.toString(), { verdict, note }).catch(() => {});

  return success(res, { workOrder: wo }, `Repair ${verdict}`);
});

/* ====================================================================
   DASHBOARD STATS
   Supports client-officer's Dashboard.jsx stat strip (hardcoded currently).
   ==================================================================== */

/**
 * GET /api/officer/stats
 * Returns aggregate counts for the dashboard.
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalIssues,
    openIssues,
    inProgressIssues,
    resolvedToday,
    criticalIssues,
    workOrders,
    pendingVerifications,
    flaggedContractors,
    aiFindings,
    duplicateGroups,
  ] = await Promise.all([
    Issue.countDocuments({ isDeleted: false }),
    Issue.countDocuments({ isDeleted: false, status: { $in: ['reported', 'acknowledged'] } }),
    Issue.countDocuments({ isDeleted: false, status: 'in_progress' }),
    Issue.countDocuments({
      isDeleted: false,
      status:    'resolved',
      updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
    Issue.countDocuments({ isDeleted: false, priority: 'CRITICAL' }),
    WorkOrder.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
    WorkOrder.countDocuments({ verificationVerdict: null, status: 'completed' }),
    Contractor.countDocuments({ flagged: true }),
    Issue.countDocuments({ 'aiMeta.summary': { $ne: null }, isDeleted: false }),
    Issue.countDocuments({ 'aiMeta.duplicateOf': { $ne: null }, isDeleted: false }),
  ]);

  return success(res, {
    totalIssues,
    openIssues,
    inProgressIssues,
    resolvedToday,
    criticalIssues,
    workOrders,
    pendingVerifications,
    flaggedContractors,
    aiFindings,
    duplicateGroups,
  });
});

/* ====================================================================
   COPILOT (stub)
   Supports client-officer's copilotService:
     getChatHistory()  → GET  /api/officer/copilot/history
     sendMessage()     → POST /api/officer/copilot/chat
   ==================================================================== */

/**
 * GET /api/officer/copilot/history
 */
exports.getCopilotHistory = asyncHandler(async (req, res) => {
  // TODO: persist copilot messages in a CopilotMessage model
  return success(res, { history: [] });
});

/**
 * POST /api/officer/copilot/chat
 * Body: { message }
 */
exports.sendCopilotMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return error(res, 'message is required', 400);

  const { municipalCopilotQuery } = require('../services/aiService');
  const reply = await municipalCopilotQuery(message, { officerId: req.officer._id });

  return success(res, { reply });
});

/* ====================================================================
   DEPARTMENT ROUTING HELPER
   ==================================================================== */

/**
 * GET /api/officer/departments
 * Returns available departments and their mapping.
 */
exports.getDepartments = asyncHandler(async (_req, res) => {
  const departments = Object.entries(DEPT_MAP).map(([category, dept]) => ({
    category, department: dept,
  }));
  return success(res, { departments, map: DEPT_MAP });
});
