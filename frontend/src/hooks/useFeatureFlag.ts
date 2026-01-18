/**
 * useFeatureFlag Hook
 * Custom hook for feature flag evaluation and management
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercent: number;
  targetRoles: string[];
  targetUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Check if a specific feature flag is enabled for the current user
 */
export function useFeatureFlag(flagKey: string): boolean {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!flagKey) return;

    const checkFlag = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/feature-flags/${flagKey}/check`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setEnabled(response.data.data.enabled);
      } catch (err) {
        console.error('Failed to check feature flag:', err);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    checkFlag();
  }, [flagKey]);

  return enabled;
}

/**
 * Get all enabled flags for the current user
 */
export function useEnabledFlags() {
  const [flags, setFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/feature-flags`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setFlags(response.data.data);
      } catch (err) {
        console.error('Failed to fetch enabled flags:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFlags();
  }, []);

  return { flags, loading };
}

/**
 * Fetch all feature flags (admin)
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/admin/feature-flags`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setFlags(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return { flags, loading, error, refetch: fetchFlags };
}

/**
 * Feature flag actions (admin)
 */
export function useFeatureFlagActions() {
  const createFlag = async (data: Partial<FeatureFlag>) => {
    const response = await axios.post(`${API_BASE_URL}/admin/feature-flags`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    return response.data.data;
  };

  const updateFlag = async (key: string, data: Partial<FeatureFlag>) => {
    const response = await axios.put(`${API_BASE_URL}/admin/feature-flags/${key}`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    return response.data.data;
  };

  const enableFlag = async (key: string) => {
    await axios.put(`${API_BASE_URL}/admin/feature-flags/${key}/enable`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
  };

  const disableFlag = async (key: string) => {
    await axios.put(`${API_BASE_URL}/admin/feature-flags/${key}/disable`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
  };

  const setRollout = async (key: string, percent: number) => {
    await axios.put(
      `${API_BASE_URL}/admin/feature-flags/${key}/rollout`,
      { percent },
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
  };

  const deleteFlag = async (key: string) => {
    await axios.delete(`${API_BASE_URL}/admin/feature-flags/${key}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
  };

  return { createFlag, updateFlag, enableFlag, disableFlag, setRollout, deleteFlag };
}
