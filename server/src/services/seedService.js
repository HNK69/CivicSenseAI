const Contractor = require('../models/Contractor');

const DEFAULT_CONTRACTORS = [
  {
    email: 'apexcivics@gmail.com',
    passwordHash: 'Contractor@123',
    name: 'Apex Civics Infrastructure',
    company: 'Apex Civics Ltd',
    category: 'Roads & Infrastructure',
    rating: 4.9,
    isActive: true,
  },
  {
    email: 'contractor@apex.gov.in',
    passwordHash: 'contractor123',
    name: 'Apex Roadworks (Demo Contractor)',
    company: 'Apex Infrastructure Ltd',
    category: 'Roads & Infrastructure',
    rating: 4.8,
    isActive: true,
  },
];

/**
 * Seeds default contractor accounts in MongoDB if they don't already exist.
 * Executes automatically upon MongoDB connection boot sequence.
 */
async function seedContractors() {
  try {
    for (const data of DEFAULT_CONTRACTORS) {
      const existing = await Contractor.findOne({ email: data.email.toLowerCase() });
      if (!existing) {
        await Contractor.create(data);
        console.log(`[seed] Created default contractor account: ${data.email}`);
      }
    }
  } catch (err) {
    console.warn('[seed] Contractor auto-seeding warning:', err.message);
  }
}

module.exports = { seedContractors, DEFAULT_CONTRACTORS };
