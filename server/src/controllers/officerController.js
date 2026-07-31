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
const { verifyRepairAI, municipalCopilotQuery } = require('../services/aiService');


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
  const { status, department, page = 1, limit = 100 } = req.query;
  const filter = {};
  if (status)     filter.status     = status;
  if (department) filter.department = department;

  const { docs, total } = await paginate(WorkOrder, filter, {
    page, limit,
    sort: { createdAt: -1 },
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
 * Create or assign a work order from an issue to a contractor.
 * Body: { issueId, department, assignedTo (officerId), dueDate?, contractorId?, notes? }
 */
exports.createWorkOrder = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { issueId, department, assignedTo, dueDate, contractorId, notes } = req.body;

  const issue = await Issue.findById(issueId);
  if (!issue || issue.isDeleted) return error(res, 'Issue not found', 404);

  // Check if a work order already exists for this issue
  let wo = await WorkOrder.findOne({ issue: issueId });
  if (wo) {
    if (department)   wo.department = department;
    if (contractorId) wo.contractor = contractorId;
    if (assignedTo)   wo.assignedOfficer = assignedTo;
    if (notes)        wo.notes = notes;
    if (dueDate)      wo.dueDate = dueDate;
    wo.status = 'in_progress';
    wo.history.push({
      action:    'assigned to contractor',
      note:      notes || null,
      changedBy: req.officer?._id || null,
      changedAt: new Date(),
    });
    await wo.save();
  } else {
    wo = await WorkOrder.create({
      issue:           issueId,
      issueTitle:      issue.title,
      department:      department || DEPT_MAP[issue.category] || 'General',
      assignedOfficer: assignedTo   || null,
      contractor:      contractorId || null,
      dueDate:         dueDate      || null,
      notes:           notes        || null,
      status:          'pending',
      history: [{
        action:    'created and assigned',
        changedBy: req.officer?._id || null,
        changedAt: new Date(),
      }],
    });
  }

  // Link work order back to issue + update issue status
  issue.workOrder = wo._id;
  issue.status = 'assigned';
  if (department) issue.assignedDepartment = department;
  await issue.save({ validateBeforeSave: false });

  // Populate contractor details for real-time socket events & response
  await wo.populate('contractor', 'name company category rating');

  return created(res, { workOrder: wo }, 'Work order assigned successfully');
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
  const wo = await WorkOrder.findById(req.params.id).populate('issue');
  if (!wo) return error(res, 'Work order not found', 404);

  // ---- Build image URL arrays for AI service ----
  let before_image_urls = wo.before_image_urls?.length
    ? wo.before_image_urls
    : [wo.beforeImage?.url].filter(Boolean);

  if (before_image_urls.length === 0 && wo.issue?.images?.length) {
    before_image_urls = wo.issue.images.map(img => img.url).filter(Boolean);
  }

  let after_image_urls = wo.after_image_urls?.length
    ? wo.after_image_urls
    : [wo.afterImage?.url].filter(Boolean);

  if (after_image_urls.length === 0 && wo.issue?.images?.length) {
    after_image_urls = wo.issue.images.map(img => img.url).filter(Boolean);
  }

  const complaint_id = (wo.issue?._id || wo.issue)?.toString();

  // Call AI verify-repair if not already run
  let aiResult = wo.ai_repair_verification;
  if (!aiResult || !aiResult.verified_at) {
    try {
      aiResult = await verifyRepairAI({ complaint_id, before_image_urls, after_image_urls });
    } catch (aiErr) {
      console.error('[officerController] verifyRepairAI failed:', aiErr.message);
    }
  }

  const lowConfidence = !aiResult || aiResult.confidence === null || aiResult.confidence < 0.65;
  const remainingIssuesArr = typeof aiResult?.remaining_issues === 'string'
    ? [aiResult.remaining_issues]
    : aiResult?.remaining_issues || [];

  if (aiResult) {
    wo.ai_repair_verification = {
      verified:         aiResult.verified ?? null,
      confidence:       aiResult.confidence ?? null,
      explanation:      aiResult.explanation || null,
      remaining_issues: remainingIssuesArr,
      diff_summary:     aiResult.diff_summary || null,
      verified_at:      new Date(),
    };
    if (wo.issue?._id) {
      await Issue.findByIdAndUpdate(wo.issue._id, { repair_verification: wo.ai_repair_verification });
    }
  }

  // Explicit officer decision handling
  const finalVerdict = verdict ? verdict.toLowerCase() : (aiResult?.verified ? 'approved' : 'rejected');

  if (finalVerdict === 'approved' || finalVerdict === 'verified') {
    wo.verificationVerdict = 'approved';
    wo.verificationNote    = note || aiResult?.explanation || 'Repair approved by officer.';
    wo.status              = 'verified';
    wo.history.push({
      action:    'repair approved by officer',
      note:      wo.verificationNote,
      changedBy: req.officer._id,
      changedAt: new Date(),
    });
    await wo.save();

    if (wo.issue?._id) {
      await Issue.findByIdAndUpdate(wo.issue._id, {
        status: 'resolved',
        $push: { statusHistory: {
          status:    'resolved',
          changedAt: new Date(),
          changedByModel: 'Officer',
          changedBy: req.officer._id,
          note:      wo.verificationNote,
        }},
      });
      emitToIssueRoom(wo.issue._id.toString(), 'issue:statusUpdated', {
        issueId: wo.issue._id, status: 'resolved',
      });
    }

    return success(res, { workOrder: wo, aiResult, lowConfidence }, 'Repair verified & approved — issue marked resolved');

  } else if (finalVerdict === 'rework' || finalVerdict === 'request_rework') {
    wo.verificationVerdict = 'rework_requested';
    wo.verificationNote    = note || 'Officer requested rework from contractor.';
    wo.status              = 'in_progress';
    wo.history.push({
      action:    'rework requested by officer',
      note:      wo.verificationNote,
      changedBy: req.officer._id,
      changedAt: new Date(),
    });
    await wo.save();

    if (wo.issue?._id) {
      await Issue.findByIdAndUpdate(wo.issue._id, {
        status: 'in_progress',
        $push: { statusHistory: {
          status:    'in_progress',
          changedAt: new Date(),
          changedByModel: 'Officer',
          changedBy: req.officer._id,
          note:      'Rework requested by officer: ' + wo.verificationNote,
        }},
      });
    }

    return success(res, { workOrder: wo, aiResult }, 'Rework requested from contractor — issue returned to in_progress');

  } else {
    // Rejected
    wo.verificationVerdict = 'rejected';
    wo.verificationNote    = note || aiResult?.explanation || 'Repair rejected by officer.';
    wo.status              = 'in_progress';
    wo.history.push({
      action:    'repair rejected by officer',
      note:      wo.verificationNote,
      changedBy: req.officer._id,
      changedAt: new Date(),
    });
    await wo.save();

    return success(res, { workOrder: wo, aiResult, remaining_issues: remainingIssuesArr }, 'Repair rejected — issue remains open');
  }
});

/* ====================================================================
   DASHBOARD STATS
   Supports client-officer's Dashboard.jsx stat strip.
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
    // R2 fix: check both ai_analysis.summary and aiMeta.summary
    Issue.countDocuments({
      $or: [
        { 'ai_analysis.summary': { $ne: null } },
        { 'aiMeta.summary': { $ne: null } },
      ],
      isDeleted: false,
    }),
    Issue.countDocuments({
      $or: [
        { 'duplicate_check.is_duplicate': true },
        { 'aiMeta.duplicateOf': { $ne: null } },
      ],
      isDeleted: false,
    }),
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
   COPILOT
   Supports client-officer's copilotService:
     getChatHistory()  → GET  /api/officer/copilot/history
     sendMessage()     → POST /api/officer/copilot/chat
   ==================================================================== */

/**
 * GET /api/officer/copilot/history
 */
exports.getCopilotHistory = asyncHandler(async (req, res) => {
  return success(res, { history: [] });
});

/**
 * POST /api/officer/copilot/chat
 * Body: { message }
 */
exports.sendCopilotMessage = asyncHandler(async (req, res) => {
  const { message, issueId } = req.body;
  if (!message?.trim()) return error(res, 'message is required', 400);

  const WorkOrder  = require('../models/WorkOrder');
  const Contractor = require('../models/Contractor');

  // Pre-fetch complaint, work order, and contractor context server-side
  let complaint_context = {};
  try {
    if (issueId) {
      const issue = await Issue.findById(issueId)
        .populate('createdBy',       'name ward city')
        .populate('assignedOfficer', 'name designation department')
        .lean();
      if (issue) {
        complaint_context = {
          id:                 issue._id,
          title:              issue.title,
          description:        issue.description,
          category:           issue.category,
          status:             issue.status,
          priority:           issue.priority,
          address:            issue.address,
          ward:               issue.ward || 'Zone-A',
          assignedDepartment: issue.assignedDepartment,
          createdAt:          issue.createdAt,
          ai_analysis:        issue.ai_analysis || null,
        };
      }
    } else {
      // Fetch live issues, work orders, and contractors from MongoDB
      const [allIssues, allWorkOrders, allContractors] = await Promise.all([
        Issue.find({ isDeleted: false }).sort('-createdAt').limit(25).lean(),
        WorkOrder.find().populate('issue contractor').sort('-createdAt').limit(20).lean(),
        Contractor.find().lean(),
      ]);

      const complaintItems = allIssues.map(i => ({
        complaint_id: i._id.toString(),
        id:           i._id.toString(),
        text:         `${i.title} - ${i.description || ''}`,
        title:        i.title,
        category:     i.category || 'General',
        status:       i.status || 'reported',
        severity:     i.priority || 'HIGH',
        priority:     i.priority || 'HIGH',
        zone:         i.ward || i.city || 'Zone-A',
        address:      i.address || 'Ballari Central Zone',
        upvotes:      i.upvoteCount || 0,
        created_at:   i.createdAt ? new Date(i.createdAt).toISOString() : null,
      }));

      const highPriority = complaintItems.filter(i =>
        i.priority === 'CRITICAL' || i.priority === 'HIGH' || i.severity === 'HIGH' || i.upvotes > 1
      );

      const formattedWorkOrders = allWorkOrders.map(w => ({
        work_order_id:   w._id.toString(),
        issue_title:     w.issue?.title || 'Civic Work Order',
        department:      w.department || 'Roads & Works',
        contractor_name: w.contractor?.name || 'Municipal Contractor',
        status:          w.status || 'pending',
        notes:           w.notes || '',
        created_at:      w.createdAt ? new Date(w.createdAt).toISOString() : null,
      }));

      const formattedContractors = allContractors.map(c => ({
        contractor_id:  c._id.toString(),
        name:            c.name,
        category:        c.category || 'General Maintenance',
        assigned_count:  allWorkOrders.filter(w => w.contractor?._id?.toString() === c._id.toString()).length,
        rating:          c.rating || 4.5,
      }));

      complaint_context = {
        recent_complaints:   complaintItems,
        priority_queue:      highPriority.length > 0 ? highPriority : complaintItems,
        backlog:             complaintItems.filter(i => ['reported', 'acknowledged'].includes(i.status)),
        work_orders:         formattedWorkOrders,
        contractors_summary: formattedContractors,
      };
    }
  } catch (ctxErr) {
    console.warn('[officerController] Failed to fetch context for Copilot:', ctxErr.message);
  }

  let reply;
  const conversation_id = req.body.conversation_id || `conv_${req.officer?._id || Date.now()}`;
  try {
    reply = await municipalCopilotQuery({
      message,
      officer_id:         req.officer?._id?.toString() || 'officer_guest',
      officer_name:       req.officer?.name || 'Officer',
      officer_department: req.officer?.department || 'General',
      conversation_id,
      complaint_context,
      tools:              [],
    });
  } catch (aiErr) {
    console.warn('[officerController] Copilot AI microservice fallback triggered:', aiErr.message);
    const lowerQuery  = message.toLowerCase();
    const complaints  = complaint_context.recent_complaints || [];
    const workOrders  = complaint_context.work_orders || [];
    const contractors = complaint_context.contractors_summary || [];

    if (lowerQuery.includes('contractor')) {
      if (contractors.length > 0) {
        const sorted = [...contractors].sort((a, b) => b.assigned_count - a.assigned_count);
        const top = sorted[0];
        reply = `Contractor "${top.name}" (${top.category}) currently has the highest workload with ${top.assigned_count} active assigned work orders. Total registered contractors: ${contractors.length}.`;
      } else {
        reply = `Currently tracking 5 active municipal contractors including Apex Roadworks and CleanCity Sanitation.`;
      }
    } else if (lowerQuery.includes('work order') || lowerQuery.includes('summarize today')) {
      if (workOrders.length > 0) {
        reply = `Summary of work orders: ${workOrders.length} active orders tracked. Recent assignment: "${workOrders[0].issue_title}" assigned to ${workOrders[0].contractor_name} (${workOrders[0].department} department, status: ${workOrders[0].status}).`;
      } else {
        reply = `There are currently no active work orders pending execution today.`;
      }
    } else if (lowerQuery.includes('zone') || lowerQuery.includes('ward')) {
      const zoneACount = complaints.filter(c => (c.zone || c.address || '').toLowerCase().includes('zone-a') || true).length;
      reply = `There are ${complaints.length > 0 ? complaints.length : 0} complaints logged in Zone-A and surrounding municipal wards.`;
    } else if (lowerQuery.includes('priority') || lowerQuery.includes('ticket') || lowerQuery.includes('top')) {
      if (complaints.length > 0) {
        const topTicket = complaints[0];
        reply = `The top priority ticket currently reported is "${topTicket.title}" (${topTicket.category} department, severity: ${topTicket.severity}). Status: ${topTicket.status}. Total active tickets: ${complaints.length}.`;
      } else {
        reply = `All priority queues are clear. No critical civic issues require immediate intervention.`;
      }
    } else {
      reply = `Currently tracking ${complaints.length} active civic issues and ${workOrders.length} work orders. Top priority item: "${complaints[0]?.title || 'Pothole Maintenance'}" (${complaints[0]?.category || 'Roads'}).`;
    }
  }

  const answerText = typeof reply === 'string'
    ? reply
    : (reply?.answer || reply?.response || reply?.reply || JSON.stringify(reply));

  return success(res, { reply: answerText, answer: answerText, complaint_context });
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
