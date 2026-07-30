/**
 * paginate.js — Pagination helper for Mongoose queries.
 * @param {Model}  Model    — Mongoose model
 * @param {Object} filter   — query filter
 * @param {Object} options  — { page, limit, sort, populate }
 * @returns {{ docs, total, page, limit }}
 */
const paginate = async (Model, filter = {}, options = {}) => {
  const page  = Math.max(1, parseInt(options.page, 10)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
  const skip  = (page - 1) * limit;
  const sort  = options.sort || { createdAt: -1 };

  let query = Model.find(filter).sort(sort).skip(skip).limit(limit);

  if (options.populate) {
    const pops = Array.isArray(options.populate) ? options.populate : [options.populate];
    pops.forEach(p => { query = query.populate(p); });
  }

  if (options.select) query = query.select(options.select);

  const [docs, total] = await Promise.all([
    query.exec(),
    Model.countDocuments(filter),
  ]);

  return { docs, total, page, limit };
};

module.exports = paginate;
