import React, { useState, useEffect } from 'react';
import { Card, Button, Loading } from '../../components/common';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

interface FirmHealthMetrics {
  totalFirms: number;
  activeCount: number;
  pendingCount: number;
  suspendedCount: number;
  dissolvedCount: number;
  averageFirmSize: number;
  verificationBacklog: number;
  topPerformers: Array<{
    firmId: string;
    firmName: string;
    rating: number;
    completedProjects: number;
    revenue: number;
  }>;
}

interface ComplianceMetrics {
  gstFilingIssues: number;
  tdsComplianceIssues: number;
  inactiveFirms: number;
  documentExpiryCount: number;
  complianceRate: number;
  firmsWithIssues: Array<{
    firmId: string;
    firmName: string;
    issueType: string;
    severity: string;
  }>;
}

interface RevenueAnalysis {
  totalRevenue: number;
  individualCARevenue: number;
  firmRevenue: number;
  averageTransactionValue: number;
  monthlyGrowth: number;
  revenueByFirmSize: Array<{
    size: string;
    revenue: number;
    count: number;
  }>;
  optimizationSuggestions: string[];
}

interface ConflictMonitoring {
  independentWorkConflicts: number;
  clientPoachingAttempts: number;
  memberPoachingAttempts: number;
  conflicts: Array<{
    type: string;
    firmId: string;
    firmName: string;
    description: string;
    severity: string;
    date: string;
  }>;
}

interface Alert {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  category: string;
  message: string;
  firmId?: string;
  firmName?: string;
  timestamp: Date;
  metadata?: any;
}

interface DashboardData {
  health: FirmHealthMetrics;
  compliance: ComplianceMetrics;
  revenue: RevenueAnalysis;
  conflicts: ConflictMonitoring;
  alerts: {
    items: Alert[];
    total: number;
    critical: number;
    warnings: number;
  };
}

const FirmAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'compliance' | 'revenue' | 'conflicts' | 'alerts'>('overview');
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('JSON');
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/admin/firm-analytics/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response?.data?.success && response?.data?.data) {
        setDashboardData(response.data.data);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view this page.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please login again.');
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/admin/firm-analytics/export?format=${exportFormat}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: exportFormat === 'CSV' ? 'blob' : 'json'
        }
      );

      // Download file
      const blob = new Blob(
        [exportFormat === 'CSV' ? response.data : JSON.stringify(response.data, null, 2)],
        { type: exportFormat === 'CSV' ? 'text/csv' : 'application/json' }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `firm-analytics-${Date.now()}.${exportFormat.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      alert(`Dashboard data exported successfully as ${exportFormat}`);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(err.response?.data?.message || 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleBulkVerify = async () => {
    const firmIds = prompt('Enter firm IDs to verify (comma-separated):');
    if (!firmIds) return;

    const idsArray = firmIds.split(',').map(id => id.trim()).filter(id => id);
    if (idsArray.length === 0) {
      alert('Please enter at least one firm ID');
      return;
    }

    if (idsArray.length > 50) {
      alert('Maximum 50 firms can be verified at once');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please login again.');
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/admin/firm-analytics/bulk-verify`,
        { firmIds: idsArray },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response?.data?.success) {
        alert(response.data.message);
        loadDashboardData(); // Reload data
      }
    } catch (err: any) {
      console.error('Bulk verify failed:', err);
      alert(err.response?.data?.message || 'Failed to verify firms');
    }
  };

  const handleSuspendFirm = async () => {
    const firmId = prompt('Enter firm ID to suspend:');
    if (!firmId) return;

    const reason = prompt('Enter reason for suspension:');
    if (!reason) {
      alert('Reason is required');
      return;
    }

    const notifyMembers = window.confirm('Notify firm members about suspension?');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please login again.');
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/admin/firm-analytics/suspend-firm`,
        { firmId, reason, notifyMembers },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response?.data?.success) {
        alert(response.data.message);
        loadDashboardData(); // Reload data
      }
    } catch (err: any) {
      console.error('Suspend firm failed:', err);
      alert(err.response?.data?.message || 'Failed to suspend firm');
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-500 text-red-800';
      case 'WARNING':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'INFO':
        return 'bg-blue-100 border-blue-500 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return '🚨';
      case 'WARNING':
        return '⚠️';
      case 'INFO':
        return 'ℹ️';
      default:
        return '📌';
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-red-50 border-red-200">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Dashboard</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadDashboardData}>Retry</Button>
        </Card>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <p className="text-gray-500">No dashboard data available</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Firm Analytics Dashboard</h1>
          <p className="text-gray-600">Monitor firm health, compliance, revenue, and conflicts</p>
        </div>
        <div className="flex gap-3">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'CSV' | 'JSON')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="JSON">JSON</option>
            <option value="CSV">CSV</option>
          </select>
          <Button onClick={handleExport} disabled={exportLoading}>
            {exportLoading ? 'Exporting...' : `📥 Export ${exportFormat}`}
          </Button>
          <Button onClick={loadDashboardData} variant="outline">
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="mb-6">
        <h2 className="text-lg font-bold mb-4">Admin Actions</h2>
        <div className="flex gap-3">
          <Button onClick={handleBulkVerify} className="bg-green-600 hover:bg-green-700">
            ✓ Bulk Verify Firms
          </Button>
          <Button onClick={handleSuspendFirm} className="bg-red-600 hover:bg-red-700">
            🚫 Suspend Firm
          </Button>
        </div>
      </Card>

      {/* Alerts Panel */}
      {dashboardData.alerts.items.length > 0 && (
        <Card className="mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">
              Active Alerts ({dashboardData.alerts.total})
            </h2>
            <div className="flex gap-3 text-sm">
              <span className="text-red-600 font-medium">
                🚨 {dashboardData.alerts.critical} Critical
              </span>
              <span className="text-yellow-600 font-medium">
                ⚠️ {dashboardData.alerts.warnings} Warnings
              </span>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {dashboardData.alerts.items.slice(0, 10).map((alert, idx) => (
              <div
                key={idx}
                className={`p-3 rounded border-l-4 ${getAlertColor(alert.type)}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getAlertIcon(alert.type)}</span>
                  <div className="flex-1">
                    <p className="font-medium">{alert.message}</p>
                    {alert.firmName && (
                      <p className="text-sm mt-1">Firm: {alert.firmName}</p>
                    )}
                    <p className="text-xs mt-1 opacity-75">
                      {alert.category} • {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'compliance', label: '✓ Compliance' },
          { key: 'revenue', label: '💰 Revenue' },
          { key: 'conflicts', label: '⚠️ Conflicts' },
          { key: 'alerts', label: '🔔 Alerts' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key as any)}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          {/* Firm Health Metrics */}
          <Card>
            <h2 className="text-xl font-bold mb-4">Firm Health Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{dashboardData.health.totalFirms}</p>
                <p className="text-sm text-gray-600">Total Firms</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{dashboardData.health.activeCount}</p>
                <p className="text-sm text-gray-600">Active</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">{dashboardData.health.pendingCount}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{dashboardData.health.suspendedCount}</p>
                <p className="text-sm text-gray-600">Suspended</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {dashboardData.health.averageFirmSize.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Avg Size</p>
              </div>
            </div>

            {/* Top Performers */}
            {dashboardData.health.topPerformers.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3">Top Performing Firms</h3>
                <div className="space-y-2">
                  {dashboardData.health.topPerformers.map((firm, idx) => (
                    <div key={firm.firmId} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{idx + 1}. {firm.firmName}</span>
                        <span className="ml-3 text-sm text-gray-600">
                          ⭐ {firm.rating.toFixed(1)} • {firm.completedProjects} projects
                        </span>
                      </div>
                      <span className="font-bold text-green-600">₹{firm.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-lg font-bold mb-2">Verification Backlog</h3>
              <p className="text-3xl font-bold text-yellow-600">{dashboardData.health.verificationBacklog}</p>
              <p className="text-sm text-gray-600 mt-2">Firms pending verification</p>
            </Card>

            <Card>
              <h3 className="text-lg font-bold mb-2">Compliance Rate</h3>
              <p className="text-3xl font-bold text-green-600">
                {dashboardData.compliance.complianceRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600 mt-2">Overall compliance score</p>
            </Card>

            <Card>
              <h3 className="text-lg font-bold mb-2">Monthly Growth</h3>
              <p className={`text-3xl font-bold ${dashboardData.revenue.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardData.revenue.monthlyGrowth >= 0 ? '+' : ''}{dashboardData.revenue.monthlyGrowth.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600 mt-2">Revenue growth rate</p>
            </Card>
          </div>
        </div>
      )}

      {/* Compliance Tab */}
      {selectedTab === 'compliance' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-bold mb-4">Compliance Monitoring</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{dashboardData.compliance.gstFilingIssues}</p>
                <p className="text-sm text-gray-600">GST Filing Issues</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">{dashboardData.compliance.tdsComplianceIssues}</p>
                <p className="text-sm text-gray-600">TDS Issues</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">{dashboardData.compliance.inactiveFirms}</p>
                <p className="text-sm text-gray-600">Inactive Firms</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{dashboardData.compliance.documentExpiryCount}</p>
                <p className="text-sm text-gray-600">Documents Expiring</p>
              </div>
            </div>

            {/* Firms with Issues */}
            {dashboardData.compliance.firmsWithIssues.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3">Firms Requiring Attention</h3>
                <div className="space-y-2">
                  {dashboardData.compliance.firmsWithIssues.map((firm, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border-l-4 ${
                        firm.severity === 'HIGH'
                          ? 'bg-red-50 border-red-500'
                          : firm.severity === 'MEDIUM'
                          ? 'bg-yellow-50 border-yellow-500'
                          : 'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{firm.firmName}</p>
                          <p className="text-sm text-gray-600 mt-1">{firm.issueType}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          firm.severity === 'HIGH'
                            ? 'bg-red-100 text-red-800'
                            : firm.severity === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {firm.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Revenue Tab */}
      {selectedTab === 'revenue' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-bold mb-4">Revenue Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">₹{dashboardData.revenue.totalRevenue.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Revenue</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">₹{dashboardData.revenue.individualCARevenue.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Individual CAs</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">₹{dashboardData.revenue.firmRevenue.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Firms</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">₹{dashboardData.revenue.averageTransactionValue.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Avg Transaction</p>
              </div>
            </div>

            {/* Revenue by Firm Size */}
            {dashboardData.revenue.revenueByFirmSize.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3">Revenue by Firm Size</h3>
                <div className="space-y-2">
                  {dashboardData.revenue.revenueByFirmSize.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{item.size}</span>
                        <span className="ml-3 text-sm text-gray-600">{item.count} firms</span>
                      </div>
                      <span className="font-bold text-green-600">₹{item.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optimization Suggestions */}
            {dashboardData.revenue.optimizationSuggestions.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3">Optimization Suggestions</h3>
                <div className="space-y-2">
                  {dashboardData.revenue.optimizationSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                      <p className="text-sm">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Conflicts Tab */}
      {selectedTab === 'conflicts' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-bold mb-4">Conflict Monitoring</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{dashboardData.conflicts.independentWorkConflicts}</p>
                <p className="text-sm text-gray-600">Independent Work Conflicts</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">{dashboardData.conflicts.clientPoachingAttempts}</p>
                <p className="text-sm text-gray-600">Client Poaching Attempts</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">{dashboardData.conflicts.memberPoachingAttempts}</p>
                <p className="text-sm text-gray-600">Member Poaching Attempts</p>
              </div>
            </div>

            {/* Conflict Details */}
            {dashboardData.conflicts.conflicts.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3">Recent Conflicts</h3>
                <div className="space-y-3">
                  {dashboardData.conflicts.conflicts.map((conflict, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded border-l-4 ${
                        conflict.severity === 'HIGH'
                          ? 'bg-red-50 border-red-500'
                          : conflict.severity === 'MEDIUM'
                          ? 'bg-yellow-50 border-yellow-500'
                          : 'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-lg">{conflict.firmName}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          conflict.severity === 'HIGH'
                            ? 'bg-red-100 text-red-800'
                            : conflict.severity === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {conflict.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>{conflict.type}:</strong> {conflict.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(conflict.date).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Alerts Tab */}
      {selectedTab === 'alerts' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-bold mb-4">All Alerts ({dashboardData.alerts.total})</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{dashboardData.alerts.critical}</p>
                <p className="text-sm text-gray-600">Critical</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">{dashboardData.alerts.warnings}</p>
                <p className="text-sm text-gray-600">Warnings</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {dashboardData.alerts.total - dashboardData.alerts.critical - dashboardData.alerts.warnings}
                </p>
                <p className="text-sm text-gray-600">Info</p>
              </div>
            </div>

            <div className="space-y-2">
              {dashboardData.alerts.items.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded border-l-4 ${getAlertColor(alert.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getAlertIcon(alert.type)}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-lg">{alert.message}</p>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          alert.type === 'CRITICAL'
                            ? 'bg-red-100 text-red-800'
                            : alert.type === 'WARNING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.type}
                        </span>
                      </div>
                      {alert.firmName && (
                        <p className="text-sm text-gray-600 mb-1">Firm: {alert.firmName}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {alert.category} • {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FirmAnalyticsDashboard;
