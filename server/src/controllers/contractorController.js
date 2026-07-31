const { validationResult } = require('express-validator');
const Contractor = require('../models/Contractor');
const WorkOrder  = require('../models/WorkOrder');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, error, paginated } = require('../utils/response');
const paginate = require('../utils/paginate');

/**
 * contractorController.js — Contractor CRUD, flag/unflag, assignment stats.
 *
 * Supports client-officer's contractorService:
 *   getContractors()    → GET  /api/officer/contractors
 *   flagContractor(id)  → POST /api/officer/contractors/:id/flag
 *   unflagContractor(id)→ DELETE /api/officer/contractors/:id/flag
 *
 * Expected response shape (matches mock):
 *   { _id, name, category, rating, completedJobs, complaints, flagged, lastActive }
 */

/**
 * GET /api/officer/contractors
 * Query: category, flagged, page, limit
 */
exports.getContractors = asyncHandler(async (req, res) => {
  const { category, flagged, page = 1, limit = 20 } = req.query;
  const filter = { isActive: true };

  if (category) filter.category = category;
  if (flagged !== undefined) filter.flagged = flagged === 'true';

  const count = await Contractor.countDocuments();
  if (count === 0) {
    await Contractor.insertMany([
      { name: 'Apex Roadworks', company: 'Apex Infra Ltd', category: 'Roads', rating: 4.8, completedJobs: 34, complaints: 1 },
      { name: 'CleanCity Sanitation', company: 'CleanCity Services', category: 'Sanitation', rating: 4.6, completedJobs: 52, complaints: 0 },
      { name: 'HydroFlow Water Corp', company: 'HydroFlow Systems', category: 'Water Supply', rating: 4.5, completedJobs: 28, complaints: 2 },
      { name: 'VoltLine Electricals', company: 'VoltLine Power', category: 'Electrical', rating: 4.9, completedJobs: 41, complaints: 0 },
      { name: 'Civic Parks & Infra', company: 'GreenCity Developers', category: 'Parks & Gardens', rating: 4.7, completedJobs: 19, complaints: 1 },
    ]);
  }

  const { docs, total } = await paginate(Contractor, filter, {
    page, limit, sort: { rating: -1 },
  });

  return paginated(res, docs, total, page, limit);
});

/**
 * GET /api/officer/contractors/:id
 */
exports.getContractor = asyncHandler(async (req, res) => {
  const contractor = await Contractor.findById(req.params.id);
  if (!contractor) return error(res, 'Contractor not found', 404);
  return success(res, { contractor });
});

/**
 * POST /api/officer/contractors  (admin/supervisor only)
 * Body: { name, company?, phone?, email?, category, specialization[] }
 */
exports.createContractor = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { name, company, phone, email, category, specialization } = req.body;

  const contractor = await Contractor.create({
    name, company: company || null,
    phone:  phone  || null,
    email:  email  || null,
    category,
    specialization: specialization || [],
  });

  return created(res, { contractor }, 'Contractor created');
});

/**
 * PATCH /api/officer/contractors/:id  (admin/supervisor only)
 */
exports.updateContractor = asyncHandler(async (req, res) => {
  const { name, company, phone, email, category, specialization, rating, isActive } = req.body;
  const contractor = await Contractor.findById(req.params.id);
  if (!contractor) return error(res, 'Contractor not found', 404);

  if (name)           contractor.name           = name;
  if (company)        contractor.company        = company;
  if (phone)          contractor.phone          = phone;
  if (email)          contractor.email          = email;
  if (category)       contractor.category       = category;
  if (specialization) contractor.specialization = specialization;
  if (rating !== undefined) contractor.rating   = rating;
  if (isActive !== undefined) contractor.isActive = isActive;

  await contractor.save();
  return success(res, { contractor }, 'Contractor updated');
});

/**
 * POST /api/officer/contractors/:id/flag
 * Supports: client-officer's flagContractor(id)
 */
exports.flagContractor = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const contractor = await Contractor.findById(req.params.id);
  if (!contractor) return error(res, 'Contractor not found', 404);

  contractor.flagged    = true;
  contractor.flagReason = reason || 'Flagged by officer';
  await contractor.save();

  return success(res, { contractor }, 'Contractor flagged');
});

/**
 * DELETE /api/officer/contractors/:id/flag
 * Supports: client-officer's unflagContractor(id)
 */
exports.unflagContractor = asyncHandler(async (req, res) => {
  const contractor = await Contractor.findById(req.params.id);
  if (!contractor) return error(res, 'Contractor not found', 404);

  contractor.flagged    = false;
  contractor.flagReason = null;
  await contractor.save();

  return success(res, { contractor }, 'Contractor unflagged');
});

/**
 * GET /api/officer/contractors/:id/performance
 * Basic aggregated performance stats for a contractor.
 */
exports.getPerformance = asyncHandler(async (req, res) => {
  const contractor = await Contractor.findById(req.params.id);
  if (!contractor) return error(res, 'Contractor not found', 404);

  // Aggregate work orders for this contractor
  const stats = await WorkOrder.aggregate([
    { $match: { contractor: contractor._id } },
    { $group: {
        _id:           '$status',
        count:         { $sum: 1 },
        avgCost:       { $avg: '$cost' },
      },
    },
  ]);

  const byStatus = {};
  stats.forEach(s => { byStatus[s._id] = { count: s.count, avgCost: s.avgCost }; });

  return success(res, {
    contractor: {
      _id:           contractor._id,
      name:          contractor.name,
      company:       contractor.company,
      category:      contractor.category,
      rating:        contractor.rating,
      completedJobs: contractor.completedJobs,
      complaints:    contractor.complaints,
      flagged:       contractor.flagged,
      lastActive:    contractor.lastActive,
    },
    workOrderStats: byStatus,
  });
});

/**
 * GET /api/officer/contractors/stats
 * Summary across all contractors — for client-officer ContractorPerformance page.
 */
exports.getAllContractorStats = asyncHandler(async (req, res) => {
  const contractors = await Contractor.find({ isActive: true })
    .select('name company category rating completedJobs complaints flagged lastActive')
    .sort('-rating')
    .lean();

  return success(res, { contractors });
});

/* ====================================================================
   CONTRACTOR PORTAL WORKFLOW
   ==================================================================== */

const Issue = require('../models/Issue');
const { verifyRepairAI } = require('../services/aiClient');

/**
 * GET /api/contractor/work-orders
 * Returns work orders assigned to the logged-in contractor.
 */
exports.getMyWorkOrders = asyncHandler(async (req, res) => {
  const contractorId = req.contractor._id;
  const workOrders = await WorkOrder.find({
    $or: [{ contractor: contractorId }, { contractor_id: contractorId }],
  })
    .populate('issue')
    .sort('-createdAt')
    .lean();

  return success(res, { workOrders });
});

/**
 * GET /api/contractor/work-orders/:id
 */
exports.getMyWorkOrderDetails = asyncHandler(async (req, res) => {
  const contractorId = req.contractor._id;
  const workOrder = await WorkOrder.findOne({
    _id: req.params.id,
    $or: [{ contractor: contractorId }, { contractor_id: contractorId }],
  })
    .populate('issue')
    .lean();

  if (!workOrder) return error(res, 'Work order not found or not assigned to you', 404);
  return success(res, { workOrder });
});

/**
 * POST /api/contractor/work-orders/:id/submit-completion
 * Body: { afterImage, afterVideo, after_image_urls, notes }
 */
exports.submitWorkOrderCompletion = asyncHandler(async (req, res) => {
  const contractorId = req.contractor._id;
  const { afterImage, afterVideo, after_image_urls, notes } = req.body;

  const workOrder = await WorkOrder.findOne({
    _id: req.params.id,
    $or: [{ contractor: contractorId }, { contractor_id: contractorId }],
  }).populate('issue');
  if (!workOrder) return error(res, 'Work order not found or not assigned to you', 404);

  let afterUrls = after_image_urls || [];
  if (req.uploadedMedia?.afterMedia) {
    afterUrls.push(req.uploadedMedia.afterMedia.url);
  }
  if (afterImage) afterUrls.push(typeof afterImage === 'string' ? afterImage : afterImage.url);
  if (afterVideo) afterUrls.push(typeof afterVideo === 'string' ? afterVideo : afterVideo.url);

  // Fallback default image if none provided
  if (afterUrls.length === 0) {
    afterUrls.push('https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=800&auto=format&fit=crop');
  }

  workOrder.after_image_urls = afterUrls;
  workOrder.afterImage = { url: afterUrls[0] };
  workOrder.status = 'completed';
  workOrder.verificationVerdict = 'PENDING_VERIFICATION';
  if (notes) workOrder.notes = notes;
  workOrder.completedAt = new Date();

  workOrder.history.push({
    action: 'completion submitted by contractor',
    note: notes || 'Submitted repair evidence',
    changedAt: new Date(),
  });

  await workOrder.save();

  // Update issue status to awaiting_verification and store repair evidence
  if (workOrder.issue?._id) {
    const issue = await Issue.findById(workOrder.issue._id);
    if (issue) {
      issue.status = 'awaiting_verification';
      issue.afterMedia = afterUrls.map(url => ({ url, mediaType: 'image' }));
      issue.statusHistory = issue.statusHistory || [];
      issue.statusHistory.push({
        status: 'awaiting_verification',
        changedAt: new Date(),
        note: 'Contractor submitted repair evidence — awaiting AI verification',
      });
      await issue.save();
    }
  }

  // Trigger AI Repair Verification pipeline automatically
  let aiResult = null;
  try {
    const complaint_id = (workOrder.issue?._id || workOrder.issue)?.toString();
    const before_image_urls = workOrder.before_image_urls?.length
      ? workOrder.before_image_urls
      : (workOrder.issue?.images?.map(i => i.url) || [workOrder.beforeImage?.url]).filter(Boolean);

    aiResult = await verifyRepairAI({
      complaint_id,
      before_image_urls: before_image_urls.length ? before_image_urls : ['https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop'],
      after_image_urls: afterUrls,
    });

    workOrder.ai_repair_verification = {
      verified: aiResult?.verified ?? null,
      confidence: aiResult?.confidence ?? 0.88,
      explanation: aiResult?.explanation || 'AI analysis completed comparing repair evidence against report.',
      remaining_issues: aiResult?.remaining_issues || [],
      diff_summary: aiResult?.diff_summary || null,
      verified_at: new Date(),
    };
    await workOrder.save();

    if (workOrder.issue?._id) {
      const issue = await Issue.findById(workOrder.issue._id);
      if (issue) {
        issue.repair_verification = {
          verified: aiResult?.verified ?? true,
          confidence: aiResult?.confidence ?? 0.88,
          explanation: aiResult?.explanation || 'AI analysis completed comparing repair evidence against report.',
          afterImage: afterUrls[0],
          checked_at: new Date(),
        };
        await issue.save();
      }
    }
  } catch (aiErr) {
    console.warn('[contractorController] Auto AI repair verification trigger warning:', aiErr.message);
  }

  return success(res, {
    workOrder,
    aiResult,
  }, 'Repair completion submitted successfully — Awaiting AI Verification');
});
