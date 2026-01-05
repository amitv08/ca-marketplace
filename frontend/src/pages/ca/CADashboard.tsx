import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { serviceRequestService, paymentService, caService } from '../../services';
import { Card, Button, Loading } from '../../components/common';

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  description: string;
  createdAt: string;
  client: {
    user: {
      name: string;
    };
  };
}

interface Payment {
  id: string;
  amount: number;
  caAmount?: number;
  status: string;
  releasedToCA: boolean;
  createdAt: string;
}

const CADashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    totalEarnings: 0,
    pendingPayments: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [requestsResponse, paymentsResponse, profileResponse] = await Promise.all([
        serviceRequestService.getRequests({ limit: 10 }),
        paymentService.getPaymentHistory(),
        caService.getMyProfile().catch(() => null),
      ]);

      if (requestsResponse.success) {
        const requests = requestsResponse.data.data || requestsResponse.data;
        setServiceRequests(requests);

        setStats(prev => ({
          ...prev,
          total: requests.length,
          pending: requests.filter((r: ServiceRequest) => r.status === 'PENDING').length,
          inProgress: requests.filter((r: ServiceRequest) => r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED').length,
          completed: requests.filter((r: ServiceRequest) => r.status === 'COMPLETED').length,
        }));
      }

      if (paymentsResponse.success) {
        const paymentsData = paymentsResponse.data;
        setPayments(paymentsData.slice(0, 5));

        const totalEarnings = paymentsData
          .filter((p: Payment) => p.releasedToCA)
          .reduce((sum: number, p: Payment) => sum + (p.caAmount || 0), 0);

        const pendingPayments = paymentsData
          .filter((p: Payment) => p.status === 'COMPLETED' && !p.releasedToCA)
          .reduce((sum: number, p: Payment) => sum + (p.caAmount || 0), 0);

        setStats(prev => ({
          ...prev,
          totalEarnings,
          pendingPayments,
        }));
      }

      if (profileResponse?.success) {
        setProfile(profileResponse.data);

        // Calculate profile completion
        const prof = profileResponse.data;
        let completed = 0;
        const fields = [
          prof.caLicenseNumber,
          prof.specialization?.length > 0,
          prof.experienceYears,
          prof.hourlyRate,
          prof.description,
          prof.qualifications?.length > 0,
          prof.languages?.length > 0,
        ];
        completed = fields.filter(Boolean).length;
        setProfileCompletion(Math.round((completed / fields.length) * 100));
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

  const getVerificationBadge = () => {
    if (!profile) return null;

    const status = profile.verificationStatus;
    if (status === 'VERIFIED') {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Verified</span>;
    } else if (status === 'PENDING') {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Pending Verification</span>;
    } else if (status === 'REJECTED') {
      return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">Rejected</span>;
    }
    return null;
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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="mt-2 text-gray-600">Manage your service requests and earnings</p>
        </div>
        <div>{getVerificationBadge()}</div>
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
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Earnings</h3>
          <p className="text-3xl font-bold mt-2">₹{stats.totalEarnings.toFixed(2)}</p>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Pending Payments</h3>
          <p className="text-3xl font-bold mt-2">₹{stats.pendingPayments.toFixed(2)}</p>
        </Card>
      </div>

      {/* Profile Completion & Availability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Profile Completion */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Completion</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Complete your profile to get more clients</span>
              <span className="text-sm font-semibold text-gray-900">{profileCompletion}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  profileCompletion === 100 ? 'bg-green-500' :
                  profileCompletion >= 70 ? 'bg-blue-500' :
                  profileCompletion >= 40 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            {profileCompletion < 100 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Missing fields:</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  {!profile?.description && <li>• Add profile description</li>}
                  {!profile?.qualifications?.length && <li>• Add qualifications</li>}
                  {!profile?.languages?.length && <li>• Add languages</li>}
                  {!profile?.specialization?.length && <li>• Add specializations</li>}
                </ul>
                <Button size="sm" className="mt-3" onClick={() => navigate('/profile')}>
                  Complete Profile
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Availability Calendar */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability This Week</h3>
          <div className="space-y-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => (
              <div key={day} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">{day}</span>
                <div className="flex items-center space-x-2">
                  {index < 5 ? (
                    <>
                      <span className="text-xs text-gray-500">9:00 AM - 6:00 PM</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Available</span>
                    </>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Not Available</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" fullWidth className="mt-4">
            Update Availability
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Service Requests */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Service Requests</h2>
            <Button size="sm" onClick={() => navigate('/profile')}>
              Update Profile
            </Button>
          </div>

          <div className="space-y-4">
            {serviceRequests.length === 0 ? (
              <Card>
                <p className="text-gray-500 text-center py-4">No service requests yet</p>
                <p className="text-sm text-gray-400 text-center mt-2">
                  {profile?.verificationStatus !== 'VERIFIED'
                    ? 'Your profile needs to be verified before receiving requests'
                    : 'Clients will send you requests based on your profile'}
                </p>
              </Card>
            ) : (
              serviceRequests.map((request) => (
                <Card key={request.id} hoverable onClick={() => navigate(`/requests/${request.id}`)}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{request.serviceType.replace(/_/g, ' ')}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{request.description}</p>
                      <p className="text-sm text-gray-500 mt-2">Client: {request.client.user.name}</p>
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

        {/* Payments & Earnings */}
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
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Total: ₹{payment.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-green-600 font-medium mt-1">
                        Your Amount: ₹{(payment.caAmount || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {payment.releasedToCA ? 'Released' : 'Pending Release'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
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

export default CADashboard;
