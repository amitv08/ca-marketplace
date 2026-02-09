import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError } from '../utils';
import FirmReviewService from '../services/firm-review.service';

const router = Router();

/**
 * Firm Review Routes
 * Base path: /api/firm-reviews
 */

// Create a new firm review
router.post(
  '/',
  authenticate,
  authorize('CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      firmId,
      requestId,
      rating,
      review,
      professionalismRating,
      communicationRating,
      timelinessRating,
      valueForMoneyRating,
    } = req.body;

    if (!firmId || !requestId || !rating) {
      return sendError(res, 'firmId, requestId, and rating are required', 400);
    }

    // Get client ID from authenticated user
    const clientId = req.user!.clientId; // Assuming client ID is stored in user context
    if (!clientId) {
      return sendError(res, 'User is not a client', 403);
    }

    const data = {
      firmId,
      clientId,
      requestId,
      rating: parseInt(rating),
      review,
      professionalismRating: professionalismRating ? parseInt(professionalismRating) : undefined,
      communicationRating: communicationRating ? parseInt(communicationRating) : undefined,
      timelinessRating: timelinessRating ? parseInt(timelinessRating) : undefined,
      valueForMoneyRating: valueForMoneyRating ? parseInt(valueForMoneyRating) : undefined,
    };

    const firmReview = await FirmReviewService.createReview(data);
    sendSuccess(res, firmReview, 'Review submitted successfully', 201);
  })
);

// Get review by ID
router.get(
  '/:reviewId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { reviewId } = req.params;
    const review = await FirmReviewService.getReviewById(reviewId);
    sendSuccess(res, review);
  })
);

// Get all reviews for a firm
router.get(
  '/firm/:firmId',
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { page, limit, minRating } = req.query;

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');
    const minRatingNum = minRating ? parseInt(minRating as string) : undefined;

    const result = await FirmReviewService.getFirmReviews(firmId, pageNum, limitNum, minRatingNum);
    sendSuccess(res, result);
  })
);

// Get reviews by a client
router.get(
  '/client/:clientId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const { page, limit } = req.query;

    // Ensure client can only access their own reviews (unless admin)
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.clientId !== clientId) {
      return sendError(res, 'Unauthorized access to client reviews', 403);
    }

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await FirmReviewService.getClientReviews(clientId, pageNum, limitNum);
    sendSuccess(res, result);
  })
);

// Update review (client only, within 7 days)
router.put(
  '/:reviewId',
  authenticate,
  authorize('CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { reviewId } = req.params;
    const {
      rating,
      review,
      professionalismRating,
      communicationRating,
      timelinessRating,
      valueForMoneyRating,
    } = req.body;

    const clientId = req.user!.clientId;
    if (!clientId) {
      return sendError(res, 'User is not a client', 403);
    }

    const data: any = {};
    if (rating !== undefined) data.rating = parseInt(rating);
    if (review !== undefined) data.review = review;
    if (professionalismRating !== undefined) data.professionalismRating = parseInt(professionalismRating);
    if (communicationRating !== undefined) data.communicationRating = parseInt(communicationRating);
    if (timelinessRating !== undefined) data.timelinessRating = parseInt(timelinessRating);
    if (valueForMoneyRating !== undefined) data.valueForMoneyRating = parseInt(valueForMoneyRating);

    const updatedReview = await FirmReviewService.updateReview(reviewId, clientId, data);
    sendSuccess(res, updatedReview, 'Review updated successfully');
  })
);

// Delete review (client only, within 7 days)
router.delete(
  '/:reviewId',
  authenticate,
  authorize('CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { reviewId } = req.params;

    const clientId = req.user!.clientId;
    if (!clientId) {
      return sendError(res, 'User is not a client', 403);
    }

    const result = await FirmReviewService.deleteReview(reviewId, clientId);
    sendSuccess(res, result);
  })
);

// Get firm rating statistics
router.get(
  '/firm/:firmId/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const stats = await FirmReviewService.getFirmRatingStats(firmId);
    sendSuccess(res, stats);
  })
);

// Get recent reviews (Admin)
router.get(
  '/admin/recent',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await FirmReviewService.getRecentReviews(pageNum, limitNum);
    sendSuccess(res, result);
  })
);

// Get top rated firms
router.get(
  '/admin/top-rated',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, minReviews } = req.query;
    const limitNum = parseInt(limit as string || '10');
    const minReviewsNum = parseInt(minReviews as string || '5');

    const firms = await FirmReviewService.getTopRatedFirms(limitNum, minReviewsNum);
    sendSuccess(res, firms);
  })
);

// Flag review for moderation (Admin)
router.post(
  '/:reviewId/flag',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { reviewId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Reason for flagging is required', 400);
    }

    const review = await FirmReviewService.flagReview(reviewId, req.user!.userId, reason);
    sendSuccess(res, review, 'Review flagged successfully');
  })
);

// Unflag review (Admin)
router.post(
  '/:reviewId/unflag',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { reviewId } = req.params;
    const review = await FirmReviewService.unflagReview(reviewId);
    sendSuccess(res, review, 'Review unflagged successfully');
  })
);

// Get flagged reviews (Admin)
router.get(
  '/admin/flagged',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await FirmReviewService.getFlaggedReviews(pageNum, limitNum);
    sendSuccess(res, result);
  })
);

// Search reviews
router.get(
  '/admin/search',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, clientId, minRating, maxRating, page, limit } = req.query;

    const filters: any = {};
    if (firmId) filters.firmId = firmId as string;
    if (clientId) filters.clientId = clientId as string;
    if (minRating) filters.minRating = parseInt(minRating as string);
    if (maxRating) filters.maxRating = parseInt(maxRating as string);

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await FirmReviewService.searchReviews(filters, pageNum, limitNum);
    sendSuccess(res, result);
  })
);

export default router;
