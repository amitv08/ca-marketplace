/**
 * Experiments Page
 * Admin interface for A/B testing and experiment management
 */

import React, { useState } from 'react';
import { useExperiments, useExperimentMetrics, useExperimentActions } from '../../hooks/useExperiments';

type ExperimentVariant = {
  id: string;
  name: string;
  weight: number;
};

export const ExperimentsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { experiments, loading, error, refetch } = useExperiments(statusFilter);
  const { metrics, loading: metricsLoading } = useExperimentMetrics(selectedExperiment || '');
  const { createExperiment, startExperiment, pauseExperiment, completeExperiment } = useExperimentActions();

  // Form state for creating experiments
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    variants: [
      { id: 'control', name: 'Control', weight: 50 },
      { id: 'variant_a', name: 'Variant A', weight: 50 },
    ] as ExperimentVariant[],
  });

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate weights sum to 100
    const totalWeight = formData.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      alert('Variant weights must sum to 100%');
      return;
    }

    try {
      await createExperiment(formData);
      setShowCreateModal(false);
      refetch();
      // Reset form
      setFormData({
        key: '',
        name: '',
        description: '',
        variants: [
          { id: 'control', name: 'Control', weight: 50 },
          { id: 'variant_a', name: 'Variant A', weight: 50 },
        ],
      });
    } catch (error) {
      console.error('Failed to create experiment:', error);
      alert('Failed to create experiment');
    }
  };

  const handleStartExperiment = async (key: string) => {
    if (!window.confirm('Start this experiment? Users will begin being assigned to variants.')) return;

    try {
      await startExperiment(key);
      refetch();
    } catch (error) {
      console.error('Failed to start experiment:', error);
      alert('Failed to start experiment');
    }
  };

  const handlePauseExperiment = async (key: string) => {
    if (!window.confirm('Pause this experiment?')) return;

    try {
      await pauseExperiment(key);
      refetch();
    } catch (error) {
      console.error('Failed to pause experiment:', error);
      alert('Failed to pause experiment');
    }
  };

  const handleCompleteExperiment = async (key: string) => {
    const winningVariantId = prompt('Enter winning variant ID (or leave empty for no winner):');

    try {
      await completeExperiment(key, winningVariantId || undefined);
      refetch();
    } catch (error) {
      console.error('Failed to complete experiment:', error);
      alert('Failed to complete experiment');
    }
  };

  const addVariant = () => {
    const newId = `variant_${String.fromCharCode(97 + formData.variants.length - 1)}`;
    setFormData({
      ...formData,
      variants: [
        ...formData.variants,
        { id: newId, name: `Variant ${String.fromCharCode(65 + formData.variants.length - 1)}`, weight: 0 },
      ],
    });
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length <= 2) {
      alert('Must have at least 2 variants');
      return;
    }
    const newVariants = formData.variants.filter((_, i) => i !== index);
    setFormData({ ...formData, variants: newVariants });
  };

  const updateVariant = (index: number, field: keyof ExperimentVariant, value: string | number) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormData({ ...formData, variants: newVariants });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      RUNNING: 'bg-blue-100 text-blue-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">A/B Testing Experiments</h1>
          <p className="text-gray-600 mt-1">Create and manage experiments with statistical significance tracking</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Experiment
        </button>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex gap-2">
        {['All', 'DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status === 'All' ? undefined : status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              (status === 'All' && !statusFilter) || statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Experiments List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading experiments...</p>
        </div>
      ) : experiments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-400">No experiments yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Experiment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {experiments.map((experiment) => (
            <div key={experiment.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{experiment.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(experiment.status)}`}>
                        {experiment.status}
                      </span>
                      <code className="px-2 py-1 text-xs bg-gray-100 rounded">{experiment.key}</code>
                    </div>
                    {experiment.description && (
                      <p className="mt-2 text-sm text-gray-600">{experiment.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {experiment.variants && JSON.parse(experiment.variants as any).map((variant: ExperimentVariant) => (
                        <span key={variant.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm">
                          {variant.name} ({variant.weight}%)
                        </span>
                      ))}
                    </div>
                    {experiment.winningVariant && (
                      <div className="mt-2">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          Winner: {experiment.winningVariant}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {experiment.status === 'DRAFT' && (
                      <button
                        onClick={() => handleStartExperiment(experiment.key)}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 text-sm font-medium"
                      >
                        Start
                      </button>
                    )}
                    {experiment.status === 'RUNNING' && (
                      <>
                        <button
                          onClick={() => handlePauseExperiment(experiment.key)}
                          className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 text-sm font-medium"
                        >
                          Pause
                        </button>
                        <button
                          onClick={() => handleCompleteExperiment(experiment.key)}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm font-medium"
                        >
                          Complete
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedExperiment(selectedExperiment === experiment.key ? null : experiment.key)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                    >
                      {selectedExperiment === experiment.key ? 'Hide' : 'View'} Metrics
                    </button>
                  </div>
                </div>
              </div>

              {/* Metrics Panel */}
              {selectedExperiment === experiment.key && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  <h4 className="font-medium text-gray-900 mb-4">Experiment Metrics</h4>
                  {metricsLoading ? (
                    <p className="text-gray-400">Loading metrics...</p>
                  ) : metrics ? (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {metrics.variants.map((variant) => (
                          <div key={variant.variantId} className="bg-white rounded-lg border border-gray-200 p-4">
                            <h5 className="font-medium text-gray-900 mb-2">{variant.variantName}</h5>
                            <div className="space-y-1 text-sm">
                              <p className="text-gray-600">
                                Users: <span className="font-medium text-gray-900">{variant.users}</span>
                              </p>
                              <p className="text-gray-600">
                                Conversions: <span className="font-medium text-gray-900">{variant.conversions}</span>
                              </p>
                              <p className="text-gray-600">
                                Conversion Rate:{' '}
                                <span className="font-medium text-gray-900">{variant.conversionRate.toFixed(2)}%</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Statistical Significance */}
                      {metrics.significance && (
                        <div className={`rounded-lg p-4 ${metrics.significance.isSignificant ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                          <h5 className="font-medium text-gray-900 mb-2">Statistical Significance</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Z-Score</p>
                              <p className="font-medium text-gray-900">{metrics.significance.zScore.toFixed(3)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">P-Value</p>
                              <p className="font-medium text-gray-900">{metrics.significance.pValue.toFixed(4)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Lift</p>
                              <p className="font-medium text-gray-900">{metrics.significance.liftPercentage}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Significant?</p>
                              <p className={`font-medium ${metrics.significance.isSignificant ? 'text-green-700' : 'text-yellow-700'}`}>
                                {metrics.significance.isSignificant ? 'Yes (95% confidence)' : 'No'}
                              </p>
                            </div>
                          </div>
                          {!metrics.significance.isSignificant && (
                            <p className="mt-3 text-sm text-yellow-700">
                              Not enough data for statistical significance. Continue running the experiment.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">No metrics data available</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Experiment</h2>
            <form onSubmit={handleCreateExperiment}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experiment Key (unique)</label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="checkout_flow_v2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Checkout Flow V2 Test"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Testing new streamlined checkout flow against existing flow"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Variants</label>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add Variant
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.variants.map((variant, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={variant.id}
                          onChange={(e) => updateVariant(index, 'id', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="variant_id"
                          required
                        />
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => updateVariant(index, 'name', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Variant Name"
                          required
                        />
                        <input
                          type="number"
                          value={variant.weight}
                          onChange={(e) => updateVariant(index, 'weight', parseInt(e.target.value))}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="50"
                          min="0"
                          max="100"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => removeVariant(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Total weight: {formData.variants.reduce((sum, v) => sum + v.weight, 0)}% (must equal 100%)
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Experiment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExperimentsPage;
