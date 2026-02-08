/**
 * Dashboard Service
 * Handles fetching real-time dashboard metrics
 */

import api from './api';

export interface ClientDashboardMetrics {
  totalRequests: number;
  pendingCount: number;
  acceptedCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  totalSpent: number;
  averageRating: number | null;
  pendingPayments: number;
  recentActivity: {
    requestsThisMonth: number;
    requestsThisWeek: number;
    lastRequestDate: string | null;
  };
}

export interface CADashboardMetrics {
  totalRequests: number;
  pendingCount: number;
  acceptedCount: number;
  inProgressCount: number;
  completedCount: number;
  activeCapacity: {
    current: number;
    max: number;
    percentage: number;
  };
  earningsThisMonth: number;
  totalEarnings: number;
  pendingPayments: number;
  reputationScore: number;
  averageRating: number | null;
  totalReviews: number;
  abandonmentCount: number;
  verificationStatus: string;
  firmInfo: {
    isFirmMember: boolean;
    firmName: string | null;
    firmRole: string | null;
  } | null;
}

export interface AdminDashboardMetrics {
  totalUsers: number;
  usersByRole: {
    clients: number;
    cas: number;
    admins: number;
  };
  pendingVerification: number;
  totalRequests: number;
  requestsByStatus: {
    pending: number;
    accepted: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  totalRevenue: number;
  platformFees: number;
  revenueThisMonth: number;
  avgCompletionTime: number;
  systemHealth: {
    activeUsers24h: number;
    requestsToday: number;
    paymentsToday: number;
    errorRate: number;
  };
  recentActivity: {
    newUsersThisWeek: number;
    newRequestsThisWeek: number;
    completedRequestsThisWeek: number;
  };
}

class DashboardService {
  /**
   * Get client dashboard metrics
   */
  async getClientMetrics(): Promise<{ success: boolean; data: ClientDashboardMetrics }> {
    const response = await api.get('/dashboard/client-metrics');
    return response.data;
  }

  /**
   * Get CA dashboard metrics
   */
  async getCAMetrics(): Promise<{ success: boolean; data: CADashboardMetrics }> {
    const response = await api.get('/dashboard/ca-metrics');
    return response.data;
  }

  /**
   * Get admin dashboard metrics
   */
  async getAdminMetrics(): Promise<{ success: boolean; data: AdminDashboardMetrics }> {
    const response = await api.get('/dashboard/admin-metrics');
    return response.data;
  }

  /**
   * Get aggregated historical metrics
   * @param days - Number of days (default: 30)
   */
  async getAggregatedMetrics(days: number = 30): Promise<{ success: boolean; data: any[] }> {
    const response = await api.get(`/dashboard/aggregated-metrics?days=${days}`);
    return response.data;
  }
}

export const dashboardService = new DashboardService();
