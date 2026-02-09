import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams, createPaginationResponse } from '../utils';
import FirmDocumentService from '../services/firm-document.service';
import { FirmDocumentType } from '@prisma/client';

const router = Router();

/**
 * Firm Document Routes
 * Base path: /api/firm-documents
 */

// Upload a new document
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, documentType, documentUrl, fileName, fileSize, mimeType } = req.body;

    if (!firmId || !documentType || !documentUrl || !fileName) {
      return sendError(res, 'firmId, documentType, documentUrl, and fileName are required', 400);
    }

    const data = {
      firmId,
      documentType: documentType as FirmDocumentType,
      documentUrl,
      fileName,
      fileSize: fileSize ? BigInt(fileSize) : BigInt(0),
      mimeType,
      uploadedByUserId: req.user!.userId,
    };

    const document = await FirmDocumentService.uploadDocument(data);
    sendSuccess(res, document, 'Document uploaded successfully', 201);
  })
);

// Get document by ID
router.get(
  '/:documentId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const document = await FirmDocumentService.getDocumentById(documentId);
    sendSuccess(res, document);
  })
);

// Get all documents for a firm
router.get(
  '/firm/:firmId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { includeUnverified } = req.query;

    const include = includeUnverified === 'false' ? false : true;
    const documents = await FirmDocumentService.getFirmDocuments(firmId, include);
    sendSuccess(res, documents);
  })
);

// Get documents by type
router.get(
  '/firm/:firmId/type/:documentType',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, documentType } = req.params;
    const documents = await FirmDocumentService.getDocumentsByType(
      firmId,
      documentType as FirmDocumentType
    );
    sendSuccess(res, documents);
  })
);

// Get latest verified document of a type
router.get(
  '/firm/:firmId/type/:documentType/latest',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, documentType } = req.params;
    const document = await FirmDocumentService.getLatestVerifiedDocument(
      firmId,
      documentType as FirmDocumentType
    );

    if (!document) {
      return sendSuccess(res, null, 'No verified document found for this type');
    }

    sendSuccess(res, document);
  })
);

// Check document completeness
router.get(
  '/firm/:firmId/completeness',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const completeness = await FirmDocumentService.checkDocumentCompleteness(firmId);
    sendSuccess(res, completeness);
  })
);

// Get document statistics
router.get(
  '/firm/:firmId/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const stats = await FirmDocumentService.getDocumentStats(firmId);
    sendSuccess(res, stats);
  })
);

// Get verification status summary
router.get(
  '/firm/:firmId/verification-summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const summary = await FirmDocumentService.getVerificationStatusSummary(firmId);
    sendSuccess(res, summary);
  })
);

// Verify a document (Admin only)
router.post(
  '/:documentId/verify',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const { isVerified, verificationNotes } = req.body;

    if (isVerified === undefined) {
      return sendError(res, 'isVerified field is required', 400);
    }

    const data = {
      verifiedBy: req.user!.userId,
      isVerified,
      verificationNotes,
    };

    const document = await FirmDocumentService.verifyDocument(documentId, data);
    sendSuccess(res, document, 'Document verification updated');
  })
);

// Reject a document (Admin only)
router.post(
  '/:documentId/reject',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Rejection reason is required', 400);
    }

    const document = await FirmDocumentService.rejectDocument(
      documentId,
      req.user!.userId,
      reason
    );

    sendSuccess(res, document, 'Document rejected');
  })
);

// Delete a document
router.delete(
  '/:documentId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const result = await FirmDocumentService.deleteDocument(documentId, req.user!.userId);
    sendSuccess(res, result);
  })
);

// Get pending verification documents (Admin)
router.get(
  '/admin/pending-verification',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await FirmDocumentService.getPendingVerificationDocuments(pageNum, limitNum);
    sendSuccess(res, result);
  })
);

// Bulk verify documents (Admin)
router.post(
  '/admin/bulk-verify',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { documentIds, notes } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return sendError(res, 'documentIds array is required and must not be empty', 400);
    }

    const result = await FirmDocumentService.bulkVerifyDocuments(
      documentIds,
      req.user!.userId,
      notes
    );

    sendSuccess(res, result);
  })
);

// Search documents (Admin)
router.get(
  '/admin/search',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, documentType, isVerified, page, limit } = req.query;

    const filters: any = {};
    if (firmId) filters.firmId = firmId as string;
    if (documentType) filters.documentType = documentType as FirmDocumentType;
    if (isVerified !== undefined) filters.isVerified = isVerified === 'true';

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await FirmDocumentService.searchDocuments(filters, pageNum, limitNum);
    sendSuccess(res, result);
  })
);

export default router;
