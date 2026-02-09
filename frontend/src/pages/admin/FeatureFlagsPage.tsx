/**
 * Feature Flags Page
 * Admin interface for managing feature flags with gradual rollouts and targeting
 */

import React, { useState } from 'react';
import { useFeatureFlags, useFeatureFlagActions } from '../../hooks/useFeatureFlag';

export const FeatureFlagsPage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { flags, loading, error, refetch } = useFeatureFlags();
  const { createFlag, updateFlag, enableFlag, disableFlag, setRollout, deleteFlag } = useFeatureFlagActions();

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    enabled: false,
    rolloutPercent: 0,
    targetRoles: [] as string[],
    targetUserIds: '',
  });

  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createFlag({
        ...formData,
        targetUserIds: formData.targetUserIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      });
      setShowCreateModal(false);
      refetch();
      // Reset form
      setFormData({
        key: '',
        name: '',
        description: '',
        enabled: false,
        rolloutPercent: 0,
        targetRoles: [],
        targetUserIds: '',
      });
    } catch (error) {
      console.error('Failed to create flag:', error);
      alert('Failed to create flag');
    }
  };

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    try {
      if (currentEnabled) {
        await disableFlag(key);
      } else {
        await enableFlag(key);
      }
      refetch();
    } catch (error) {
      console.error('Failed to toggle flag:', error);
      alert('Failed to toggle flag');
    }
  };

  const handleRolloutChange = async (key: string, percent: number) => {
    try {
      await setRollout(key, percent);
      refetch();
    } catch (error) {
      console.error('Failed to update rollout:', error);
      alert('Failed to update rollout');
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Are you sure you want to delete flag "${key}"?`)) return;

    try {
      await deleteFlag(key);
      refetch();
    } catch (error) {
      console.error('Failed to delete flag:', error);
      alert('Failed to delete flag');
    }
  };

  const handleEditFlag = (flag: any) => {
    setEditingFlag(flag.key);
    setFormData({
      key: flag.key,
      name: flag.name,
      description: flag.description || '',
      enabled: flag.enabled,
      rolloutPercent: flag.rolloutPercent,
      targetRoles: flag.targetRoles,
      targetUserIds: flag.targetUserIds.join(', '),
    });
    setShowCreateModal(true);
  };

  const handleUpdateFlag = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateFlag(formData.key, {
        name: formData.name,
        description: formData.description,
        targetRoles: formData.targetRoles,
        targetUserIds: formData.targetUserIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      });
      setShowCreateModal(false);
      setEditingFlag(null);
      refetch();
    } catch (error) {
      console.error('Failed to update flag:', error);
      alert('Failed to update flag');
    }
  };

  const toggleRole = (role: string) => {
    setFormData({
      ...formData,
      targetRoles: formData.targetRoles.includes(role)
        ? formData.targetRoles.filter((r) => r !== role)
        : [...formData.targetRoles, role],
    });
  };

  const filteredFlags = flags.filter(
    (flag) =>
      flag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-gray-600 mt-1">Manage feature flags with gradual rollouts and targeting</p>
        </div>
        <button
          onClick={() => {
            setEditingFlag(null);
            setFormData({
              key: '',
              name: '',
              description: '',
              enabled: false,
              rolloutPercent: 0,
              targetRoles: [],
              targetUserIds: '',
            });
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Flag
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search flags by key or name..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Flags List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading feature flags...</p>
        </div>
      ) : filteredFlags.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-400">
            {searchTerm ? 'No flags match your search' : 'No feature flags yet'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create First Flag
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFlags.map((flag) => (
            <div key={flag.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{flag.name}</h3>
                    <code className="px-2 py-1 text-xs bg-gray-100 rounded">{flag.key}</code>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flag.enabled}
                        onChange={() => handleToggle(flag.key, flag.enabled)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  {flag.description && (
                    <p className="mt-2 text-sm text-gray-600">{flag.description}</p>
                  )}

                  {/* Rollout Percentage */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Rollout: {flag.rolloutPercent}%
                      </span>
                      {flag.enabled && (
                        <div className="flex gap-2">
                          {[0, 25, 50, 75, 100].map((percent) => (
                            <button
                              key={percent}
                              onClick={() => handleRolloutChange(flag.key, percent)}
                              className={`px-2 py-1 text-xs rounded ${
                                flag.rolloutPercent === percent
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {percent}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${flag.rolloutPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Targeting Info */}
                  {(flag.targetRoles.length > 0 || flag.targetUserIds.length > 0) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {flag.targetRoles.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Roles:</span>
                          {flag.targetRoles.map((role: string) => (
                            <span
                              key={role}
                              className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                      {flag.targetUserIds.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            Targeted Users: {flag.targetUserIds.length}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="mt-3 text-xs text-gray-500">
                    Created: {new Date(flag.createdAt).toLocaleString()} | Updated:{' '}
                    {new Date(flag.updatedAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEditFlag(flag)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(flag.key)}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {!loading && flags.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-600">Total Flags</p>
            <p className="text-2xl font-bold text-gray-900">{flags.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-600">Enabled</p>
            <p className="text-2xl font-bold text-green-600">
              {flags.filter((f) => f.enabled).length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-600">Disabled</p>
            <p className="text-2xl font-bold text-gray-600">
              {flags.filter((f) => !f.enabled).length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-600">Full Rollout</p>
            <p className="text-2xl font-bold text-blue-600">
              {flags.filter((f) => f.enabled && f.rolloutPercent === 100).length}
            </p>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingFlag ? 'Edit Feature Flag' : 'Create Feature Flag'}
            </h2>
            <form onSubmit={editingFlag ? handleUpdateFlag : handleCreateFlag}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flag Key {editingFlag && '(cannot be changed)'}
                  </label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="new_payment_flow"
                    required
                    disabled={!!editingFlag}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="New Payment Flow"
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
                    placeholder="Enable new streamlined payment flow"
                  />
                </div>

                {!editingFlag && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.enabled}
                        onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label className="text-sm text-gray-700">Enable flag immediately</label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rollout Percentage ({formData.rolloutPercent}%)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.rolloutPercent}
                        onChange={(e) =>
                          setFormData({ ...formData, rolloutPercent: parseInt(e.target.value) })
                        }
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Roles</label>
                  <div className="flex flex-wrap gap-2">
                    {['CLIENT', 'CA', 'ADMIN'].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          formData.targetRoles.includes(role)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to target all roles. Select specific roles to restrict the flag.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target User IDs (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.targetUserIds}
                    onChange={(e) => setFormData({ ...formData, targetUserIds: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="user-123, user-456"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to use percentage rollout. Specific user IDs always get the flag.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingFlag(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingFlag ? 'Update Flag' : 'Create Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagsPage;
