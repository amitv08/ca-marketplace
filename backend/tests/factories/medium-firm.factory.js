/**
 * Medium Firm Factory
 * Creates medium-sized firm with 15 members for testing scaling and distribution
 */

const { PrismaClient } = require('@prisma/client');
const { createSoloPractitioner } = require('./solo-practitioner.factory');
const prisma = new PrismaClient();

/**
 * Create a medium firm with 15 members
 * @param {Object} overrides - Custom data to override defaults
 * @returns {Promise<{firm: Object, members: Array, membersByRole: Object}>}
 */
async function createMediumFirm(overrides = {}) {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 1000000);

  const firmData = {
    firmName: `Professional Tax Consultants LLP ${randomId}`,
    firmType: 'LLP',
    registrationNumber: `REG${randomId}`,
    panNumber: 'BBBBB5678B',
    gstin: '29BBBBB0000B1Z5',
    email: `medium_${timestamp}@test.com`,
    phone: `98765${String(randomId).padStart(5, '0')}`,
    address: '456 Business Park, Corporate Tower',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    establishedYear: 2015,
    status: 'ACTIVE',
    verificationLevel: 'VERIFIED',
    description: 'Leading tax consultancy firm with specialized team for all tax and compliance needs',
    website: `https://www.taxconsultants${randomId}.com`,
    ...(overrides.firm || {})
  };

  console.log('Creating medium firm...');
  const firm = await prisma.firm.create({
    data: firmData
  });

  const members = [];
  const membersByRole = {
    managingPartner: [],
    partners: [],
    seniorCAs: [],
    juniorCAs: [],
    associates: []
  };

  // Define member roles and their configurations
  const memberRoles = [
    {
      role: 'MANAGING_PARTNER',
      count: 1,
      membershipType: 'EQUITY_PARTNER',
      experienceYears: 15,
      hourlyRate: 4000,
      specialization: ['AUDIT', 'TAX_FILING', 'CORPORATE_TAX'],
      equityPercentage: 40.0,
      key: 'managingPartner'
    },
    {
      role: 'PARTNER',
      count: 3,
      membershipType: 'EQUITY_PARTNER',
      experienceYears: 10,
      hourlyRate: 3000,
      specialization: ['GST', 'INCOME_TAX', 'COMPLIANCE'],
      equityPercentage: 15.0,
      key: 'partners'
    },
    {
      role: 'SENIOR_CA',
      count: 5,
      membershipType: 'SALARIED_PARTNER',
      experienceYears: 7,
      hourlyRate: 2200,
      specialization: ['GST', 'TAX_FILING', 'BOOKKEEPING'],
      monthlySalary: 80000,
      key: 'seniorCAs'
    },
    {
      role: 'JUNIOR_CA',
      count: 4,
      membershipType: 'SALARIED_PARTNER',
      experienceYears: 4,
      hourlyRate: 1500,
      specialization: ['BOOKKEEPING', 'TAX_FILING'],
      monthlySalary: 55000,
      key: 'juniorCAs'
    },
    {
      role: 'ASSOCIATE',
      count: 2,
      membershipType: 'CONSULTANT',
      experienceYears: 2,
      hourlyRate: 1000,
      specialization: ['BOOKKEEPING', 'DATA_ENTRY'],
      consultantRate: 800,
      key: 'associates'
    }
  ];

  let totalCreated = 0;

  for (const roleConfig of memberRoles) {
    console.log(`Creating ${roleConfig.count} ${roleConfig.role}(s)...`);

    for (let i = 0; i < roleConfig.count; i++) {
      const caData = await createSoloPractitioner({
        user: {
          name: `${firm.firmName} - ${roleConfig.role.replace(/_/g, ' ')} ${i + 1}`
        },
        ca: {
          experienceYears: roleConfig.experienceYears + Math.floor(Math.random() * 2),
          hourlyRate: roleConfig.hourlyRate + Math.floor(Math.random() * 500),
          specialization: roleConfig.specialization,
          rating: 4.5 + Math.random() * 0.4,
          totalReviews: 30 + Math.floor(Math.random() * 70),
          completedProjects: 50 + Math.floor(Math.random() * 150)
        }
      });

      const memberData = {
        firmId: firm.id,
        caId: caData.ca.id,
        role: roleConfig.role,
        membershipType: roleConfig.membershipType,
        isActive: true,
        joinedAt: new Date()
      };

      // Add role-specific fields
      if (roleConfig.equityPercentage) {
        memberData.equityPercentage = roleConfig.equityPercentage;
      }
      if (roleConfig.monthlySalary) {
        memberData.monthlySalary = roleConfig.monthlySalary;
      }
      if (roleConfig.consultantRate) {
        memberData.consultantRate = roleConfig.consultantRate;
      }

      const member = await prisma.firmMember.create({
        data: memberData
      });

      members.push(member);
      membersByRole[roleConfig.key].push({ ...caData, membership: member });

      totalCreated++;
      console.log(`  Created ${totalCreated}/15 members`);
    }
  }

  console.log(`Medium firm "${firm.firmName}" created successfully with ${totalCreated} members`);

  return {
    firm,
    members,
    membersByRole,
    totalMembers: totalCreated,
    allCAs: members.map(m => membersByRole[Object.keys(membersByRole).find(key =>
      membersByRole[key].find(ca => ca.membership.id === m.id)
    )])
  };
}

/**
 * Delete medium firm and all associated data
 * @param {string} firmId - Firm ID to delete
 */
async function deleteMediumFirm(firmId) {
  // Get all members
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
  createMediumFirm,
  deleteMediumFirm
};
