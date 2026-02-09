/**
 * Data Validation Script: Fix Inconsistent Request Statuses
 *
 * This script identifies and optionally fixes service requests with inconsistent data:
 * - Requests marked as COMPLETED without completedAt timestamp
 * - Requests in IN_PROGRESS state that should be COMPLETED based on message patterns
 *
 * Usage:
 *   npm run ts-node src/scripts/fix-inconsistent-statuses.ts [--dry-run] [--fix]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface InconsistentRequest {
  id: string;
  status: string;
  completedAt: Date | null;
  updatedAt: Date;
  issue: string;
  suggestedFix?: string;
}

async function analyzeRequests(): Promise<InconsistentRequest[]> {
  const issues: InconsistentRequest[] = [];

  // Find COMPLETED requests without completedAt
  const completedWithoutTimestamp = await prisma.serviceRequest.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: null,
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  completedWithoutTimestamp.forEach(req => {
    issues.push({
      ...req,
      issue: 'COMPLETED status but missing completedAt timestamp',
      suggestedFix: 'Set completedAt to updatedAt',
    });
  });

  // Find IN_PROGRESS requests with completion-related messages
  const inProgressRequests = await prisma.serviceRequest.findMany({
    where: {
      status: 'IN_PROGRESS',
    },
    include: {
      messages: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      },
    },
  });

  const completionKeywords = [
    'completed',
    'finished',
    'done',
    'thank you for completing',
    'completed the',
    'work is complete',
    'task is complete',
  ];

  inProgressRequests.forEach(req => {
    const hasCompletionMessage = req.messages.some(msg =>
      completionKeywords.some(keyword =>
        msg.content.toLowerCase().includes(keyword)
      )
    );

    if (hasCompletionMessage) {
      issues.push({
        id: req.id,
        status: req.status,
        completedAt: req.completedAt,
        updatedAt: req.updatedAt,
        issue: 'IN_PROGRESS status but has completion messages',
        suggestedFix: 'Manually review - may need status update to COMPLETED',
      });
    }
  });

  return issues;
}

async function fixInconsistencies(dryRun: boolean = true): Promise<void> {
  console.log('🔍 Analyzing service requests for inconsistencies...\n');

  const issues = await analyzeRequests();

  if (issues.length === 0) {
    console.log('✅ No inconsistencies found! All requests are properly configured.');
    return;
  }

  console.log(`⚠️  Found ${issues.length} inconsistent requests:\n`);

  issues.forEach((issue, index) => {
    console.log(`${index + 1}. Request ${issue.id.substring(0, 8)}...`);
    console.log(`   Status: ${issue.status}`);
    console.log(`   Issue: ${issue.issue}`);
    console.log(`   Suggested Fix: ${issue.suggestedFix || 'Manual review required'}`);
    console.log('');
  });

  if (dryRun) {
    console.log('ℹ️  This is a DRY RUN. No changes were made.');
    console.log('   Run with --fix to apply automatic fixes.\n');
    return;
  }

  // Apply automatic fixes for certain types of issues
  let fixedCount = 0;

  for (const issue of issues) {
    if (issue.issue === 'COMPLETED status but missing completedAt timestamp') {
      try {
        await prisma.serviceRequest.update({
          where: { id: issue.id },
          data: {
            completedAt: issue.updatedAt,
          },
        });
        console.log(`✓ Fixed: ${issue.id.substring(0, 8)} - Set completedAt timestamp`);
        fixedCount++;
      } catch (error) {
        console.error(`✗ Failed to fix ${issue.id}:`, error);
      }
    } else {
      console.log(`⚠️  Skipped: ${issue.id.substring(0, 8)} - Requires manual review`);
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} out of ${issues.length} issues.`);
  console.log(`⚠️  ${issues.length - fixedCount} issues require manual review.\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');

  try {
    await fixInconsistencies(dryRun);
  } catch (error) {
    console.error('Error running validation script:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
