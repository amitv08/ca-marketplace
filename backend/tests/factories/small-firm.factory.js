/**
 * Small Firm Factory
 * Creates small firm with 3 CAs for testing firm dynamics
 */

const { PrismaClient } = require('@prisma/client');
const { createSoloPractitioner } = require('./solo-practitioner.factory');
const prisma = new PrismaClient();

/**
 * Create a small firm with 3 members
 * @param {Object} overrides - Custom data to override defaults
 * @returns {Promise<{firm: Object, members: Array, managingPartner: Object, partner: Object, associate: Object}>}
 */
async function createSmallFirm(overrides = {}) {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 1000000);

  const firmData = {
    firmName: `Test & Associates ${randomId}`,
    firmType: 'PARTNERSHIP',
    registrationNumber: `REG${randomId}`,
    panNumber: 'AAAAA1234A',
    gstin: '22AAAAA0000A1Z5',
    email: `firm_${timestamp}@test.com`,
    phone: `98765${String(randomId).padStart(5, '0')}`,
    address: '123 Test Street, Business District',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    establishedYear: 2018,
    status: 'ACTIVE',
    verificationLevel: 'VERIFIED',
    description: 'Professional CA firm providing comprehensive tax and audit services',
    website: `https://www.testfirm${randomId}.com`,
    ...(overrides.firm || {})
  };

  // Create firm
  const firm = await prisma.firm.create({
    data: firmData
  });

  const members = [];
  const memberDetails = {};

  // 1. Managing Partner
  console.log('Creating Managing Partner...');
  const managingPartnerData = await createSoloPractitioner({
    user: {
      name: `${firm.firmName} - Managing Partner`,
      ...(overrides.managingPartner?.user || {})
    },
    ca: {
      experienceYears: 10,
      hourlyRate: 2500,
      specialization: ['AUDIT', 'TAX_FILING', 'GST'],
      rating: 4.9,
      totalReviews: 150,
      completedProjects: 300,
      ...(overrides.managingPartner?.ca || {})
    }
  });

  const managingPartnerMember = await prisma.firmMember.create({
    data: {
      firmId: firm.id,
      caId: managingPartnerData.ca.id,
      role: 'MANAGING_PARTNER',
      membershipType: 'EQUITY_PARTNER',
      equityPercentage: 50.0,
      isActive: true,
      joinedAt: new Date()
    }
  });

  members.push(managingPartnerMember);
  memberDetails.managingPartner = { ...managingPartnerData, membership: managingPartnerMember };

  // 2. Partner
  console.log('Creating Partner...');
  const partnerData = await createSoloPractitioner({
    user: {
      name: `${firm.firmName} - Partner`,
      ...(overrides.partner?.user || {})
    },
    ca: {
      experienceYears: 7,
      hourlyRate: 2000,
      specialization: ['GST', 'COMPLIANCE'],
      rating: 4.7,
      totalReviews: 85,
      completedProjects: 180,
      ...(overrides.partner?.ca || {})
    }
  });

  const partnerMember = await prisma.firmMember.create({
    data: {
      firmId: firm.id,
      caId: partnerData.ca.id,
      role: 'PARTNER',
      membershipType: 'EQUITY_PARTNER',
      equityPercentage: 30.0,
      isActive: true,
      joinedAt: new Date()
    }
  });

  members.push(partnerMember);
  memberDetails.partner = { ...partnerData, membership: partnerMember };

  // 3. Associate
  console.log('Creating Associate...');
  const associateData = await createSoloPractitioner({
    user: {
      name: `${firm.firmName} - Associate`,
      ...(overrides.associate?.user || {})
    },
    ca: {
      experienceYears: 3,
      hourlyRate: 1200,
      specialization: ['TAX_FILING', 'BOOKKEEPING'],
      rating: 4.5,
      totalReviews: 40,
      completedProjects: 95,
      ...(overrides.associate?.ca || {})
    }
  });

  const associateMember = await prisma.firmMember.create({
    data: {
      firmId: firm.id,
      caId: associateData.ca.id,
      role: 'ASSOCIATE',
      membershipType: 'SALARIED_PARTNER',
      monthlySalary: 50000,
      isActive: true,
      joinedAt: new Date()
    }
  });

  members.push(associateMember);
  memberDetails.associate = { ...associateData, membership: associateMember };

  console.log(`Small firm "${firm.firmName}" created successfully with 3 members`);

  return {
    firm,
    members,
    managingPartner: memberDetails.managingPartner,
    partner: memberDetails.partner,
    associate: memberDetails.associate,
    allCAs: [
      managingPartnerData.ca,
      partnerData.ca,
      associateData.ca
    ]
  };
}

/**
 * Delete small firm and all associated data
 * @param {string} firmId - Firm ID to delete
 */
async function deleteSmallFirm(firmId) {
  // Get all members first
  const members = await prisma.firmMember.findMany({
    where: { firmId },
    select: { ca: { select: { userId: true } } }
  });

  // Delete firm members
  await prisma.firmMember.deleteMany({ where: { firmId } });

  // Delete firm
  await prisma.firm.delete({ where: { id: firmId } });

  // Delete CAs and users
  for (const member of members) {
    const userId = member.ca.userId;
    await prisma.charteredAccountant.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }
}

module.exports = {
  createSmallFirm,
  deleteSmallFirm
};
