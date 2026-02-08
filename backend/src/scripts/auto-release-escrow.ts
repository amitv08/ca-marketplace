/**
 * Auto-Release Escrow Script
 *
 * This script automatically releases escrow payments when the auto-release date is reached.
 *
 * Run this script via cron job:
 * - Every hour: `0 * * * * cd /app && npx ts-node src/scripts/auto-release-escrow.ts`
 * - Every 30 minutes: `*/30 * * * * cd /app && npx ts-node src/scripts/auto-release-escrow.ts`
 *
 * Usage:
 * npx ts-node src/scripts/auto-release-escrow.ts
 */

import { PrismaClient, PaymentStatus } from '@prisma/client';
import { EmailTemplateService } from '../services/email-template.service';

const prisma = new PrismaClient();

interface AutoReleaseStats {
  processed: number;
  released: number;
  failed: number;
  errors: Array<{ paymentId: string; error: string }>;
}

async function autoReleaseEscrowPayments(): Promise<AutoReleaseStats> {
  const stats: AutoReleaseStats = {
    processed: 0,
    released: 0,
    failed: 0,
    errors: [],
  };

  try {
    console.log('[Auto-Release Escrow] Starting auto-release job...');
    console.log('[Auto-Release Escrow] Current time:', new Date().toISOString());

    // Find all payments that are due for auto-release
    const duePayments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.ESCROW_HELD,
        autoReleaseAt: {
          lte: new Date(), // Auto-release date has passed
        },
        escrowReleasedAt: null, // Not already released
      },
      include: {
        request: {
          include: {
            client: {
              include: {
                user: true,
              },
            },
            ca: {
              include: {
                user: true,
              },
            },
            firm: true,
          },
        },
      },
      orderBy: {
        autoReleaseAt: 'asc',
      },
    });

    console.log(`[Auto-Release Escrow] Found ${duePayments.length} payment(s) due for auto-release`);

    if (duePayments.length === 0) {
      console.log('[Auto-Release Escrow] No payments to release. Exiting.');
      return stats;
    }

    // Process each payment
    for (const payment of duePayments) {
      stats.processed++;

      try {
        console.log(`[Auto-Release Escrow] Processing payment ${payment.id} (Request: ${payment.requestId})`);
        console.log(`  - Amount: ₹${payment.amount}`);
        console.log(`  - Auto-release date: ${payment.autoReleaseAt}`);
        console.log(`  - Days overdue: ${Math.floor((new Date().getTime() - new Date(payment.autoReleaseAt!).getTime()) / (1000 * 60 * 60 * 24))}`);

        // Release the escrow
        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.ESCROW_RELEASED,
            escrowReleasedAt: new Date(),
            releasedToCA: true,
          },
        });

        console.log(`  ✓ Payment ${payment.id} released successfully`);
        stats.released++;

        // Send notification emails
        try {
          // Email to CA
          if (payment.request.ca) {
            await EmailTemplateService.sendPaymentReleased({
              caEmail: payment.request.ca.user.email,
              caName: payment.request.ca.user.name,
              amount: payment.caAmount || payment.amount,
              clientName: payment.request.client.user.name,
              serviceType: payment.request.serviceType,
              dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/ca/dashboard`,
            });
            console.log(`  ✓ Email sent to CA: ${payment.request.ca.user.email}`);
          }

          // Email to Client
          await EmailTemplateService.sendPaymentReleased({
            caEmail: payment.request.client.user.email, // Reusing template
            caName: payment.request.client.user.name,
            amount: payment.amount,
            clientName: payment.request.ca?.user.name || 'the CA',
            serviceType: payment.request.serviceType,
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/client/dashboard`,
          });
          console.log(`  ✓ Email sent to Client: ${payment.request.client.user.email}`);
        } catch (emailError: any) {
          console.error(`  ⚠ Failed to send notification emails for payment ${payment.id}:`, emailError.message);
          // Don't fail the release if email fails - just log it
        }

        // Update service request status if needed
        if (payment.request.status === 'COMPLETED') {
          console.log(`  ✓ Service request ${payment.requestId} already marked as COMPLETED`);
        }

      } catch (error: any) {
        console.error(`  ✗ Failed to release payment ${payment.id}:`, error.message);
        stats.failed++;
        stats.errors.push({
          paymentId: payment.id,
          error: error.message,
        });
      }
    }

    console.log('\n[Auto-Release Escrow] Job completed');
    console.log(`  - Processed: ${stats.processed}`);
    console.log(`  - Released: ${stats.released}`);
    console.log(`  - Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log('\n[Auto-Release Escrow] Errors:');
      stats.errors.forEach((err) => {
        console.log(`  - Payment ${err.paymentId}: ${err.error}`);
      });
    }

    return stats;
  } catch (error: any) {
    console.error('[Auto-Release Escrow] Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Export for use in scheduler
export { autoReleaseEscrowPayments };

// Run the script
if (require.main === module) {
  autoReleaseEscrowPayments()
    .then((stats) => {
      console.log('\n[Auto-Release Escrow] ✓ Script finished successfully');
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n[Auto-Release Escrow] ✗ Script failed:', error);
      process.exit(1);
    });
}
