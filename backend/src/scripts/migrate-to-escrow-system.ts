/**
 * Migration Script: Add Escrow System
 *
 * This script migrates existing service requests and payments to the new escrow system.
 * Run this after deploying the schema changes.
 *
 * Usage:
 *   npx ts-node backend/src/scripts/migrate-to-escrow-system.ts
 */

import { PrismaClient, EscrowStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToEscrowSystem() {
  console.log('🚀 Starting escrow system migration...\n');

  try {
    // Step 1: Update existing service requests
    console.log('📋 Step 1: Updating existing service requests...');
    const existingRequests = await prisma.serviceRequest.findMany({
      include: {
        payments: true,
      },
    });

    console.log(`Found ${existingRequests.length} existing service requests`);

    let updatedRequests = 0;
    for (const request of existingRequests) {
      let escrowStatus: EscrowStatus = 'NOT_REQUIRED';

      // Determine escrow status based on current state
      if (request.status === 'PENDING') {
        escrowStatus = 'NOT_REQUIRED';
      } else if (request.status === 'ACCEPTED' || request.status === 'IN_PROGRESS') {
        // For accepted/in-progress without payment: should have been escrow
        // Mark as NOT_REQUIRED for backward compatibility
        escrowStatus = 'NOT_REQUIRED';
      } else if (request.status === 'COMPLETED') {
        const hasPayment = request.payments.some(
          (p) => p.status === 'COMPLETED' && p.releasedToCA
        );
        escrowStatus = hasPayment ? 'ESCROW_RELEASED' : 'NOT_REQUIRED';
      } else if (request.status === 'CANCELLED') {
        escrowStatus = 'NOT_REQUIRED';
      }

      await prisma.serviceRequest.update({
        where: { id: request.id },
        data: {
          escrowStatus,
        },
      });

      updatedRequests++;
    }

    console.log(`✅ Updated ${updatedRequests} service requests with escrow status`);

    // Step 2: Mark existing payments as non-escrow
    console.log('\n💳 Step 2: Marking existing payments as non-escrow...');

    const updatedPayments = await prisma.payment.updateMany({
      where: {
        // All existing payments
      },
      data: {
        isEscrow: false,
      },
    });

    console.log(`✅ Updated ${updatedPayments.count} existing payments as non-escrow`);

    // Step 3: Handle edge case - completed requests with pending payments
    console.log('\n⚠️  Step 3: Checking for completed requests with pending payments...');

    const completedWithPendingPayment = await prisma.serviceRequest.findMany({
      where: {
        status: 'COMPLETED',
        payments: {
          some: {
            status: 'PENDING',
          },
        },
      },
      include: {
        payments: true,
        client: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        ca: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (completedWithPendingPayment.length > 0) {
      console.log(`\n⚠️  Warning: Found ${completedWithPendingPayment.length} completed requests with pending payments`);
      console.log('These need manual admin review:\n');

      for (const req of completedWithPendingPayment) {
        console.log(`  📌 Request ID: ${req.id}`);
        console.log(`     Service: ${req.serviceType}`);
        console.log(`     Client: ${req.client.user.name} (${req.client.user.email})`);
        if (req.ca) {
          console.log(`     CA: ${req.ca.user.name} (${req.ca.user.email})`);
        }
        console.log(`     Pending Payments: ${req.payments.filter(p => p.status === 'PENDING').length}`);
        console.log('');
      }

      console.log(`\n💡 Recommendation: Admin should manually release these payments via payment management UI`);
    } else {
      console.log('✅ No completed requests with pending payments found');
    }

    // Step 4: Statistics
    console.log('\n📊 Migration Statistics:');
    console.log('═══════════════════════════════════════');

    const stats = {
      totalRequests: existingRequests.length,
      byStatus: {
        PENDING: existingRequests.filter(r => r.status === 'PENDING').length,
        ACCEPTED: existingRequests.filter(r => r.status === 'ACCEPTED').length,
        IN_PROGRESS: existingRequests.filter(r => r.status === 'IN_PROGRESS').length,
        COMPLETED: existingRequests.filter(r => r.status === 'COMPLETED').length,
        CANCELLED: existingRequests.filter(r => r.status === 'CANCELLED').length,
      },
      totalPayments: updatedPayments.count,
      needsReview: completedWithPendingPayment.length,
    };

    console.log(`  Total Requests Migrated:     ${stats.totalRequests}`);
    console.log(`    - PENDING:                 ${stats.byStatus.PENDING}`);
    console.log(`    - ACCEPTED:                ${stats.byStatus.ACCEPTED}`);
    console.log(`    - IN_PROGRESS:             ${stats.byStatus.IN_PROGRESS}`);
    console.log(`    - COMPLETED:               ${stats.byStatus.COMPLETED}`);
    console.log(`    - CANCELLED:               ${stats.byStatus.CANCELLED}`);
    console.log(`  Total Payments Updated:      ${stats.totalPayments}`);
    console.log(`  Requests Needing Review:     ${stats.needsReview}`);
    console.log('═══════════════════════════════════════');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n🚀 Escrow system is now active for new requests!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Run Prisma migrations: npx prisma migrate deploy');
    console.log('   2. Restart the backend server');
    console.log('   3. Test escrow flow with a test request');
    console.log('   4. Review any flagged requests in admin panel\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateToEscrowSystem()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
