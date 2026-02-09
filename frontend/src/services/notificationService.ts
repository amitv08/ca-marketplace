import api from './api';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  metadata?: any;
  createdAt: string;
  readAt?: string;
}

export interface NotificationResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  data: {
    count: number;
  };
}

const notificationService = {
  /**
   * Get user notifications with pagination
   */
  getNotifications: async (page = 1, limit = 20, unreadOnly = false): Promise<NotificationResponse> => {
    const response = await api.get('/notifications', {
      params: { page, limit, unreadOnly },
    });
    return response.data;
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await api.get('/notifications/unread/count');
    return response.data;
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (id: string) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    const response = await api.put('/notifications/mark-all-read');
    return response.data;
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (id: string) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  /**
   * Delete all notifications (or only read ones)
   */
  deleteAllNotifications: async (readOnly = false) => {
    const response = await api.delete('/notifications/delete-all', {
      params: { readOnly },
    });
    return response.data;
  },
};

export default notificationService;
