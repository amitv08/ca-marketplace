/**
 * useDashboardMetrics Hook
 * Custom hook for fetching and caching dashboard metrics
 * Implements 5-minute cache to reduce API calls
 */

import { useState, useEffect, useCallback } from 'react';
import { dashboardService } from '../services';
import type {
  ClientDashboardMetrics,
  CADashboardMetrics,
  AdminDashboardMetrics
} from '../services';

type DashboardType = 'client' | 'ca' | 'admin';
type DashboardMetrics = ClientDashboardMetrics | CADashboardMetrics | AdminDashboardMetrics;

interface UseDashboardMetricsReturn<T extends DashboardMetrics> {
  metrics: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

// Cache storage (in-memory)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const metricsCache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Check if cache entry is still valid
 */
function isCacheValid(cacheKey: string): boolean {
  const cached = metricsCache.get(cacheKey);
  if (!cached) return false;

  const now = Date.now();
  const age = now - cached.timestamp;
  return age < CACHE_DURATION;
}

/**
 * Get cached data if valid
 */
function getCachedData<T>(cacheKey: string): T | null {
  if (isCacheValid(cacheKey)) {
    const cached = metricsCache.get(cacheKey);
    return cached ? cached.data : null;
  }
  return null;
}

/**
 * Set cache data
 */
function setCacheData<T>(cacheKey: string, data: T): void {
  metricsCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear cache for a specific key or all keys
 */
export function clearDashboardCache(cacheKey?: string): void {
  if (cacheKey) {
    metricsCache.delete(cacheKey);
  } else {
    metricsCache.clear();
  }
}

/**
 * Custom hook for fetching dashboard metrics
 * @param dashboardType - Type of dashboard (client, ca, admin)
 * @param autoRefresh - Auto refresh interval in seconds (0 to disable)
 */
export function useDashboardMetrics<T extends DashboardMetrics>(
  dashboardType: DashboardType,
  autoRefresh: number = 0
): UseDashboardMetricsReturn<T> {
  const cacheKey = `dashboard-${dashboardType}`;

  const [metrics, setMetrics] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /**
   * Fetch metrics from API or cache
   */
  const fetchMetrics = useCallback(async (skipCache: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first (unless skipCache is true)
      if (!skipCache) {
        const cachedData = getCachedData<T>(cacheKey);
        if (cachedData) {
          setMetrics(cachedData);
          setLoading(false);
          const cached = metricsCache.get(cacheKey);
          if (cached) {
            setLastUpdated(new Date(cached.timestamp));
          }
          return;
        }
      }

      // Fetch from API
      let response;
      if (dashboardType === 'client') {
        response = await dashboardService.getClientMetrics();
      } else if (dashboardType === 'ca') {
        response = await dashboardService.getCAMetrics();
      } else if (dashboardType === 'admin') {
        response = await dashboardService.getAdminMetrics();
      } else {
        throw new Error(`Invalid dashboard type: ${dashboardType}`);
      }

      if (response.success && response.data) {
        const metricsData = response.data as T;
        setMetrics(metricsData);
        setCacheData(cacheKey, metricsData);
        setLastUpdated(new Date());
      } else {
        throw new Error('Failed to fetch dashboard metrics');
      }
    } catch (err: any) {
      console.error('Error fetching dashboard metrics:', err);
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [dashboardType, cacheKey]);

  /**
   * Refresh metrics (bypass cache)
   */
  const refresh = useCallback(async () => {
    await fetchMetrics(true);
  }, [fetchMetrics]);

  // Initial fetch on mount
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh > 0) {
      const intervalId = setInterval(() => {
        fetchMetrics(true); // Bypass cache on auto-refresh
      }, autoRefresh * 1000);

      return () => clearInterval(intervalId);
    }
  }, [autoRefresh, fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refresh,
    lastUpdated,
  };
}

/**
 * Client dashboard metrics hook
 */
export function useClientDashboardMetrics(autoRefresh: number = 0) {
  return useDashboardMetrics<ClientDashboardMetrics>('client', autoRefresh);
}

/**
 * CA dashboard metrics hook
 */
export function useCADashboardMetrics(autoRefresh: number = 0) {
  return useDashboardMetrics<CADashboardMetrics>('ca', autoRefresh);
}

/**
 * Admin dashboard metrics hook
 */
export function useAdminDashboardMetrics(autoRefresh: number = 0) {
  return useDashboardMetrics<AdminDashboardMetrics>('admin', autoRefresh);
}
