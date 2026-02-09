import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError } from '../utils';
import PaymentDistributionService from '../services/payment-distribution.service';
import WalletService from '../services/wallet.service';
import TaxService from '../services/tax.service';
import { PayoutStatus, PayoutMethod } from '@prisma/client';

const router = Router();

/**
 * Payment Distribution Routes
 * Base paths:
 * - /api/firms/:id/distribution-templates
 * - /api/projects/:id/distribution-setup
 * - /api/payments/:id/distribute
 * - /api/firm/wallet
 * - /api/member/wallet
 */

// ===========================
// DISTRIBUTION TEMPLATES
// ===========================

// Create/update distribution template
router.post(
  '/firms/:firmId/distribution-templates',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { role, defaultPercentage, minPercentage, maxPercentage } = req.body;

    if (!role || defaultPercentage === undefined || minPercentage === undefined || maxPercentage === undefined) {
      return sendError(res, 'role, defaultPercentage, minPercentage, and maxPercentage are required', 400);
    }

    const template = await PaymentDistributionService.createDistributionTemplate({
      firmId,
      role,
      defaultPercentage: parseFloat(defaultPercentage),
      minPercentage: parseFloat(minPercentage),
      maxPercentage: parseFloat(maxPercentage),
    });

    sendSuccess(res, template, 'Distribution template created successfully', 201);
  })
);

// Get all templates for a firm
router.get(
  '/firms/:firmId/distribution-templates',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;

    const templates = await PaymentDistributionService.getFirmDistributionTemplates(firmId);
    sendSuccess(res, templates);
  })
);

// ===========================
// PROJECT DISTRIBUTION
// ===========================

// Setup project-based custom distribution
router.post(
  '/projects/:requestId/distribution-setup',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { firmId, type, shares, bonuses } = req.body;

    if (!firmId || !shares || !Array.isArray(shares)) {
      return sendError(res, 'firmId and shares array are required', 400);
    }

    const distribution = await PaymentDistributionService.setupProjectDistribution({
      firmId,
      requestId,
      type: type || 'PROJECT_BASED',
      shares,
      bonuses,
    });

    sendSuccess(res, distribution, 'Project distribution setup created successfully', 201);
  })
);

// Apply default role-based distribution
router.post(
  '/projects/:requestId/apply-default-distribution',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;

    const distribution = await PaymentDistributionService.applyDefaultDistribution(requestId);
    sendSuccess(res, distribution, 'Default distribution applied successfully', 201);
  })
);

// Approve distribution share (by CA)
router.post(
  '/distribution-shares/:shareId/approve',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { shareId } = req.params;
    const { signature } = req.body;

    const caId = req.user!.caId;
    if (!caId) {
      return sendError(res, 'User is not a CA', 403);
    }

    const share = await PaymentDistributionService.approveDistributionShare(shareId, caId, signature);
    sendSuccess(res, share, 'Distribution share approved successfully');
  })
);

// Get distribution statistics for firm
router.get(
  '/firms/:firmId/distribution-stats',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;

    const stats = await PaymentDistributionService.getDistributionStats(firmId);
    sendSuccess(res, stats);
  })
);

// ===========================
// PAYMENT DISTRIBUTION
// ===========================

// Distribute payment automatically
router.post(
  '/payments/:paymentId/distribute',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;

    const result = await PaymentDistributionService.distributePayment(paymentId);
    sendSuccess(res, result, 'Payment distributed successfully');
  })
);

// ===========================
// FIRM WALLET
// ===========================

// Get firm wallet details
router.get(
  '/firm/:firmId/wallet',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;

    const wallet = await WalletService.getFirmWallet(firmId);
    sendSuccess(res, wallet);
  })
);

// ===========================
// MEMBER/CA WALLET
// ===========================

// Get CA wallet details
router.get(
  '/member/:caId/wallet',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId } = req.params;

    // Ensure CA can only access their own wallet (unless admin)
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to CA wallet', 403);
    }

    const wallet = await WalletService.getCAWallet(caId);
    sendSuccess(res, wallet);
  })
);

// Get own wallet (convenience endpoint)
router.get(
  '/member/wallet',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const caId = req.user!.caId;
    if (!caId) {
      return sendError(res, 'User is not a CA', 403);
    }

    const wallet = await WalletService.getCAWallet(caId);
    sendSuccess(res, wallet);
  })
);

// ===========================
// PAYOUT REQUESTS
// ===========================

// Request payout/withdrawal (Firm)
router.post(
  '/firm/:firmId/wallet/withdraw',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const {
      amount,
      payoutMethod,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    } = req.body;

    if (!amount || !payoutMethod || !accountHolderName) {
      return sendError(res, 'amount, payoutMethod, and accountHolderName are required', 400);
    }

    const payout = await WalletService.requestPayout({
      firmId,
      amount: parseFloat(amount),
      payoutMethod: payoutMethod as PayoutMethod,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    });

    sendSuccess(res, payout, 'Payout request created successfully', 201);
  })
);

// Request payout/withdrawal (CA)
router.post(
  '/member/wallet/withdraw',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const caId = req.user!.caId;
    if (!caId) {
      return sendError(res, 'User is not a CA', 403);
    }

    const {
      amount,
      payoutMethod,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    } = req.body;

    if (!amount || !payoutMethod || !accountHolderName) {
      return sendError(res, 'amount, payoutMethod, and accountHolderName are required', 400);
    }

    const payout = await WalletService.requestPayout({
      caId,
      amount: parseFloat(amount),
      payoutMethod: payoutMethod as PayoutMethod,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    });

    sendSuccess(res, payout, 'Payout request created successfully', 201);
  })
);

// Get payout requests (Admin - all requests)
router.get(
  '/admin/payout-requests',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, page, limit } = req.query;

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await WalletService.getPayoutRequests(
      undefined,
      undefined,
      status as PayoutStatus,
      pageNum,
      limitNum
    );

    sendSuccess(res, result);
  })
);

// Get firm payout requests
router.get(
  '/firm/:firmId/payout-requests',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { status, page, limit } = req.query;

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await WalletService.getPayoutRequests(
      firmId,
      undefined,
      status as PayoutStatus,
      pageNum,
      limitNum
    );

    sendSuccess(res, result);
  })
);

// Get CA payout requests
router.get(
  '/member/:caId/payout-requests',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId } = req.params;

    // Ensure CA can only access their own requests (unless admin)
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to payout requests', 403);
    }

    const { status, page, limit } = req.query;

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await WalletService.getPayoutRequests(
      undefined,
      caId,
      status as PayoutStatus,
      pageNum,
      limitNum
    );

    sendSuccess(res, result);
  })
);

// Approve payout (Admin)
router.post(
  '/payout-requests/:payoutId/approve',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { payoutId } = req.params;

    const payout = await WalletService.approvePayout(payoutId, req.user!.userId);
    sendSuccess(res, payout, 'Payout approved successfully');
  })
);

// Process payout (Admin/System)
router.post(
  '/payout-requests/:payoutId/process',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { payoutId } = req.params;
    const { transactionRef } = req.body;

    const payout = await WalletService.processPayout(payoutId, transactionRef);
    sendSuccess(res, payout, 'Payout processed successfully');
  })
);

// Reject payout (Admin)
router.post(
  '/payout-requests/:payoutId/reject',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { payoutId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Rejection reason is required', 400);
    }

    const payout = await WalletService.rejectPayout(payoutId, reason);
    sendSuccess(res, payout, 'Payout rejected successfully');
  })
);

// ===========================
// TRANSACTION HISTORY
// ===========================

// Get firm transaction history
router.get(
  '/firm/:firmId/transactions',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { page, limit } = req.query;

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await WalletService.getTransactionHistory(firmId, undefined, pageNum, limitNum);
    sendSuccess(res, result);
  })
);

// Get CA transaction history
router.get(
  '/member/:caId/transactions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId } = req.params;

    // Ensure CA can only access their own transactions (unless admin)
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to transactions', 403);
    }

    const { page, limit } = req.query;

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await WalletService.getTransactionHistory(undefined, caId, pageNum, limitNum);
    sendSuccess(res, result);
  })
);

// ===========================
// TAX RECORDS
// ===========================

// Get quarterly TDS summary
router.get(
  '/tax/tds-summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { financialYear, quarter, firmId, caId } = req.query;

    if (!financialYear || !quarter) {
      return sendError(res, 'financialYear and quarter are required', 400);
    }

    // Authorization check
    if (caId && req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to tax records', 403);
    }

    const summary = await TaxService.getQuarterlyTDSSummary(
      financialYear as string,
      quarter as string,
      firmId as string,
      caId as string
    );

    sendSuccess(res, summary);
  })
);

// Generate TDS certificate (Form 16A)
router.get(
  '/tax/tds-certificate',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const caId = req.user!.caId;
    if (!caId) {
      return sendError(res, 'User is not a CA', 403);
    }

    const { financialYear, quarter } = req.query;

    if (!financialYear || !quarter) {
      return sendError(res, 'financialYear and quarter are required', 400);
    }

    const certificate = await TaxService.generateTDSCertificate(
      financialYear as string,
      quarter as string,
      caId
    );

    sendSuccess(res, certificate);
  })
);

// Get GST summary
router.get(
  '/tax/gst-summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { financialYear, month, firmId, caId } = req.query;

    if (!financialYear || !month) {
      return sendError(res, 'financialYear and month are required', 400);
    }

    // Authorization check
    if (caId && req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to tax records', 403);
    }

    const summary = await TaxService.getGSTSummary(
      financialYear as string,
      month as string,
      firmId as string,
      caId as string
    );

    sendSuccess(res, summary);
  })
);

// Get all tax records
router.get(
  '/tax/records',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, caId, financialYear, taxType, page, limit } = req.query;

    // Authorization check
    if (caId && req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to tax records', 403);
    }

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await TaxService.getTaxRecords(
      firmId as string,
      caId as string,
      financialYear as string,
      taxType as any,
      pageNum,
      limitNum
    );

    sendSuccess(res, result);
  })
);

// Get tax statistics
router.get(
  '/tax/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, caId, financialYear } = req.query;

    // Authorization check
    if (caId && req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to tax statistics', 403);
    }

    const stats = await TaxService.getTaxStats(
      firmId as string,
      caId as string,
      financialYear as string
    );

    sendSuccess(res, stats);
  })
);

export default router;
