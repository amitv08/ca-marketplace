/**
 * Large Firm Factory
 * Creates large enterprise firm with 50+ members for performance testing
 */

const { PrismaClient } = require('@prisma/client');
const { createSoloPractitioner } = require('./solo-practitioner.factory');
const prisma = new PrismaClient();

/**
 * Create a large firm with specified number of members (default 50)
 * @param {number} memberCount - Number of members (default: 50, max: 100)
 * @param {Object} overrides - Custom data to override defaults
 * @returns {Promise<{firm: Object, members: Array, membersByRole: Object, stats: Object}>}
 */
async function createLargeFirm(memberCount = 50, overrides = {}) {
  if (memberCount > 100) {
    console.warn('Warning: Creating firm with more than 100 members may take several minutes');
  }

  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 1000000);

  const firmData = {
    firmName: `Enterprise Tax & Audit Corporation ${randomId}`,
    firmType: 'CORPORATE',
    registrationNumber: `REG${randomId}`,
    panNumber: 'CCCCC9012C',
    gstin: '07CCCCC0000C1Z5',
    email: `large_${timestamp}@test.com`,
    phone: `98765${String(randomId).padStart(5, '0')}`,
    address: '789 Corporate Tower, Financial District',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    establishedYear: 2010,
    status: 'ACTIVE',
    verificationLevel: 'PREMIUM',
    description: 'Leading enterprise tax and audit corporation serving Fortune 500 companies',
    website: `https://www.enterprise${randomId}.com`,
    ...(overrides.firm || {})
  };

  console.log(`Creating large firm with ${memberCount} members...`);
  const startTime = Date.now();

  const firm = await prisma.firm.create({
    data: firmData
  });

  // Distribution of roles (percentages)
  const roleDistribution = {
    MANAGING_PARTNER: Math.max(1, Math.floor(memberCount * 0.02)), // 2% (min 1)
    PARTNER: Math.floor(memberCount * 0.10), // 10%
    SENIOR_CA: Math.floor(memberCount * 0.30), // 30%
    JUNIOR_CA: Math.floor(memberCount * 0.40), // 40%
    ASSOCIATE: Math.floor(memberCount * 0.18) // 18%
  };

  // Adjust to match exact count
  const totalAllocated = Object.values(roleDistribution).reduce((a, b) => a + b, 0);
  if (totalAllocated < memberCount) {
    roleDistribution.JUNIOR_CA += (memberCount - totalAllocated);
  }

  console.log('Role Distribution:', roleDistribution);

  const members = [];
  const membersByRole = {
    managingPartners: [],
    partners: [],
    seniorCAs: [],
    juniorCAs: [],
    associates: []
  };

  let createdCount = 0;

  // Role configurations
  const roleConfigs = {
    MANAGING_PARTNER: {
      membershipType: 'EQUITY_PARTNER',
      experienceRange: [15, 20],
      rateRange: [4000, 6000],
      specializations: [['AUDIT', 'CORPORATE_TAX', 'M&A']],
      equityPercentage: 25.0,
      key: 'managingPartners'
    },
    PARTNER: {
      membershipType: 'EQUITY_PARTNER',
      experienceRange: [10, 15],
      rateRange: [3000, 4000],
      specializations: [['GST', 'INCOME_TAX'], ['AUDIT', 'COMPLIANCE'], ['CORPORATE_TAX']],
      equityPercentage: 15.0,
      key: 'partners'
    },
    SENIOR_CA: {
      membershipType: 'SALARIED_PARTNER',
      experienceRange: [6, 10],
      rateRange: [2000, 3000],
      specializations: [['GST', 'TAX_FILING'], ['AUDIT'], ['COMPLIANCE'], ['BOOKKEEPING']],
      monthlySalary: 90000,
      key: 'seniorCAs'
    },
    JUNIOR_CA: {
      membershipType: 'SALARIED_PARTNER',
      experienceRange: [3, 6],
      rateRange: [1200, 2000],
      specializations: [['TAX_FILING'], ['BOOKKEEPING'], ['GST']],
      monthlySalary: 60000,
      key: 'juniorCAs'
    },
    ASSOCIATE: {
      membershipType: 'CONSULTANT',
      experienceRange: [1, 3],
      rateRange: [800, 1200],
      specializations: [['BOOKKEEPING'], ['DATA_ENTRY']],
      consultantRate: 900,
      key: 'associates'
    }
  };

  // Create members for each role
  for (const [role, count] of Object.entries(roleDistribution)) {
    const config = roleConfigs[role];
    console.log(`\nCreating ${count} ${role}(s)...`);

    const batchSize = 10; // Process in batches for better performance

    for (let i = 0; i < count; i++) {
      // Random experience and rate within range
      const exp = Math.floor(Math.random() * (config.experienceRange[1] - config.experienceRange[0])) +
        config.experienceRange[0];
      const rate = Math.floor(Math.random() * (config.rateRange[1] - config.rateRange[0])) +
        config.rateRange[0];

      // Random specialization from available options
      const specialization = config.specializations[i % config.specializations.length];

      const caData = await createSoloPractitioner({
        user: {
          name: `${firm.firmName} - ${role.replace(/_/g, ' ')} ${String(i + 1).padStart(3, '0')}`
        },
        ca: {
          experienceYears: exp,
          hourlyRate: rate,
          specialization,
          rating: 4.3 + Math.random() * 0.6, // 4.3 to 4.9
          totalReviews: 20 + Math.floor(Math.random() * 180),
          completedProjects: 30 + Math.floor(Math.random() * 270)
        }
      });

      const memberData = {
        firmId: firm.id,
        caId: caData.ca.id,
        role,
        membershipType: config.membershipType,
        isActive: true,
        joinedAt: new Date()
      };

      // Add role-specific compensation
      if (config.equityPercentage) {
        memberData.equityPercentage = config.equityPercentage / roleDistribution[role];
      }
      if (config.monthlySalary) {
        memberData.monthlySalary = config.monthlySalary + Math.floor(Math.random() * 20000);
      }
      if (config.consultantRate) {
        memberData.consultantRate = config.consultantRate + Math.floor(Math.random() * 200);
      }

      const member = await prisma.firmMember.create({
        data: memberData
      });

      members.push(member);
      membersByRole[config.key].push({ ...caData, membership: member });

      createdCount++;

      // Progress update every 10 members
      if (createdCount % batchSize === 0 || createdCount === memberCount) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  Progress: ${createdCount}/${memberCount} members (${elapsed}s)`);
      }
    }
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  const stats = {
    totalMembers: createdCount,
    roleBreakdown: {
      managingPartners: membersByRole.managingPartners.length,
      partners: membersByRole.partners.length,
      seniorCAs: membersByRole.seniorCAs.length,
      juniorCAs: membersByRole.juniorCAs.length,
      associates: membersByRole.associates.length
    },
    creationTime: `${totalTime}s`,
    averageTimePerMember: `${(totalTime / createdCount).toFixed(3)}s`
  };

  console.log(`\n✅ Large firm "${firm.firmName}" created successfully!`);
  console.log('Stats:', stats);

  return {
    firm,
    members,
    membersByRole,
    stats,
    allCAs: members.flatMap(m =>
      Object.values(membersByRole)
        .flat()
        .filter(ca => ca.membership?.id === m.id)
    )
  };
}

/**
 * Create multiple large firms (for performance testing)
 * @param {number} firmCount - Number of firms to create
 * @param {number} membersPerFirm - Members per firm
 * @returns {Promise<Array>}
 */
async function createMultipleLargeFirms(firmCount, membersPerFirm = 50) {
  console.log(`Creating ${firmCount} large firms with ${membersPerFirm} members each...`);
  const firms = [];

  for (let i = 0; i < firmCount; i++) {
    console.log(`\n--- Creating Firm ${i + 1}/${firmCount} ---`);
    const firm = await createLargeFirm(membersPerFirm, {
      firm: {
        firmName: `Large Firm ${i + 1}`
      }
    });
    firms.push(firm);
  }

  return firms;
}

/**
 * Delete large firm and all associated data
 * @param {string} firmId - Firm ID to delete
 */
async function deleteLargeFirm(firmId) {
  console.log(`Deleting large firm ${firmId}...`);
  const startTime = Date.now();

  // Get all members
  const members = await prisma.firmMember.findMany({
    where: { firmId },
    select: { ca: { select: { userId: true } } }
  });

  console.log(`Found ${members.length} members to delete`);

  // Delete in batches
  const batchSize = 20;
  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (member) => {
        const userId = member.ca.userId;
        await prisma.charteredAccountant.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
      })
    );
    console.log(`  Deleted ${Math.min(i + batchSize, members.length)}/${members.length} members`);
  }

  // Delete firm members
  await prisma.firmMember.deleteMany({ where: { firmId } });

  // Delete firm
  await prisma.firm.delete({ where: { id: firmId } });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Firm deleted in ${totalTime}s`);
}

module.exports = {
  createLargeFirm,
  createMultipleLargeFirms,
  deleteLargeFirm
};
