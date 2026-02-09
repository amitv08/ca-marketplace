/**
 * useExperiments Hook
 * Custom hook for A/B testing experiment management
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  variants: ExperimentVariant[];
  startDate?: string;
  endDate?: string;
  winningVariant?: string;
}

export interface ExperimentMetrics {
  experimentKey: string;
  experimentName: string;
  status: string;
  variants: Array<{
    variantId: string;
    variantName: string;
    users: number;
    conversions: number;
    conversionRate: number;
  }>;
  significance?: {
    zScore: number;
    pValue: number;
    isSignificant: boolean;
    lift: number;
    liftPercentage: string;
  };
}

/**
 * Fetch all experiments
 */
export function useExperiments(status?: string) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiments = useCallback(async () => {
    try {
      setLoading(true);
      const params = status ? `?status=${status}` : '';
      const response = await axios.get(`${API_BASE_URL}/admin/experiments${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExperiments(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch experiments');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  return { experiments, loading, error, refetch: fetchExperiments };
}

/**
 * Get experiment metrics
 */
export function useExperimentMetrics(experimentKey: string) {
  const [metrics, setMetrics] = useState<ExperimentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!experimentKey) return;
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/admin/experiments/${experimentKey}/metrics`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setMetrics(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [experimentKey]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
}

/**
 * Get user's variant for an experiment
 */
export function useVariant(experimentKey: string) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!experimentKey) return;

    const fetchVariant = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/experiments/${experimentKey}/variant`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setVariantId(response.data.data.variantId);
      } catch (err) {
        console.error('Failed to get variant:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVariant();
  }, [experimentKey]);

  return { variantId, loading };
}

/**
 * Experiment actions
 */
export function useExperimentActions() {
  const createExperiment = async (data: Partial<Experiment>) => {
    const response = await axios.post(`${API_BASE_URL}/admin/experiments`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    return response.data.data;
  };

  const startExperiment = async (key: string) => {
    await axios.put(`${API_BASE_URL}/admin/experiments/${key}/start`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
  };

  const pauseExperiment = async (key: string) => {
    await axios.put(`${API_BASE_URL}/admin/experiments/${key}/pause`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
  };

  const completeExperiment = async (key: string, winningVariantId?: string) => {
    await axios.put(`${API_BASE_URL}/admin/experiments/${key}/complete`,
      { winningVariantId },
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
  };

  return { createExperiment, startExperiment, pauseExperiment, completeExperiment };
}
