/**
 * Reports Page
 * Admin interface for managing scheduled reports and generating on-demand reports
 */

import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface ScheduledReport {
  id: string;
  name: string;
  reportType: 'MONTHLY_REVENUE' | 'CA_PERFORMANCE' | 'PLATFORM_STATS' | 'FINANCIAL_RECONCILIATION' | 'USER_ACQUISITION';
  schedule: string;
  format: 'PDF' | 'CSV' | 'BOTH';
  recipients: string[];
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

interface ReportExecution {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  fileUrl?: string;
  errorMessage?: string;
}

export const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [executions, setExecutions] = useState<Record<string, ReportExecution[]>>({});
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    reportType: 'MONTHLY_REVENUE' as const,
    schedule: '0 0 1 * *', // First day of month at midnight
    format: 'PDF' as const,
    recipients: '',
    enabled: true,
  });

  React.useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/admin/reports`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setReports(response.data.data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async (reportId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/reports/${reportId}/executions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setExecutions((prev) => ({ ...prev, [reportId]: response.data.data }));
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    }
  };

  const createReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_BASE_URL}/admin/reports`,
        {
          ...formData,
          recipients: formData.recipients.split(',').map((r) => r.trim()),
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      setShowCreateModal(false);
      fetchReports();
      // Reset form
      setFormData({
        name: '',
        reportType: 'MONTHLY_REVENUE',
        schedule: '0 0 1 * *',
        format: 'PDF',
        recipients: '',
        enabled: true,
      });
    } catch (error) {
      console.error('Failed to create report:', error);
      alert('Failed to create report');
    }
  };

  const toggleReportEnabled = async (reportId: string, currentEnabled: boolean) => {
    try {
      await axios.put(
        `${API_BASE_URL}/admin/reports/${reportId}`,
        { enabled: !currentEnabled },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      fetchReports();
    } catch (error) {
      console.error('Failed to toggle report:', error);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/admin/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      fetchReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
      alert('Failed to delete report');
    }
  };

  const generateOnDemand = async () => {
    try {
      const startDate = prompt('Start date (YYYY-MM-DD):');
      const endDate = prompt('End date (YYYY-MM-DD):');

      if (!startDate || !endDate) return;

      await axios.post(
        `${API_BASE_URL}/admin/reports/generate`,
        {
          reportType: 'MONTHLY_REVENUE',
          format: 'PDF',
          dateRange: {
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
          },
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      alert('Report generation started. Check execution history for download link.');
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report');
    }
  };

  const downloadReport = async (executionId: string) => {
    try {
      window.open(`${API_BASE_URL}/admin/reports/download/${executionId}`, '_blank');
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const toggleExecutions = (reportId: string) => {
    if (selectedReport === reportId) {
      setSelectedReport(null);
    } else {
      setSelectedReport(reportId);
      if (!executions[reportId]) {
        fetchExecutions(reportId);
      }
    }
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      MONTHLY_REVENUE: 'Monthly Revenue',
      CA_PERFORMANCE: 'CA Performance',
      PLATFORM_STATS: 'Platform Stats',
      FINANCIAL_RECONCILIATION: 'Financial Reconciliation',
      USER_ACQUISITION: 'User Acquisition',
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      RUNNING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports Management</h1>
          <p className="text-gray-600 mt-1">Schedule and manage automated reports</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generateOnDemand}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Generate On-Demand
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Schedule New Report
          </button>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-400">No scheduled reports yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Report
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {getReportTypeLabel(report.reportType)}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        {report.format}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Schedule: <code className="px-2 py-1 bg-gray-100 rounded text-xs">{report.schedule}</code></p>
                      <p className="mt-1">Recipients: {report.recipients.join(', ')}</p>
                      {report.lastRunAt && (
                        <p className="mt-1">Last run: {new Date(report.lastRunAt).toLocaleString()}</p>
                      )}
                      {report.nextRunAt && (
                        <p className="mt-1">Next run: {new Date(report.nextRunAt).toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleReportEnabled(report.id, report.enabled)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        report.enabled
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {report.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => toggleExecutions(report.id)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                    >
                      History
                    </button>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="px-3 py-1 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Execution History */}
              {selectedReport === report.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  <h4 className="font-medium text-gray-900 mb-3">Execution History</h4>
                  {executions[report.id] && executions[report.id].length > 0 ? (
                    <div className="space-y-2">
                      {executions[report.id].map((execution) => (
                        <div key={execution.id} className="bg-white rounded border border-gray-200 p-3 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(execution.status)}`}>
                                {execution.status}
                              </span>
                              <span className="text-sm text-gray-600">
                                Started: {new Date(execution.startedAt).toLocaleString()}
                              </span>
                              {execution.completedAt && (
                                <span className="text-sm text-gray-600">
                                  | Completed: {new Date(execution.completedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                            {execution.errorMessage && (
                              <p className="text-sm text-red-600 mt-1">{execution.errorMessage}</p>
                            )}
                          </div>
                          {execution.status === 'COMPLETED' && execution.fileUrl && (
                            <button
                              onClick={() => downloadReport(execution.id)}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No execution history yet</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Schedule New Report</h2>
            <form onSubmit={createReport}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <select
                    value={formData.reportType}
                    onChange={(e) => setFormData({ ...formData, reportType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MONTHLY_REVENUE">Monthly Revenue</option>
                    <option value="CA_PERFORMANCE">CA Performance</option>
                    <option value="PLATFORM_STATS">Platform Stats</option>
                    <option value="FINANCIAL_RECONCILIATION">Financial Reconciliation</option>
                    <option value="USER_ACQUISITION">User Acquisition</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (Cron)</label>
                  <input
                    type="text"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0 0 1 * * (1st of month at midnight)"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Examples: "0 0 1 * *" (monthly), "0 0 * * 0" (weekly), "0 9 * * 1-5" (weekdays 9am)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PDF">PDF</option>
                    <option value="CSV">CSV</option>
                    <option value="BOTH">Both PDF and CSV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipients (comma-separated emails)</label>
                  <input
                    type="text"
                    value={formData.recipients}
                    onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="admin@example.com, finance@example.com"
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label className="text-sm text-gray-700">Enable report immediately</label>
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
                  Schedule Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
