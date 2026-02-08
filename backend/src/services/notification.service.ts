import { prisma } from '../config';
import { NotificationType } from '@prisma/client';
import { LoggerService } from './logger.service';
import { getSocketIO } from '../config/socket';

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * Create a new notification for a user
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          link: data.link,
          metadata: data.metadata,
        },
      });

      // Emit real-time notification via Socket.IO
      try {
        const io = getSocketIO();
        if (io) {
          io.to(`user:${data.userId}`).emit('notification', {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            link: notification.link,
            createdAt: notification.createdAt,
          });
          LoggerService.info('Real-time notification sent', { notificationId: notification.id, userId: data.userId });
        }
      } catch (socketError) {
        LoggerService.error('Failed to emit real-time notification', socketError as Error);
        // Don't fail the notification creation if Socket.IO fails
      }

      LoggerService.info('Notification created', {
        notificationId: notification.id,
        userId: data.userId,
        type: data.type,
      });

      return notification;
    } catch (error) {
      LoggerService.error('Failed to create notification', error as Error);
      throw error;
    }
  }

  /**
   * Create multiple notifications at once (bulk create)
   */
  static async createBulkNotifications(notifications: CreateNotificationData[]) {
    try {
      const created = await prisma.notification.createMany({
        data: notifications.map(n => ({
          userId: n.userId,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link,
          metadata: n.metadata,
        })),
      });

      // Emit real-time notifications
      try {
        const io = getSocketIO();
        if (io) {
          notifications.forEach(notif => {
            io.to(`user:${notif.userId}`).emit('notification', {
              type: notif.type,
              title: notif.title,
              message: notif.message,
              link: notif.link,
            });
          });
        }
      } catch (socketError) {
        LoggerService.error('Failed to emit bulk real-time notifications', socketError as Error);
      }

      return created;
    } catch (error) {
      LoggerService.error('Failed to create bulk notifications', error as Error);
      throw error;
    }
  }

  /**
   * Get all notifications for a user with pagination
   */
  static async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options.unreadOnly) {
      where.read = false;
    }

    try {
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      LoggerService.error('Failed to get user notifications', error as Error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: string) {
    try {
      const count = await prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      return count;
    } catch (error) {
      LoggerService.error('Failed to get unread count', error as Error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.update({
        where: {
          id: notificationId,
          userId, // Ensure user owns this notification
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      LoggerService.info('Notification marked as read', { notificationId, userId });

      return notification;
    } catch (error) {
      LoggerService.error('Failed to mark notification as read', error as Error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      LoggerService.info('All notifications marked as read', { userId, count: result.count });

      return result;
    } catch (error) {
      LoggerService.error('Failed to mark all notifications as read', error as Error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.delete({
        where: {
          id: notificationId,
          userId, // Ensure user owns this notification
        },
      });

      LoggerService.info('Notification deleted', { notificationId, userId });

      return notification;
    } catch (error) {
      LoggerService.error('Failed to delete notification', error as Error);
      throw error;
    }
  }

  /**
   * Delete all notifications for a user (optional: only read ones)
   */
  static async deleteAllNotifications(userId: string, readOnly = false) {
    try {
      const where: any = { userId };
      if (readOnly) {
        where.read = true;
      }

      const result = await prisma.notification.deleteMany({ where });

      LoggerService.info('Notifications deleted', { userId, count: result.count, readOnly });

      return result;
    } catch (error) {
      LoggerService.error('Failed to delete notifications', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // Helper methods for creating specific notification types
  // ============================================================================

  /**
   * Notify client that their request was accepted
   */
  static async notifyRequestAccepted(clientUserId: string, requestId: string, caName: string, serviceType: string) {
    return this.createNotification({
      userId: clientUserId,
      type: 'REQUEST_ACCEPTED',
      title: 'Service Request Accepted',
      message: `${caName} has accepted your ${serviceType.replace(/_/g, ' ')} request`,
      link: `/requests/${requestId}`,
      metadata: { requestId, caName, serviceType },
    });
  }

  /**
   * Notify client that their request was rejected
   */
  static async notifyRequestRejected(clientUserId: string, requestId: string, caName: string, serviceType: string) {
    return this.createNotification({
      userId: clientUserId,
      type: 'REQUEST_REJECTED',
      title: 'Service Request Rejected',
      message: `${caName} has declined your ${serviceType.replace(/_/g, ' ')} request`,
      link: `/requests/${requestId}`,
      metadata: { requestId, caName, serviceType },
    });
  }

  /**
   * Notify client that their request was completed
   */
  static async notifyRequestCompleted(clientUserId: string, requestId: string, serviceType: string) {
    return this.createNotification({
      userId: clientUserId,
      type: 'REQUEST_COMPLETED',
      title: 'Service Completed',
      message: `Your ${serviceType.replace(/_/g, ' ')} service has been completed`,
      link: `/requests/${requestId}`,
      metadata: { requestId, serviceType },
    });
  }

  /**
   * Notify user about a new message
   */
  static async notifyNewMessage(receiverUserId: string, senderName: string, requestId: string) {
    return this.createNotification({
      userId: receiverUserId,
      type: 'NEW_MESSAGE',
      title: 'New Message',
      message: `${senderName} sent you a message`,
      link: `/requests/${requestId}`,
      metadata: { requestId, senderName },
    });
  }

  /**
   * Notify CA about payment received
   */
  static async notifyPaymentReceived(caUserId: string, amount: number, requestId: string) {
    return this.createNotification({
      userId: caUserId,
      type: 'PAYMENT_RECEIVED',
      title: 'Payment Received',
      message: `You received ₹${amount.toFixed(2)} for a completed service`,
      link: `/requests/${requestId}`,
      metadata: { amount, requestId },
    });
  }

  /**
   * Notify client about pending payment
   */
  static async notifyPaymentPending(clientUserId: string, amount: number, requestId: string, serviceType: string) {
    return this.createNotification({
      userId: clientUserId,
      type: 'PAYMENT_PENDING',
      title: 'Payment Pending',
      message: `Payment of ₹${amount.toFixed(2)} is pending for ${serviceType.replace(/_/g, ' ')} service`,
      link: `/requests/${requestId}`,
      metadata: { amount, requestId, serviceType },
    });
  }

  /**
   * Notify CA about a new review
   */
  static async notifyReviewReceived(caUserId: string, rating: number, clientName: string, requestId: string) {
    return this.createNotification({
      userId: caUserId,
      type: 'REVIEW_RECEIVED',
      title: 'New Review',
      message: `${clientName} left you a ${rating}-star review`,
      link: `/requests/${requestId}`,
      metadata: { rating, clientName, requestId },
    });
  }

  /**
   * Notify CA about firm invitation
   */
  static async notifyFirmInvitation(caUserId: string, firmName: string, invitationId: string) {
    return this.createNotification({
      userId: caUserId,
      type: 'FIRM_INVITATION',
      title: 'Firm Invitation',
      message: `${firmName} has invited you to join their firm`,
      link: `/firm-invitations/${invitationId}`,
      metadata: { firmName, invitationId },
    });
  }

  /**
   * Send system alert to user
   */
  static async notifySystemAlert(userId: string, title: string, message: string, link?: string) {
    return this.createNotification({
      userId,
      type: 'SYSTEM_ALERT',
      title,
      message,
      link,
    });
  }
}
