import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import api from '../../services/api';
import { Card, Button, Loading, Alert, Modal } from '../../components/common';

interface FirmMember {
  id: string;
  caId: string;
  role: string;
  membershipType: string;
  isActive: boolean;
  joinDate: string;
  canWorkIndependently: boolean;
  ca: {
    id: string;
    caLicenseNumber: string;
    specialization: string[];
    experienceYears: number;
    user: {
      id: string;
      name: string;
      email: string;
      phone?: string;
    };
  };
  _count?: {
    assignedRequests: number;
  };
}

interface Firm {
  id: string;
  firmName: string;
  firmType: string;
  status: string;
  verificationLevel: string;
  members: FirmMember[];
  _count?: {
    members: number;
    serviceRequests: number;
    currentCAs: number;
  };
}

const FirmAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FirmMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  useEffect(() => {
    fetchFirmData();
  }, []);

  const fetchFirmData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch firm data with members
      const response = await api.get('/firms?myFirm=true');

      if (response.data.success) {
        const firms = response.data.data.firms || [];

        if (firms.length > 0) {
          // Get detailed firm data with members
          const firmId = firms[0].id;
          const detailResponse = await api.get(`/firms/${firmId}?details=true&includeMembers=true`);

          if (detailResponse.data.success) {
            const firmData = detailResponse.data.data;

            // Check if user is a firm admin
            const userMembership = firmData.members?.find(
              (m: FirmMember) => m.ca.user.email === user?.email
            );

            if (!userMembership || userMembership.role !== 'FIRM_ADMIN') {
              setError('You do not have admin access to this firm');
              return;
            }

            setFirm(firmData);
          }
        } else {
          setError('No firm found. Please register or join a firm first.');
        }
      }
    } catch (err: any) {
      console.error('Error fetching firm data:', err);
      setError(err.response?.data?.message || 'Failed to load firm data');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (member: FirmMember) => {
    setSelectedMember(member);
    setShowRemoveModal(true);
  };

  const confirmRemoveMember = async () => {
    if (!selectedMember || !firm) return;

    try {
      setRemovingMember(true);
      setError('');

      const response = await api.post(`/firms/${firm.id}/remove-member`, {
        membershipId: selectedMember.id,
        transferTasks: true, // Transfer tasks to admin
      });

      if (response.data.success) {
        setSuccess(`${selectedMember.ca.user.name} has been removed from the firm. Their tasks have been transferred to you.`);
        setShowRemoveModal(false);
        setSelectedMember(null);

        // Refresh firm data
        await fetchFirmData();
      }
    } catch (err: any) {
      console.error('Error removing member:', err);
      setError(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setRemovingMember(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'FIRM_ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'SENIOR_CA':
        return 'bg-blue-100 text-blue-800';
      case 'JUNIOR_CA':
        return 'bg-green-100 text-green-800';
      case 'CONSULTANT':
        return 'bg-yellow-100 text-yellow-800';
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

  if (error && !firm) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert type="error">{error}</Alert>
        <div className="mt-4">
          <Button onClick={() => navigate('/ca/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <p className="text-gray-500 text-center py-8">No firm found</p>
          <div className="flex justify-center mt-4">
            <Button onClick={() => navigate('/ca/register-firm')}>Register a Firm</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{firm.firmName}</h1>
            <p className="mt-2 text-gray-600">Firm Admin Dashboard - Manage team and operations</p>
          </div>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              firm.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              firm.status === 'PENDING_VERIFICATION' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {firm.status.replace(/_/g, ' ')}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              firm.verificationLevel === 'PREMIUM' ? 'bg-purple-100 text-purple-800' :
              firm.verificationLevel === 'VERIFIED' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {firm.verificationLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4">
          <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert type="error" onClose={() => setError('')}>{error}</Alert>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Team Members</h3>
          <p className="text-3xl font-bold mt-2">{firm._count?.currentCAs || 0}</p>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Service Requests</h3>
          <p className="text-3xl font-bold mt-2">{firm._count?.serviceRequests || 0}</p>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Active Memberships</h3>
          <p className="text-3xl font-bold mt-2">{firm.members?.filter(m => m.isActive).length || 0}</p>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/ca/my-firm')}
            className="flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            View Firm Details
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/ca/my-firm?tab=invite`)}
            className="flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Members
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/requests?firmId=${firm.id}`)}
            className="flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View All Requests
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/ca/dashboard')}
            className="flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Personal Dashboard
          </Button>
        </div>
      </Card>

      {/* Team Members */}
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <Button size="sm" onClick={() => navigate(`/ca/my-firm?tab=invite`)}>
            + Invite Member
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Tasks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {firm.members
                ?.filter(m => m.isActive)
                .map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {member.ca.user.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {member.ca.user.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.ca.user.email}
                          </div>
                          <div className="text-xs text-gray-400">
                            {member.ca.specialization.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(member.role)}`}>
                        {member.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.membershipType.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(member.joinDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {member._count?.assignedRequests || 0}
                      </span>
                      <span className="text-sm text-gray-500"> requests</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {member.role === 'FIRM_ADMIN' ? (
                        <span className="text-gray-400">Admin</span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/ca/member/${member.caId}`)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {firm.members?.filter(m => m.isActive).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No active members found
            </div>
          )}
        </div>
      </Card>

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setSelectedMember(null);
        }}
        title="Remove Team Member"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Warning: Member Removal
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>You are about to remove <strong>{selectedMember?.ca.user.name}</strong> from your firm.</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>All their assigned tasks ({selectedMember?._count?.assignedRequests || 0}) will be transferred to you</li>
                    <li>They will lose access to firm resources</li>
                    <li>This action cannot be undone easily</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveModal(false);
                setSelectedMember(null);
              }}
              disabled={removingMember}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmRemoveMember}
              isLoading={removingMember}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Member
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FirmAdminDashboard;
