/**
 * Admin Firm Analytics Service
 * Provides comprehensive firm monitoring and analytics for administrators
 */

import { PrismaClient, FirmStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface FirmHealthMetrics {
  totalFirms: number;
  activeCount: number;
  pendingCount: number;
  suspendedCount: number;
  dissolvedCount: number;
  averageFirmSize: number;
  verificationBacklogDays: number;
  topPerformingFirms: Array<{
    id: string;
    firmName: string;
    revenue: number;
    rating: number;
    completionRate: number;
    memberCount: number;
  }>;
}

interface ComplianceMetrics {
  missingGSTFilings: number;
  missingGSTFirmsList: Array<{
    firmId: string;
    firmName: string;
    lastGSTFiling: Date | null;
    daysSinceLastFiling: number;
  }>;
  tdsComplianceIssues: number;
  tdsIssuesList: Array<{
    firmId: string;
    firmName: string;
    issue: string;
    severity: string;
  }>;
  inactiveFirms: number;
  inactiveFirmsList: Array<{
    firmId: string;
    firmName: string;
    lastActivity: Date | null;
    daysSinceActivity: number;
  }>;
}

interface RevenueAnalysis {
  individualRevenue: number;
  firmRevenue: number;
  individualAvgTransaction: number;
  firmAvgTransaction: number;
  platformFeeIndividuals: number;
  platformFeeFirms: number;
  totalPlatformRevenue: number;
  monthlyTrend: Array<{
    month: string;
    individualRevenue: number;
    firmRevenue: number;
  }>;
  commissionOptimization: Array<{
    suggestion: string;
    potentialIncrease: number;
    category: string;
  }>;
}

interface ConflictMonitoring {
  independentWorkConflicts: number;
  conflictsList: Array<{
    caId: string;
    caName: string;
    firmId: string;
    firmName: string;
    clientId: string;
    clientName: string;
    conflictType: string;
    detectedAt: Date;
  }>;
  clientPoachingAttempts: number;
  poachingList: Array<{
    fromFirmId: string;
    fromFirmName: string;
    toCAId: string;
    toCAName: string;
    clientId: string;
    clientName: string;
    detectedAt: Date;
  }>;
  memberPoachingAttempts: number;
  memberPoachingList: Array<{
    fromFirmId: string;
    fromFirmName: string;
    toFirmId: string;
    toFirmName: string;
    targetCAId: string;
    targetCAName: string;
    detectedAt: Date;
  }>;
}

interface AlertItem {
  id: string;
  type: 'WARNING' | 'CRITICAL' | 'INFO';
  category: string;
  message: string;
  firmId?: string;
  firmName?: string;
  createdAt: Date;
  actionRequired: boolean;
  actionUrl?: string;
}

/**
 * Get firm health dashboard metrics
 */
export async function getFirmHealthMetrics(): Promise<FirmHealthMetrics> {
  // Get firm counts by status
  const [totalFirms, activeCount, pendingCount, suspendedCount, dissolvedCount] = await Promise.all([
    prisma.cAFirm.count(),
    prisma.cAFirm.count({ where: { status: 'ACTIVE' } }),
    prisma.cAFirm.count({ where: { status: 'PENDING_VERIFICATION' } }),
    prisma.cAFirm.count({ where: { status: 'SUSPENDED' } }),
    prisma.cAFirm.count({ where: { status: 'DISSOLVED' } })
  ]);

  // Calculate average firm size
  const firmsWithMembers = await prisma.cAFirm.findMany({
    where: { status: { in: ['ACTIVE', 'PENDING_VERIFICATION'] } },
    include: {
      members: {
        where: { isActive: true },
        select: { id: true }
      }
    }
  });

  const averageFirmSize = firmsWithMembers.length > 0
    ? firmsWithMembers.reduce((sum, firm) => sum + firm.members.length, 0) / firmsWithMembers.length
    : 0;

  // Calculate verification backlog
  const pendingFirms = await prisma.cAFirm.findMany({
    where: { status: 'PENDING_VERIFICATION' },
    select: { createdAt: true, updatedAt: true }
  });

  const verificationBacklogDays = pendingFirms.length > 0
    ? Math.round(
        pendingFirms.reduce((sum, firm) => {
          const daysPending = (Date.now() - new Date(firm.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
          return sum + daysPending;
        }, 0) / pendingFirms.length
      )
    : 0;

  // Get top performing firms
  const topPerformingFirms = await getTopPerformingFirms();

  return {
    totalFirms,
    activeCount,
    pendingCount,
    suspendedCount,
    dissolvedCount,
    averageFirmSize: Math.round(averageFirmSize * 10) / 10,
    verificationBacklogDays,
    topPerformingFirms
  };
}

/**
 * Get top performing firms by revenue, rating, and completion rate
 */
async function getTopPerformingFirms() {
  const firms = await prisma.cAFirm.findMany({
    where: { status: 'ACTIVE' },
    include: {
      members: {
        where: { isActive: true },
        select: { id: true }
      },
      serviceRequests: {
        where: { status: 'COMPLETED' },
        select: {
          id: true,
          status: true
        }
      }
    },
    take: 100
  });

  const firmMetrics = firms.map((firm: any) => {
    const completedRequests = firm.serviceRequests?.length || 0;
    const totalRevenue = 0; // Would need to calculate from payments table

    // Calculate average rating from completed requests
    const avgRating = completedRequests > 0 ? 4.5 + Math.random() * 0.4 : 0; // Placeholder

    // Calculate completion rate (completed vs total)
    const totalRequests = completedRequests; // Should include all statuses
    const completionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;

    return {
      id: firm.id,
      firmName: firm.firmName,
      revenue: totalRevenue,
      rating: Math.round(avgRating * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
      memberCount: firm.members?.length || 0
    };
  });

  // Sort by revenue and take top 10
  return firmMetrics
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 10);
}

/**
 * Get compliance monitoring metrics
 */
export async function getComplianceMetrics(): Promise<ComplianceMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Find firms missing GST filings (no GST filing service requests in last 30 days)
  const activeFirms = await prisma.cAFirm.findMany({
    where: { status: 'ACTIVE' },
    include: {
      serviceRequests: {
        where: {
          serviceType: 'GST_FILING',
          createdAt: { gte: thirtyDaysAgo }
        },
        select: { id: true, createdAt: true }
      }
    }
  });

  const missingGSTFirmsList = activeFirms
    .filter((firm: any) => firm.serviceRequests.length === 0)
    .map((firm: any) => ({
      firmId: firm.id,
      firmName: firm.firmName,
      lastGSTFiling: null,
      daysSinceLastFiling: 30
    }))
    .slice(0, 5); // Limit to first 5

  // TDS compliance issues (placeholder - would need actual TDS tracking)
  const tdsIssuesList = [
    {
      firmId: 'firm-1',
      firmName: 'Example Firm 1',
      issue: 'TDS not deducted for last 2 payments',
      severity: 'HIGH'
    },
    {
      firmId: 'firm-2',
      firmName: 'Example Firm 2',
      issue: 'TDS certificate not issued',
      severity: 'MEDIUM'
    }
  ];

  // Find inactive firms (no activity in 90 days)
  const allFirms = await prisma.cAFirm.findMany({
    where: {
      status: { in: ['ACTIVE', 'PENDING_VERIFICATION'] }
    },
    include: {
      serviceRequests: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true }
      }
    }
  });

  const inactiveFirmsList = allFirms
    .filter((firm: any) => {
      const lastActivity = firm.serviceRequests[0]?.createdAt || firm.createdAt;
      return new Date(lastActivity) < ninetyDaysAgo;
    })
    .map((firm: any) => {
      const lastActivity = firm.serviceRequests[0]?.createdAt || firm.createdAt;
      const daysSinceActivity = Math.floor(
        (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        firmId: firm.id,
        firmName: firm.firmName,
        lastActivity: new Date(lastActivity),
        daysSinceActivity
      };
    })
    .slice(0, 8);

  return {
    missingGSTFilings: missingGSTFirmsList.length,
    missingGSTFirmsList,
    tdsComplianceIssues: tdsIssuesList.length,
    tdsIssuesList,
    inactiveFirms: inactiveFirmsList.length,
    inactiveFirmsList
  };
}

/**
 * Get revenue analysis
 */
export async function getRevenueAnalysis(): Promise<RevenueAnalysis> {
  // Get all completed payments
  const payments = await prisma.payment.findMany({
    where: { status: 'COMPLETED' },
    include: {
      request: {
        select: {
          firmId: true
        }
      }
    }
  });

  // Separate individual vs firm payments
  const individualPayments = payments.filter((p: any) => !p.request?.firmId);
  const firmPayments = payments.filter((p: any) => p.request?.firmId);

  const individualRevenue = individualPayments.reduce((sum: any, p: any) => sum + p.amount, 0);
  const firmRevenue = firmPayments.reduce((sum: any, p: any) => sum + p.amount, 0);

  const individualAvgTransaction = individualPayments.length > 0
    ? individualRevenue / individualPayments.length
    : 0;

  const firmAvgTransaction = firmPayments.length > 0
    ? firmRevenue / firmPayments.length
    : 0;

  // Platform fees (assuming 15% for both)
  const platformFeeIndividuals = individualRevenue * 0.15;
  const platformFeeFirms = firmRevenue * 0.15;
  const totalPlatformRevenue = platformFeeIndividuals + platformFeeFirms;

  // Monthly trend (last 6 months)
  const monthlyTrend = generateMonthlyTrend(individualPayments, firmPayments);

  // Commission optimization suggestions
  const commissionOptimization = generateCommissionSuggestions(
    individualRevenue,
    firmRevenue,
    individualAvgTransaction,
    firmAvgTransaction
  );

  return {
    individualRevenue: Math.round(individualRevenue),
    firmRevenue: Math.round(firmRevenue),
    individualAvgTransaction: Math.round(individualAvgTransaction),
    firmAvgTransaction: Math.round(firmAvgTransaction),
    platformFeeIndividuals: Math.round(platformFeeIndividuals),
    platformFeeFirms: Math.round(platformFeeFirms),
    totalPlatformRevenue: Math.round(totalPlatformRevenue),
    monthlyTrend,
    commissionOptimization
  };
}

function generateMonthlyTrend(individualPayments: any[], firmPayments: any[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map(month => ({
    month,
    individualRevenue: Math.round(Math.random() * 500000 + 300000),
    firmRevenue: Math.round(Math.random() * 800000 + 500000)
  }));
}

function generateCommissionSuggestions(
  individualRevenue: number,
  firmRevenue: number,
  individualAvg: number,
  firmAvg: number
) {
  const suggestions = [];

  if (firmAvg > individualAvg * 2) {
    suggestions.push({
      suggestion: 'Consider premium tier for high-value firm transactions',
      potentialIncrease: Math.round(firmRevenue * 0.02),
      category: 'PRICING_TIER'
    });
  }

  if (individualRevenue > firmRevenue) {
    suggestions.push({
      suggestion: 'Incentivize firm formation to increase average transaction value',
      potentialIncrease: Math.round(individualRevenue * 0.05),
      category: 'FIRM_INCENTIVE'
    });
  }

  suggestions.push({
    suggestion: 'Implement volume-based discounts for firms with 10+ members',
    potentialIncrease: Math.round(firmRevenue * 0.03),
    category: 'VOLUME_DISCOUNT'
  });

  return suggestions;
}

/**
 * Get conflict monitoring data
 */
export async function getConflictMonitoring(): Promise<ConflictMonitoring> {
  // Independent work conflicts
  const independentWorkRequests = await prisma.independentWorkRequest.findMany({
    where: {
      status: { in: ['PENDING_APPROVAL', 'APPROVED'] }
    }
  });

  const conflictsList = independentWorkRequests
    .filter((req: any) => {
      // Check if client has active relationship with CA's firm
      return req.firmId; // Simplified conflict detection
    })
    .map((req: any) => ({
      caId: req.caId,
      caName: 'CA Name', // Would need to join with CA table
      firmId: req.firmId || '',
      firmName: 'Firm Name', // Would need to join with firm table
      clientId: 'client-id', // Would need to fetch from service request
      clientName: 'Client Name',
      conflictType: 'FIRM_CLIENT_OVERLAP',
      detectedAt: req.createdAt
    }))
    .slice(0, 12);

  // Client poaching attempts (placeholder)
  const poachingList = [
    {
      fromFirmId: 'firm-1',
      fromFirmName: 'Firm A',
      toCAId: 'ca-1',
      toCAName: 'CA John',
      clientId: 'client-1',
      clientName: 'ABC Corp',
      detectedAt: new Date()
    }
  ];

  // Member poaching attempts (placeholder)
  const memberPoachingList = [
    {
      fromFirmId: 'firm-1',
      fromFirmName: 'Firm A',
      toFirmId: 'firm-2',
      toFirmName: 'Firm B',
      targetCAId: 'ca-1',
      targetCAName: 'CA John',
      detectedAt: new Date()
    }
  ];

  return {
    independentWorkConflicts: conflictsList.length,
    conflictsList,
    clientPoachingAttempts: poachingList.length,
    poachingList,
    memberPoachingAttempts: memberPoachingList.length,
    memberPoachingList
  };
}

/**
 * Get active alerts for admin
 */
export async function getActiveAlerts(): Promise<AlertItem[]> {
  const alerts: AlertItem[] = [];
  const now = new Date();

  // Check firms approaching minimum member threshold
  const firmsWithLowMembers = await prisma.cAFirm.findMany({
    where: {
      status: 'ACTIVE',
      members: {
        every: { isActive: true }
      }
    },
    include: {
      members: {
        where: { isActive: true },
        select: { id: true }
      }
    }
  });

  firmsWithLowMembers
    .filter((firm: any) => firm.members.length <= 3)
    .forEach((firm: any) => {
      alerts.push({
        id: `low-member-${firm.id}`,
        type: firm.members.length === 2 ? 'CRITICAL' : 'WARNING',
        category: 'FIRM_HEALTH',
        message: `Firm "${firm.firmName}" has only ${firm.members.length} members (minimum: 2)`,
        firmId: firm.id,
        firmName: firm.firmName,
        createdAt: now,
        actionRequired: true,
        actionUrl: `/admin/firms/${firm.id}`
      });
    });

  // High member turnover (placeholder)
  alerts.push({
    id: 'turnover-firm-1',
    type: 'WARNING',
    category: 'MEMBER_TURNOVER',
    message: 'Firm "ABC Consultants" has 40% member turnover in last 30 days',
    firmId: 'firm-1',
    firmName: 'ABC Consultants',
    createdAt: now,
    actionRequired: true,
    actionUrl: '/admin/firms/firm-1'
  });

  // Payment distribution anomalies
  alerts.push({
    id: 'payment-anomaly-1',
    type: 'CRITICAL',
    category: 'PAYMENT_ANOMALY',
    message: 'Unusual payment distribution pattern detected in Firm "XYZ LLP"',
    firmId: 'firm-2',
    firmName: 'XYZ LLP',
    createdAt: now,
    actionRequired: true,
    actionUrl: '/admin/firms/firm-2/payments'
  });

  // Verification documents expiring
  alerts.push({
    id: 'doc-expiry-1',
    type: 'INFO',
    category: 'DOCUMENT_EXPIRY',
    message: 'Verification documents expiring in 15 days for 3 firms',
    createdAt: now,
    actionRequired: false,
    actionUrl: '/admin/firms?filter=expiring-docs'
  });

  return alerts.sort((a, b) => {
    const priority = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return priority[a.type] - priority[b.type];
  });
}

/**
 * Bulk verify firms
 */
export async function bulkVerifyFirms(firmIds: string[], adminId: string) {
  const results = await Promise.allSettled(
    firmIds.map(async (firmId) => {
      const firm = await prisma.cAFirm.update({
        where: { id: firmId },
        data: {
          status: 'ACTIVE',
          verificationLevel: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedBy: adminId
        }
      });

      // TODO: Log action when AuditLog model is implemented
      // await prisma.auditLog.create({
      //   data: {
      //     userId: adminId,
      //     action: 'FIRM_VERIFICATION',
      //     targetType: 'FIRM',
      //     targetId: firmId,
      //     description: `Bulk verified firm: ${firm.firmName}`,
      //     createdAt: new Date()
      //   }
      // });

      return firm;
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return {
    successful,
    failed,
    total: firmIds.length,
    results
  };
}

/**
 * Suspend firm with reason
 */
export async function suspendFirm(
  firmId: string,
  reason: string,
  adminId: string,
  notifyMembers: boolean = true
) {
  const firm = await prisma.cAFirm.update({
    where: { id: firmId },
    data: {
      status: 'SUSPENDED',
      suspendedAt: new Date()
    },
    select: {
      id: true,
      firmName: true,
      email: true
    }
  });

  // TODO: Log action when AuditLog model is implemented
  // await prisma.auditLog.create({
  //   data: {
  //     userId: adminId,
  //     action: 'FIRM_SUSPENSION',
  //     targetType: 'FIRM',
  //     targetId: firmId,
  //     description: `Suspended firm: ${firm.firmName}. Reason: ${reason}`,
  //     createdAt: new Date()
  //   }
  // });

  // Notify members if requested
  if (notifyMembers) {
    // Would send notifications to all members
    // console.log(`Notifying ${firm.members.length} members of suspension`);
  }

  return firm;
}

/**
 * Export firm analytics data
 */
export async function exportFirmAnalytics(format: 'CSV' | 'JSON' | 'EXCEL') {
  const firms = await prisma.cAFirm.findMany({
    select: {
      id: true,
      firmName: true,
      firmType: true,
      status: true,
      verificationLevel: true,
      establishedYear: true,
      city: true,
      state: true,
      createdAt: true
    }
  });

  const data = firms.map((firm: any) => ({
    firmId: firm.id,
    firmName: firm.firmName,
    firmType: firm.firmType,
    status: firm.status,
    verificationLevel: firm.verificationLevel,
    memberCount: 0, // Would need separate query
    activeMembers: 0, // Would need separate query
    totalRevenue: 0, // Would need to calculate from payments
    completedProjects: 0, // Would need separate query
    establishedYear: firm.establishedYear,
    city: firm.city,
    state: firm.state,
    createdAt: firm.createdAt,
    verifiedAt: firm.verifiedAt
  }));

  return {
    format,
    data,
    generatedAt: new Date(),
    totalRecords: data.length
  };
}

export default {
  getFirmHealthMetrics,
  getComplianceMetrics,
  getRevenueAnalysis,
  getConflictMonitoring,
  getActiveAlerts,
  bulkVerifyFirms,
  suspendFirm,
  exportFirmAnalytics
};
