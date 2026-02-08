import { Router, Request, Response } from 'express';
import { authenticate, asyncHandler } from '../middleware';
import { NotificationService } from '../services/notification.service';
import { sendSuccess, sendError, parsePaginationParams } from '../utils';

const router = Router();

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for the authenticated user
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, unreadOnly } = req.query;
    const { skip, take } = parsePaginationParams(page as string, limit as string);

    const result = await NotificationService.getUserNotifications(req.user!.userId, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      unreadOnly: unreadOnly === 'true',
    });

    return sendSuccess(res, result);
  })
);

/**
 * @route   GET /api/notifications/unread/count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get(
  '/unread/count',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const count = await NotificationService.getUnreadCount(req.user!.userId);

    return sendSuccess(res, { count });
  })
);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put(
  '/:id/read',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const notification = await NotificationService.markAsRead(id, req.user!.userId);

      return sendSuccess(res, notification, 'Notification marked as read');
    } catch (error: any) {
      if (error.code === 'P2025') {
        return sendError(res, 'Notification not found or access denied', 404);
      }
      throw error;
    }
  })
);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put(
  '/mark-all-read',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await NotificationService.markAllAsRead(req.user!.userId);

    return sendSuccess(res, { count: result.count }, `${result.count} notification(s) marked as read`);
  })
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      await NotificationService.deleteNotification(id, req.user!.userId);

      return sendSuccess(res, null, 'Notification deleted successfully');
    } catch (error: any) {
      if (error.code === 'P2025') {
        return sendError(res, 'Notification not found or access denied', 404);
      }
      throw error;
    }
  })
);

/**
 * @route   DELETE /api/notifications/delete-all
 * @desc    Delete all notifications (or only read ones)
 * @access  Private
 */
router.delete(
  '/delete-all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { readOnly } = req.query;

    const result = await NotificationService.deleteAllNotifications(
      req.user!.userId,
      readOnly === 'true'
    );

    return sendSuccess(res, { count: result.count }, `${result.count} notification(s) deleted`);
  })
);

export default router;
