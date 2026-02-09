import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Card, Button, Loading, Alert, Modal } from '../../components/common';

interface CAApplication {
  id: string;
  user: {
    name: string;
    email: string;
  };
  caLicenseNumber: string;
  specialization: string[];
  experienceYears: number;
  hourlyRate: number;
  verificationStatus: string;
  description?: string;
  qualifications: string[];
}

const CAVerification: React.FC = () => {
  const [pendingCAs, setPendingCAs] = useState<CAApplication[]>([]);
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  // Modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedCA, setSelectedCA] = useState<CAApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Filter state
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCAs();
    fetchStats();
  }, [statusFilter]);

  const fetchCAs = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/admin/cas?status=${statusFilter}`);

      if (response.data.success) {
        setPendingCAs(response.data.data.data || response.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load CA applications');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [pending, verified, rejected, all] = await Promise.all([
        api.get('/admin/cas?status=PENDING'),
        api.get('/admin/cas?status=VERIFIED'),
        api.get('/admin/cas?status=REJECTED'),
        api.get('/admin/cas'),
      ]);

      setStats({
        pending: pending.data.data?.total || 0,
        verified: verified.data.data?.total || 0,
        rejected: rejected.data.data?.total || 0,
        total: all.data.data?.total || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleApprove = async (caId: string) => {
    try {
      setProcessing(caId);
      setError('');
      setSuccess('');

      const response = await api.put(`/admin/cas/${caId}/verify`, {
        status: 'VERIFIED',
      });

      if (response.data.success) {
        setSuccess('CA verified successfully!');
        await fetchCAs();
        await fetchStats();
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify CA');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedCA || !rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(selectedCA.id);
      setError('');
      setSuccess('');

      const response = await api.put(`/admin/cas/${selectedCA.id}/verify`, {
        status: 'REJECTED',
        reason: rejectionReason,
      });

      if (response.data.success) {
        setSuccess('CA application rejected');
        setShowRejectModal(false);
        setSelectedCA(null);
        setRejectionReason('');
        await fetchCAs();
        await fetchStats();
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject CA');
    } finally {
      setProcessing(null);
    }
  };

  const openRejectModal = (ca: CAApplication) => {
    setSelectedCA(ca);
    setShowRejectModal(true);
    setRejectionReason('');
  };

  const filteredCAs = pendingCAs.filter((ca) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      ca.user.name.toLowerCase().includes(searchLower) ||
      ca.user.email.toLowerCase().includes(searchLower) ||
      ca.caLicenseNumber.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CA Verification</h1>
        <p className="text-gray-600">Review and verify chartered accountant applications</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert type="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert type="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setStatusFilter('PENDING')}>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-sm text-gray-600">Pending Review</p>
        </Card>
        <Card className="text-center cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setStatusFilter('VERIFIED')}>
          <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
          <p className="text-sm text-gray-600">Verified</p>
        </Card>
        <Card className="text-center cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setStatusFilter('REJECTED')}>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          <p className="text-sm text-gray-600">Rejected</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          <p className="text-sm text-gray-600">Total CAs</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex gap-4">
          <select
            className="px-4 py-2 border rounded-lg"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <input
            type="text"
            placeholder="Search by name, email or license number..."
            className="flex-1 px-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {/* CA Applications */}
      <Card>
        <h2 className="text-xl font-bold mb-4">
          CA Applications {statusFilter && `(${statusFilter})`}
        </h2>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loading size="lg" />
            </div>
          ) : filteredCAs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✓</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">
                {statusFilter === 'PENDING' ? 'All Caught Up!' : 'No CAs Found'}
              </h3>
              <p className="text-gray-500 mb-4">
                {statusFilter === 'PENDING'
                  ? 'There are no pending CA verification requests at the moment.'
                  : `No CAs with status ${statusFilter} found.`}
              </p>
              {statusFilter === 'PENDING' && stats.verified > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> {stats.verified} CA{stats.verified !== 1 ? 's' : ''} in the system {stats.verified !== 1 ? 'have' : 'has'} been verified. New applications will appear here for review.
                  </p>
                </div>
              )}
            </div>
          ) : (
            filteredCAs.map((ca) => (
              <div key={ca.id} className="border rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">{ca.user.name}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-600">License Number:</span>
                        <span className="ml-2 font-medium">{ca.caLicenseNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Experience:</span>
                        <span className="ml-2 font-medium">{ca.experienceYears} years</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Email:</span>
                        <span className="ml-2 font-medium">{ca.user.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Hourly Rate:</span>
                        <span className="ml-2 font-medium">₹{ca.hourlyRate}</span>
                      </div>
                    </div>

                    {ca.description && (
                      <div className="mb-4">
                        <span className="text-gray-600 text-sm">Description:</span>
                        <p className="text-sm mt-1">{ca.description}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-600 text-sm">Specializations:</span>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {ca.specialization?.map((spec: string) => (
                          <span
                            key={spec}
                            className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {spec.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    {ca.qualifications && ca.qualifications.length > 0 && (
                      <div className="mt-4">
                        <span className="text-gray-600 text-sm">Qualifications:</span>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {ca.qualifications.map((qual: string, index: number) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-gray-100 text-gray-800 text-xs rounded-full"
                            >
                              {qual}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {statusFilter === 'PENDING' && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="primary"
                        onClick={() => handleApprove(ca.id)}
                        isLoading={processing === ca.id}
                        disabled={processing !== null}
                      >
                        ✓ Approve
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => openRejectModal(ca)}
                        disabled={processing !== null}
                      >
                        ✗ Reject
                      </Button>
                    </div>
                  )}

                  {statusFilter === 'VERIFIED' && (
                    <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                      ✓ Verified
                    </span>
                  )}

                  {statusFilter === 'REJECTED' && (
                    <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
                      ✗ Rejected
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedCA(null);
          setRejectionReason('');
        }}
        title="Reject CA Application"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            You are about to reject the application from <strong>{selectedCA?.user.name}</strong>.
            Please provide a reason for rejection:
          </p>

          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            rows={4}
            placeholder="Enter reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setSelectedCA(null);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              isLoading={processing === selectedCA?.id}
              disabled={!rejectionReason.trim()}
            >
              Reject Application
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CAVerification;
