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
