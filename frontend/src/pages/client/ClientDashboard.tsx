import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { serviceRequestService, paymentService } from '../../services';
import { Card, Button, Loading } from '../../components/common';

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  description: string;
  createdAt: string;
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
}

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'success',
      message: 'Your service request has been accepted by a CA',
      time: '2 hours ago',
    },
    {
      id: '2',
      type: 'info',
      message: 'New message from your CA regarding tax filing',
      time: '5 hours ago',
    },
    {
      id: '3',
      type: 'warning',
      message: 'Payment pending for GST Filing service',
      time: '1 day ago',
    },
  ]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [requestsResponse, paymentsResponse] = await Promise.all([
        serviceRequestService.getRequests({ limit: 10 }),
        paymentService.getPaymentHistory(),
      ]);

      if (requestsResponse.success) {
        const requests = requestsResponse.data.data || requestsResponse.data;
        setServiceRequests(requests);

        // Calculate stats
        setStats({
          total: requests.length,
          pending: requests.filter((r: ServiceRequest) => r.status === 'PENDING').length,
          inProgress: requests.filter((r: ServiceRequest) => r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED').length,
          completed: requests.filter((r: ServiceRequest) => r.status === 'COMPLETED').length,
        });
      }

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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Requests</h3>
          <p className="text-3xl font-bold mt-2">{stats.total}</p>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Pending</h3>
          <p className="text-3xl font-bold mt-2">{stats.pending}</p>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <h3 className="text-sm font-medium opacity-90">In Progress</h3>
          <p className="text-3xl font-bold mt-2">{stats.inProgress}</p>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Completed</h3>
          <p className="text-3xl font-bold mt-2">{stats.completed}</p>
        </Card>
      </div>

      {/* Notifications */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Notifications</h2>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification.id} className={`border-l-4 ${
              notification.type === 'success' ? 'border-green-500' :
              notification.type === 'warning' ? 'border-yellow-500' :
              'border-blue-500'
            }`}>
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
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Service Requests */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Recent Requests</h2>
            <Button size="sm" onClick={() => navigate('/cas')}>
              New Request
            </Button>
          </div>

          <div className="space-y-4">
            {serviceRequests.length === 0 ? (
              <Card>
                <p className="text-gray-500 text-center py-4">No service requests yet</p>
                <div className="text-center mt-4">
                  <Button onClick={() => navigate('/cas')}>Find a CA</Button>
                </div>
              </Card>
            ) : (
              serviceRequests.map((request) => (
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
            )}
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
