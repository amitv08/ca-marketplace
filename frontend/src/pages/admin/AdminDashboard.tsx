import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/common';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

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
      title: 'Platform Statistics',
      description: 'View analytics and platform metrics',
      icon: '📊',
      path: '/admin/stats',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      title: 'Service Requests',
      description: 'Monitor all service requests and their status',
      icon: '📝',
      path: '/admin/requests',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
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
          <p className="text-2xl font-bold text-blue-600">0</p>
          <p className="text-sm text-gray-600">Total Users</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">0</p>
          <p className="text-sm text-gray-600">Active CAs</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-600">0</p>
          <p className="text-sm text-gray-600">Service Requests</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">₹0</p>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </Card>
      </div>

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
