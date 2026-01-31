/**
 * Solo Practitioner Factory
 * Creates individual CA for baseline testing
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Create a solo practitioner (individual CA)
 * @param {Object} overrides - Custom data to override defaults
 * @returns {Promise<{user: Object, ca: Object}>}
 */
async function createSoloPractitioner(overrides = {}) {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 1000000);

  const defaultData = {
    user: {
      name: `CA Amit Sharma ${randomId}`,
      email: `solo_${timestamp}_${randomId}@test.com`,
      password: 'Test@1234',
      role: 'CA',
      isVerified: true,
      phone: `98765${String(randomId).padStart(5, '0')}`
    },
    ca: {
      caLicenseNumber: `ICAI${randomId}`,
      verificationStatus: 'VERIFIED',
      specialization: ['GST', 'TAX_FILING'],
      experienceYears: 5,
      hourlyRate: 1500,
      description: 'Experienced GST and Tax filing specialist with proven track record',
      rating: 4.7,
      totalReviews: 45,
      completedProjects: 120,
      availability: 'AVAILABLE',
      maxConcurrentRequests: 10,
      qualifications: ['CA', 'CPA'],
      languages: ['English', 'Hindi']
    }
  };

  // Merge with overrides
  const userData = { ...defaultData.user, ...(overrides.user || {}) };
  const caData = { ...defaultData.ca, ...(overrides.ca || {}) };

  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      role: userData.role,
      isVerified: userData.isVerified,
      phone: userData.phone
    }
  });

  // Create CA profile
  const ca = await prisma.charteredAccountant.create({
    data: {
      userId: user.id,
      caLicenseNumber: caData.caLicenseNumber,
      verificationStatus: caData.verificationStatus,
      specialization: caData.specialization,
      experienceYears: caData.experienceYears,
      hourlyRate: caData.hourlyRate,
      description: caData.description,
      rating: caData.rating,
      totalReviews: caData.totalReviews,
      completedProjects: caData.completedProjects,
      availability: caData.availability,
      maxConcurrentRequests: caData.maxConcurrentRequests,
      qualifications: caData.qualifications,
      languages: caData.languages
    }
  });

  return { user, ca };
}

/**
 * Create multiple solo practitioners
 * @param {number} count - Number of CAs to create
 * @param {Object} baseOverrides - Base overrides for all CAs
 * @returns {Promise<Array>}
 */
async function createMultipleSoloPractitioners(count, baseOverrides = {}) {
  const practitioners = [];

  for (let i = 0; i < count; i++) {
    const overrides = {
      ...baseOverrides,
      user: {
        ...(baseOverrides.user || {}),
        name: `CA User ${i + 1}`
      }
    };

    const practitioner = await createSoloPractitioner(overrides);
    practitioners.push(practitioner);
  }

  return practitioners;
}

/**
 * Delete solo practitioner (for cleanup)
 * @param {string} userId - User ID to delete
 */
async function deleteSoloPractitioner(userId) {
  // Delete in correct order due to foreign keys
  await prisma.charteredAccountant.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

module.exports = {
  createSoloPractitioner,
  createMultipleSoloPractitioners,
  deleteSoloPractitioner
};
