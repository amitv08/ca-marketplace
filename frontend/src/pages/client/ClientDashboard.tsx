import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { serviceRequestService, paymentService, notificationService } from '../../services';
import { Card, Button, Loading } from '../../components/common';
import { useClientDashboardMetrics } from '../../hooks/useDashboardMetrics';

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  payment?: any;
  ca?: {
    user: {
      name: string;
    };
  };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning';
  message: string;
  time: string;
  link?: string;
}

// Helper function to convert date to relative time
const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  // Replace with real notifications from backend in the future
  // For now, show notifications based on actual service requests
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null); // Filter state

  // Use dashboard metrics hook with 5-minute cache
  const { metrics: dashboardMetrics, loading: metricsLoading, error: metricsError } = useClientDashboardMetrics();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch recent requests for display AND pending requests for accurate count
      const [recentResponse, pendingResponse, paymentsResponse] = await Promise.all([
        serviceRequestService.getRequests({ limit: 10 }),
        serviceRequestService.getRequests({ status: 'PENDING', limit: 100 }), // Get all pending requests
        paymentService.getPaymentHistory(),
      ]);

      let allRequests: ServiceRequest[] = [];
      let actualPendingCount = 0;
      let pendingRequests: ServiceRequest[] = [];

      if (recentResponse.success) {
        const recentRequests = recentResponse.data.data || recentResponse.data;
        allRequests = Array.isArray(recentRequests) ? recentRequests : [];
      }

      if (pendingResponse.success) {
        pendingRequests = Array.isArray(pendingResponse.data.data || pendingResponse.data)
          ? pendingResponse.data.data || pendingResponse.data
          : [];
        actualPendingCount = pendingRequests.length;

        // Merge pending requests with recent requests (avoid duplicates)
        // Combine: pending requests first, then non-pending recent requests
        allRequests = [
          ...pendingRequests,
          ...allRequests.filter((r: ServiceRequest) => r.status !== 'PENDING')
        ];
      }

      // Update the displayed service requests with merged data
      setServiceRequests(allRequests);

      // Generate notifications from recent activity
      const generatedNotifications: Notification[] = [];

      // Check for recently accepted requests
      const recentlyAccepted = allRequests.filter(r =>
        r.status === 'ACCEPTED' &&
        new Date(r.updatedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
      );
      recentlyAccepted.forEach(req => {
        generatedNotifications.push({
          id: `accepted-${req.id}`,
          type: 'success',
          message: `Your ${req.serviceType} request has been accepted`,
          time: getRelativeTime(req.updatedAt),
          link: `/requests/${req.id}`,
        });
      });

      // Check for requests with recent messages (mock for now, would need message count from backend)
      const inProgressRequests = allRequests.filter(r => r.status === 'IN_PROGRESS').slice(0, 1);
      inProgressRequests.forEach(req => {
        generatedNotifications.push({
          id: `message-${req.id}`,
          type: 'info',
          message: `Check messages for your ${req.serviceType} request`,
          time: getRelativeTime(req.updatedAt),
          link: `/requests/${req.id}`,
        });
      });

      // Check for pending payments
      const completedNoPay = allRequests.filter(r =>
        r.status === 'COMPLETED' &&
        !r.payment
      ).slice(0, 1);
      completedNoPay.forEach(req => {
        generatedNotifications.push({
          id: `payment-${req.id}`,
          type: 'warning',
          message: `Payment required for completed ${req.serviceType.replace(/_/g, ' ').toLowerCase()} service`,
          time: getRelativeTime(req.completedAt || req.updatedAt),
          link: `/requests/${req.id}`,
        });
      });

      setNotifications(generatedNotifications.slice(0, 5)); // Show top 5

      if (paymentsResponse.success) {
        setPayments(paymentsResponse.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="mt-2 text-gray-600">Manage your service requests and payments</p>
      </div>

      {/* Stats - Now clickable for filtering */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card
          className={`bg-gradient-to-br from-blue-500 to-blue-600 text-white cursor-pointer hover:shadow-lg transition-shadow ${statusFilter === null ? 'ring-4 ring-blue-300' : ''}`}
          onClick={() => setStatusFilter(null)}
        >
          <h3 className="text-sm font-medium opacity-90">Total Requests</h3>
          <p className="text-3xl font-bold mt-2">{dashboardMetrics?.totalRequests || 0}</p>
          {statusFilter === null && <p className="text-xs mt-1 opacity-75">Viewing all</p>}
        </Card>
        <Card
          className={`bg-gradient-to-br from-yellow-500 to-yellow-600 text-white cursor-pointer hover:shadow-lg transition-shadow ${statusFilter === 'PENDING' ? 'ring-4 ring-yellow-300' : ''}`}
          onClick={() => setStatusFilter('PENDING')}
        >
          <h3 className="text-sm font-medium opacity-90">Pending</h3>
          <p className="text-3xl font-bold mt-2">{dashboardMetrics?.pendingCount || 0}</p>
          {statusFilter === 'PENDING' && <p className="text-xs mt-1 opacity-75">Click to clear</p>}
        </Card>
        <Card
          className={`bg-gradient-to-br from-purple-500 to-purple-600 text-white cursor-pointer hover:shadow-lg transition-shadow ${statusFilter === 'IN_PROGRESS' ? 'ring-4 ring-purple-300' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? null : 'IN_PROGRESS')}
        >
          <h3 className="text-sm font-medium opacity-90">In Progress</h3>
          <p className="text-3xl font-bold mt-2">{(dashboardMetrics?.inProgressCount || 0) + (dashboardMetrics?.acceptedCount || 0)}</p>
          {statusFilter === 'IN_PROGRESS' && <p className="text-xs mt-1 opacity-75">Click to clear</p>}
        </Card>
        <Card
          className={`bg-gradient-to-br from-green-500 to-green-600 text-white cursor-pointer hover:shadow-lg transition-shadow ${statusFilter === 'COMPLETED' ? 'ring-4 ring-green-300' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? null : 'COMPLETED')}
        >
          <h3 className="text-sm font-medium opacity-90">Completed</h3>
          <p className="text-3xl font-bold mt-2">{dashboardMetrics?.completedCount || 0}</p>
          {statusFilter === 'COMPLETED' && <p className="text-xs mt-1 opacity-75">Click to clear</p>}
        </Card>
      </div>

      {/* Notifications */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Notifications</h2>
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <Card className="text-center py-8 text-gray-500">
              <p>No new notifications</p>
            </Card>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`border-l-4 ${
                  notification.type === 'success' ? 'border-green-500' :
                  notification.type === 'warning' ? 'border-yellow-500' :
                  'border-blue-500'
                } ${notification.link ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
                onClick={() => notification.link && navigate(notification.link)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 ${
                      notification.type === 'success' ? 'text-green-500' :
                      notification.type === 'warning' ? 'text-yellow-500' :
                      'text-blue-500'
                    }`}>
                      {notification.type === 'success' && (
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      {notification.type === 'warning' && (
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      {notification.type === 'info' && (
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                    </div>
                  </div>
                  {notification.link && (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Pending Requests Section - Highlighted */}
      {(dashboardMetrics?.pendingCount || 0) > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Pending Requests <span className="text-yellow-600">({dashboardMetrics?.pendingCount || 0}/3)</span>
            </h2>
            {(dashboardMetrics?.pendingCount || 0) >= 3 && (
              <div className="text-sm text-yellow-600 font-medium">
                ⚠️ You've reached the maximum of 3 pending requests
              </div>
            )}
          </div>

          <div className="space-y-4">
            {serviceRequests
              .filter(request => request.status === 'PENDING')
              .map((request) => (
                <Card
                  key={request.id}
                  hoverable
                  onClick={() => navigate(`/requests/${request.id}`)}
                  className="border-l-4 border-yellow-500"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{request.serviceType.replace(/_/g, ' ')}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{request.description}</p>
                      {request.ca && (
                        <p className="text-sm text-gray-500 mt-2">Assigned to: {request.ca.user.name}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Created {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      PENDING
                    </span>
                  </div>
                </Card>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* All Service Requests */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {statusFilter === null ? 'All Requests' :
               statusFilter === 'PENDING' ? 'Pending Requests' :
               statusFilter === 'IN_PROGRESS' ? 'In Progress Requests' :
               'Completed Requests'}
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter(null)}
                  className="ml-3 text-sm text-blue-600 hover:text-blue-800 font-normal"
                >
                  (Clear filter)
                </button>
              )}
            </h2>
            <Button
              size="sm"
              onClick={() => navigate('/cas')}
              disabled={(dashboardMetrics?.pendingCount || 0) >= 3}
              title={(dashboardMetrics?.pendingCount || 0) >= 3 ? 'You have 3 pending requests. Please wait for them to be accepted or cancel them.' : 'Create new request'}
            >
              New Request
            </Button>
          </div>

          <div className="space-y-4">
            {(() => {
              const filteredRequests = statusFilter
                ? serviceRequests.filter(r => {
                    if (statusFilter === 'IN_PROGRESS') {
                      return r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED';
                    }
                    return r.status === statusFilter;
                  })
                : serviceRequests;

              return filteredRequests.length === 0 ? (
                <Card>
                  <p className="text-gray-500 text-center py-4">
                    {statusFilter
                      ? `No ${statusFilter.toLowerCase().replace('_', ' ')} requests`
                      : 'No service requests yet'}
                  </p>
                  {!statusFilter && (
                    <div className="text-center mt-4">
                      <Button onClick={() => navigate('/cas')}>Find a CA</Button>
                    </div>
                  )}
                </Card>
              ) : (
                filteredRequests.map((request) => (
                  <Card key={request.id} hoverable onClick={() => navigate(`/requests/${request.id}`)}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{request.serviceType.replace(/_/g, ' ')}</h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{request.description}</p>
                        {request.ca && (
                          <p className="text-sm text-gray-500 mt-2">CA: {request.ca.user.name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </Card>
                ))
              );
            })()}
          </div>
        </div>

        {/* Recent Payments */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Payments</h2>

          <div className="space-y-4">
            {payments.length === 0 ? (
              <Card>
                <p className="text-gray-500 text-center py-4">No payments yet</p>
              </Card>
            ) : (
              payments.map((payment) => (
                <Card key={payment.id}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">₹{payment.amount.toFixed(2)}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
