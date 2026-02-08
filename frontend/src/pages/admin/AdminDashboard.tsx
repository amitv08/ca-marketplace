import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/common';
import { useAdminDashboardMetrics } from '../../hooks/useDashboardMetrics';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Use dashboard metrics hook with 5-minute cache
  const { metrics: dashboardMetrics, loading: metricsLoading } = useAdminDashboardMetrics();

  const adminSections = [
    {
      title: 'Security Management',
      description: 'Monitor security scans, vulnerabilities, and audit logs',
      icon: '🛡️',
      path: '/admin/security',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      title: 'User Management',
      description: 'View and manage user accounts',
      icon: '👥',
      path: '/admin/users',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      title: 'CA Verification',
      description: 'Review and verify chartered accountant applications',
      icon: '✓',
      path: '/admin/ca-verification',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      title: 'Payment Management',
      description: 'Review and release payments to CAs',
      icon: '💰',
      path: '/admin/payments',
      color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    },
    {
      title: 'Analytics Dashboard',
      description: 'View analytics, metrics, and business insights',
      icon: '📊',
      path: '/admin/analytics',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      title: 'Service Requests',
      description: 'Monitor all service requests and their status',
      icon: '📝',
      path: '/admin/requests',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
    {
      title: 'CA Firms Management',
      description: 'Manage CA firms, memberships, and verification',
      icon: '🏢',
      path: '/admin/firms',
      color: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
    },
    {
      title: 'Firm Analytics Dashboard',
      description: 'Monitor firm health, compliance, revenue, and conflicts',
      icon: '📈',
      path: '/admin/firm-analytics',
      color: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
    },
    {
      title: 'Platform Settings',
      description: 'Configure platform fees, service types, and business rules',
      icon: '⚙️',
      path: '/admin/platform-settings',
      color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
    },
    {
      title: 'Dispute Management',
      description: 'Review and resolve client-CA disputes',
      icon: '⚖️',
      path: '/admin/disputes',
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage and monitor the CA Marketplace platform</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">{metricsLoading ? '...' : dashboardMetrics?.totalUsers || 0}</p>
          <p className="text-sm text-gray-600">Total Users</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">{metricsLoading ? '...' : dashboardMetrics?.usersByRole.cas || 0}</p>
          <p className="text-sm text-gray-600">Active CAs</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-600">{metricsLoading ? '...' : dashboardMetrics?.totalRequests || 0}</p>
          <p className="text-sm text-gray-600">Service Requests</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">₹{metricsLoading ? '...' : (dashboardMetrics?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Pending Verification</h3>
          <p className="text-3xl font-bold text-orange-600">{metricsLoading ? '...' : dashboardMetrics?.pendingVerification || 0}</p>
          <p className="text-xs text-gray-500 mt-1">CAs awaiting approval</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Revenue This Month</h3>
          <p className="text-3xl font-bold text-green-600">₹{metricsLoading ? '...' : (dashboardMetrics?.revenueThisMonth || 0).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-1">Platform earnings</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Avg Completion Time</h3>
          <p className="text-3xl font-bold text-blue-600">{metricsLoading ? '...' : dashboardMetrics?.avgCompletionTime || 0} days</p>
          <p className="text-xs text-gray-500 mt-1">Request turnaround</p>
        </Card>
      </div>

      {/* System Health */}
      {dashboardMetrics?.systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-blue-50">
            <p className="text-sm text-gray-600">Active Users (24h)</p>
            <p className="text-2xl font-bold text-blue-600">{dashboardMetrics.systemHealth.activeUsers24h}</p>
          </Card>
          <Card className="bg-green-50">
            <p className="text-sm text-gray-600">Requests Today</p>
            <p className="text-2xl font-bold text-green-600">{dashboardMetrics.systemHealth.requestsToday}</p>
          </Card>
          <Card className="bg-purple-50">
            <p className="text-sm text-gray-600">Payments Today</p>
            <p className="text-2xl font-bold text-purple-600">{dashboardMetrics.systemHealth.paymentsToday}</p>
          </Card>
          <Card className="bg-gray-50">
            <p className="text-sm text-gray-600">Platform Fees</p>
            <p className="text-2xl font-bold text-gray-700">₹{(dashboardMetrics.platformFees || 0).toLocaleString('en-IN')}</p>
          </Card>
        </div>
      )}

      {/* Admin Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section) => (
          <div
            key={section.path}
            onClick={() => navigate(section.path)}
            className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${section.color}`}
          >
            <div className="text-4xl mb-3">{section.icon}</div>
            <h3 className="text-lg font-bold mb-2">{section.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{section.description}</p>
            <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
              View →
            </button>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="mt-8">
        <h2 className="text-xl font-bold mb-4">Recent Admin Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <div>
              <p className="text-sm font-medium">No recent activity</p>
              <p className="text-xs text-gray-500">Check back later for updates</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="mt-8 flex gap-4">
        <Button onClick={() => navigate('/admin/security')} className="bg-red-600 hover:bg-red-700">
          🛡️ View Security Dashboard
        </Button>
        <Button onClick={() => navigate('/admin/ca-verification')} variant="outline">
          Review Pending CAs
        </Button>
        <Button onClick={() => navigate('/admin/payments')} variant="outline">
          Process Payments
        </Button>
      </div>
    </div>
  );
};

export default AdminDashboard;
