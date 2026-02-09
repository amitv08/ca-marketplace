/**
 * Test script to verify database constraints for CA Firms
 * Run with: node test-constraints.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConstraints() {
  console.log('🧪 Testing CA Firms Database Constraints\n');

  try {
    // Test 1: Single Active Firm Per CA
    console.log('Test 1: Single Active Firm Constraint');
    console.log('---------------------------------------');

    // Create test CA
    const testUser = await prisma.user.create({
      data: {
        email: `test-ca-${Date.now()}@test.com`,
        password: 'hashed_password',
        name: 'Test CA',
        role: 'CA',
      }
    });

    const testCA = await prisma.charteredAccountant.create({
      data: {
        userId: testUser.id,
        caLicenseNumber: `TEST-${Date.now()}`,
        specialization: ['GST'],
        experienceYears: 5,
        hourlyRate: 1000,
        verificationStatus: 'VERIFIED',
      }
    });

    // Create first firm
    const firm1 = await prisma.cAFirm.create({
      data: {
        firmName: `Test Firm 1 ${Date.now()}`,
        registrationNumber: `REG1-${Date.now()}`,
        email: `firm1-${Date.now()}@test.com`,
        phone: '1234567890',
        firmType: 'PARTNERSHIP',
        establishedYear: 2020,
        status: 'ACTIVE',
      }
    });

    // Create second firm
    const firm2 = await prisma.cAFirm.create({
      data: {
        firmName: `Test Firm 2 ${Date.now()}`,
        registrationNumber: `REG2-${Date.now()}`,
        email: `firm2-${Date.now()}@test.com`,
        phone: '0987654321',
        firmType: 'LLP',
        establishedYear: 2021,
        status: 'ACTIVE',
      }
    });

    // Add CA to first firm (should succeed)
    await prisma.firmMembership.create({
      data: {
        firmId: firm1.id,
        caId: testCA.id,
        role: 'JUNIOR_CA',
        isActive: true,
      }
    });
    console.log('✅ CA successfully added to Firm 1 (active)');

    // Try to add same CA to second firm while still active (should fail)
    try {
      await prisma.firmMembership.create({
        data: {
          firmId: firm2.id,
          caId: testCA.id,
          role: 'SENIOR_CA',
          isActive: true,
        }
      });
      console.log('❌ CONSTRAINT FAILED: CA was added to second active firm (should have been blocked)');
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('✅ CONSTRAINT WORKING: CA cannot join second active firm');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }

    console.log('\nTest 2: Rating Range Constraints (1-5)');
    console.log('----------------------------------------');

    // Try to create firm review with invalid rating (should fail)
    const testClient = await prisma.user.create({
      data: {
        email: `test-client-${Date.now()}@test.com`,
        password: 'hashed_password',
        name: 'Test Client',
        role: 'CLIENT',
      }
    });

    const clientProfile = await prisma.client.create({
      data: {
        userId: testClient.id,
      }
    });

    const testRequest = await prisma.serviceRequest.create({
      data: {
        clientId: clientProfile.id,
        caId: testCA.id,
        firmId: firm1.id,
        serviceType: 'GST_FILING',
        description: 'Test request',
        status: 'COMPLETED',
      }
    });

    try {
      await prisma.firmReview.create({
        data: {
          firmId: firm1.id,
          clientId: clientProfile.id,
          requestId: testRequest.id,
          rating: 6, // Invalid: should be 1-5
        }
      });
      console.log('❌ CONSTRAINT FAILED: Rating of 6 was accepted (should be blocked)');
    } catch (error) {
      if (error.code === 'P2000' || error.message.includes('rating_range')) {
        console.log('✅ CONSTRAINT WORKING: Rating must be 1-5');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }

    // Valid rating should work
    const validReview = await prisma.firmReview.create({
      data: {
        firmId: firm1.id,
        clientId: clientProfile.id,
        requestId: testRequest.id,
        rating: 4,
      }
    });
    console.log('✅ Valid rating (4) accepted successfully');

    console.log('\nTest 3: Commission Percent Range (0-100%)');
    console.log('-------------------------------------------');

    try {
      await prisma.firmMembership.update({
        where: { id: (await prisma.firmMembership.findFirst({ where: { caId: testCA.id }})).id },
        data: { commissionPercent: 150 }, // Invalid: >100%
      });
      console.log('❌ CONSTRAINT FAILED: Commission of 150% was accepted');
    } catch (error) {
      if (error.message.includes('commission_percent_range')) {
        console.log('✅ CONSTRAINT WORKING: Commission must be 0-100%');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }

    console.log('\nTest 4: Minimum CA Required (>=2)');
    console.log('----------------------------------');

    try {
      await prisma.cAFirm.update({
        where: { id: firm1.id },
        data: { minimumCARequired: 1 }, // Invalid: must be >=2
      });
      console.log('❌ CONSTRAINT FAILED: minimumCARequired=1 was accepted');
    } catch (error) {
      if (error.message.includes('minimum_ca_required_range')) {
        console.log('✅ CONSTRAINT WORKING: minimumCARequired must be >=2');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }

    console.log('\nTest 5: Established Year Validation');
    console.log('------------------------------------');

    try {
      await prisma.cAFirm.update({
        where: { id: firm1.id },
        data: { establishedYear: 3000 }, // Invalid: future year
      });
      console.log('❌ CONSTRAINT FAILED: Future year accepted');
    } catch (error) {
      if (error.message.includes('established_year_realistic')) {
        console.log('✅ CONSTRAINT WORKING: establishedYear must be realistic');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }

    console.log('\n🎉 All constraint tests completed!\n');

    // Cleanup
    console.log('Cleaning up test data...');
    await prisma.firmReview.deleteMany({ where: { firmId: { in: [firm1.id, firm2.id] }}});
    await prisma.serviceRequest.deleteMany({ where: { caId: testCA.id }});
    await prisma.firmMembership.deleteMany({ where: { caId: testCA.id }});
    await prisma.cAFirm.deleteMany({ where: { id: { in: [firm1.id, firm2.id] }}});
    await prisma.charteredAccountant.delete({ where: { id: testCA.id }});
    await prisma.client.delete({ where: { id: clientProfile.id }});
    await prisma.user.deleteMany({ where: { id: { in: [testUser.id, testClient.id] }}});
    console.log('✅ Cleanup complete\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConstraints();
