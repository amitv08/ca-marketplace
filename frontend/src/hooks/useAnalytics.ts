/**
 * useAnalytics Hook
 * Custom hook for fetching analytics data with caching and error handling
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface DateRange {
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
}

export interface DashboardMetrics {
  users: {
    total: number;
    newUsers: number;
    clients: number;
    cas: number;
    growthRate: number;
  };
  requests: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    completionRate: number;
  };
  revenue: {
    total: number;
    platformFees: number;
    caPayout: number;
    averageOrderValue: number;
    growthRate: number;
  };
  engagement: {
    averageRating: number;
    reviewsCount: number;
    repeatClientRate: number;
    caUtilizationRate: number;
  };
}

export interface FunnelData {
  registrations: number;
  verifiedUsers: number;
  firstRequest: number;
  firstPayment: number;
  repeatCustomers: number;
  conversionRates: {
    registrationToVerified: number;
    verifiedToRequest: number;
    requestToPayment: number;
    paymentToRepeat: number;
    overallConversion: number;
  };
}

export interface RevenueData {
  date: string;
  totalRevenue: number;
  platformFees: number;
  caPayout: number;
  transactionCount: number;
}

export interface CAUtilizationData {
  caId: string;
  caName: string;
  totalHours: number;
  bookedHours: number;
  utilizationRate: number;
  revenue: number;
  requestsCompleted: number;
  averageRating: number;
}

interface UseAnalyticsState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch dashboard metrics
 */
export function useDashboardMetrics(dateRange?: DateRange): UseAnalyticsState<DashboardMetrics> {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
      }

      const response = await axios.get(`${API_BASE_URL}/admin/analytics/dashboard?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard metrics');
      console.error('Dashboard metrics error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Fetch funnel data
 */
export function useFunnelData(dateRange?: DateRange): UseAnalyticsState<FunnelData> {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
      }

      const response = await axios.get(`${API_BASE_URL}/admin/analytics/funnel?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch funnel data');
      console.error('Funnel data error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Fetch revenue data
 */
export function useRevenueData(
  dateRange?: DateRange,
  groupBy: 'day' | 'week' | 'month' = 'day'
): UseAnalyticsState<RevenueData[]> {
  const [data, setData] = useState<RevenueData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ groupBy });
      if (dateRange) {
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
      }

      const response = await axios.get(`${API_BASE_URL}/admin/analytics/revenue?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch revenue data');
      console.error('Revenue data error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Fetch CA utilization data
 */
export function useCAUtilization(
  dateRange?: DateRange,
  caId?: string
): UseAnalyticsState<CAUtilizationData[]> {
  const [data, setData] = useState<CAUtilizationData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
      }
      if (caId) {
        params.append('caId', caId);
      }

      const response = await axios.get(`${API_BASE_URL}/admin/analytics/ca-utilization?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch CA utilization');
      console.error('CA utilization error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, caId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Track analytics event
 */
export function useTrackEvent() {
  const trackEvent = useCallback(async (eventType: string, metadata?: any) => {
    try {
      await axios.post(
        `${API_BASE_URL}/analytics/track`,
        { eventType, metadata },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
    } catch (err) {
      console.error('Failed to track event:', err);
    }
  }, []);

  return trackEvent;
}

export default {
  useDashboardMetrics,
  useFunnelData,
  useRevenueData,
  useCAUtilization,
  useTrackEvent,
};
