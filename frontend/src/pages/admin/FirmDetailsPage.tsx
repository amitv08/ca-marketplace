import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loading, Modal } from '../../components/common';
import { firmService } from '../../services';

interface Firm {
  id: string;
  firmName: string;
  registrationNumber: string;
  gstin?: string;
  pan?: string;
  firmType: string;
  status: string;
  verificationLevel: string;
  establishedYear: number;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  website?: string;
  description?: string;
  logoUrl?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  allowIndependentWork: boolean;
  autoAssignmentEnabled: boolean;
  minimumCARequired: number;
  platformFeePercent: number;
  verifiedAt?: string;
  createdAt: string;
  _count?: {
    members: number;
    currentCAs: number;
    serviceRequests: number;
    firmReviews: number;
  };
}

interface FirmStats {
  totalMembers: number;
  activeMembers: number;
  totalRequests: number;
  completedRequests: number;
  averageRating: number;
  totalReviews: number;
  totalRevenue: number;
  activeCAs: number;
}

const FirmDetailsPage: React.FC = () => {
  const { firmId } = useParams<{ firmId: string }>();
  const navigate = useNavigate();
  const [firm, setFirm] = useState<Firm | null>(null);
  const [stats, setStats] = useState<FirmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showActionModal, setShowActionModal] = useState<{
    show: boolean;
    action: 'approve' | 'reject' | 'suspend' | 'reactivate' | 'dissolve' | null;
  }>({ show: false, action: null });
  const [actionNotes, setActionNotes] = useState('');

  useEffect(() => {
    if (firmId) {
      loadFirmDetails();
      loadFirmStats();
    }
  }, [firmId]);

  const loadFirmDetails = async () => {
    try {
      setLoading(true);
      const response = await firmService.getFirmById(firmId!, true);
      setFirm(response.data);
    } catch (error: any) {
      console.error('Failed to load firm details:', error);
      alert(error.response?.data?.message || 'Failed to load firm details');
    } finally {
      setLoading(false);
    }
  };

  const loadFirmStats = async () => {
    try {
      const response = await firmService.getFirmStats(firmId!);
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to load firm stats:', error);
    }
  };

  const handleAction = async () => {
    if (!showActionModal.action) return;

    try {
      switch (showActionModal.action) {
        case 'approve':
          await firmService.approveFirm(firmId!, 'VERIFIED', actionNotes);
          alert('Firm approved successfully');
          break;
        case 'reject':
          if (!actionNotes) {
            alert('Rejection reason is required');
            return;
          }
          await firmService.rejectFirm(firmId!, actionNotes);
          alert('Firm rejected');
          break;
        case 'suspend':
          if (!actionNotes) {
            alert('Suspension reason is required');
            return;
          }
          await firmService.suspendFirm(firmId!, actionNotes);
          alert('Firm suspended');
          break;
        case 'reactivate':
          await firmService.reactivateFirm(firmId!);
          alert('Firm reactivated');
          break;
        case 'dissolve':
          await firmService.dissolveFirm(firmId!, actionNotes);
          alert('Firm dissolved');
          break;
      }
      setShowActionModal({ show: false, action: null });
      setActionNotes('');
      loadFirmDetails();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Action failed');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PENDING_VERIFICATION':
        return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'DISSOLVED':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || !firm) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <button
            onClick={() => navigate('/admin/firms')}
            className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
          >
            ← Back to Firms
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{firm.firmName}</h1>
            <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusBadgeColor(firm.status)}`}>
              {firm.status.replace(/_/g, ' ')}
            </span>
            <span className="px-3 py-1 text-sm font-medium rounded bg-blue-100 text-blue-800">
              {firm.verificationLevel}
            </span>
          </div>
          <p className="text-gray-600 mt-1">
            {firm.firmType.replace(/_/g, ' ')} • Reg: {firm.registrationNumber}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {firm.status === 'PENDING_VERIFICATION' && (
            <>
              <Button
                onClick={() => setShowActionModal({ show: true, action: 'approve' })}
                className="bg-green-600 hover:bg-green-700"
              >
                Approve
              </Button>
              <Button
                onClick={() => setShowActionModal({ show: true, action: 'reject' })}
                variant="outline"
                className="text-red-600 border-red-600"
              >
                Reject
              </Button>
            </>
          )}
          {firm.status === 'ACTIVE' && (
            <Button
              onClick={() => setShowActionModal({ show: true, action: 'suspend' })}
              variant="outline"
              className="text-orange-600 border-orange-600"
            >
              Suspend
            </Button>
          )}
          {firm.status === 'SUSPENDED' && (
            <Button
              onClick={() => setShowActionModal({ show: true, action: 'reactivate' })}
              className="bg-green-600 hover:bg-green-700"
            >
              Reactivate
            </Button>
          )}
          {(firm.status === 'ACTIVE' || firm.status === 'SUSPENDED') && (
            <Button
              onClick={() => setShowActionModal({ show: true, action: 'dissolve' })}
              variant="outline"
              className="text-red-600 border-red-600"
            >
              Dissolve
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.activeCAs}</p>
            <p className="text-sm text-gray-600">Active CAs</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completedRequests}</p>
            <p className="text-sm text-gray-600">Completed Requests</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {stats.averageRating.toFixed(1)} ⭐
            </p>
            <p className="text-sm text-gray-600">{stats.totalReviews} Reviews</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              ₹{stats.totalRevenue.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">Total Revenue</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'members', 'documents', 'reviews', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Firm Name</p>
                  <p className="font-medium">{firm.firmName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Firm Type</p>
                  <p className="font-medium">{firm.firmType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Registration Number</p>
                  <p className="font-medium">{firm.registrationNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Established Year</p>
                  <p className="font-medium">{firm.establishedYear}</p>
                </div>
                {firm.gstin && (
                  <div>
                    <p className="text-sm text-gray-600">GSTIN</p>
                    <p className="font-medium">{firm.gstin}</p>
                  </div>
                )}
                {firm.pan && (
                  <div>
                    <p className="text-sm text-gray-600">PAN</p>
                    <p className="font-medium">{firm.pan}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Contact Information */}
            <Card>
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{firm.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{firm.phone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium">
                    {firm.address}, {firm.city}, {firm.state} - {firm.pincode}
                  </p>
                </div>
                {firm.website && (
                  <div>
                    <p className="text-sm text-gray-600">Website</p>
                    <a
                      href={firm.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {firm.website}
                    </a>
                  </div>
                )}
              </div>
            </Card>

            {/* Contact Person */}
            {firm.contactPersonName && (
              <Card>
                <h3 className="text-lg font-semibold mb-4">Contact Person</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium">{firm.contactPersonName}</p>
                  </div>
                  {firm.contactPersonEmail && (
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{firm.contactPersonEmail}</p>
                    </div>
                  )}
                  {firm.contactPersonPhone && (
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{firm.contactPersonPhone}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Configuration */}
            <Card>
              <h3 className="text-lg font-semibold mb-4">Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Allow Independent Work</p>
                  <p className="font-medium">
                    {firm.allowIndependentWork ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Auto Assignment</p>
                  <p className="font-medium">
                    {firm.autoAssignmentEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Minimum CAs Required</p>
                  <p className="font-medium">{firm.minimumCARequired}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Platform Fee</p>
                  <p className="font-medium">{firm.platformFeePercent}%</p>
                </div>
              </div>
            </Card>

            {/* Description */}
            {firm.description && (
              <Card>
                <h3 className="text-lg font-semibold mb-4">Description</h3>
                <p className="text-gray-700">{firm.description}</p>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <Card>
            <p className="text-center text-gray-500 py-8">
              Members management will be implemented here
            </p>
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <p className="text-center text-gray-500 py-8">
              Documents management will be implemented here
            </p>
          </Card>
        )}

        {activeTab === 'reviews' && (
          <Card>
            <p className="text-center text-gray-500 py-8">
              Reviews will be displayed here
            </p>
          </Card>
        )}

        {activeTab === 'payments' && (
          <Card>
            <p className="text-center text-gray-500 py-8">
              Payment summary will be displayed here
            </p>
          </Card>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal.show && (
        <Modal
          onClose={() => setShowActionModal({ show: false, action: null })}
          title={`${showActionModal.action} Firm`}
        >
          <div className="space-y-4">
            <p>
              Are you sure you want to {showActionModal.action} this firm?
            </p>
            {(showActionModal.action === 'reject' ||
              showActionModal.action === 'suspend' ||
              showActionModal.action === 'dissolve') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason {showActionModal.action === 'reject' || showActionModal.action === 'suspend' ? '(Required)' : '(Optional)'}
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter reason..."
                />
              </div>
            )}
            {showActionModal.action === 'approve' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes..."
                />
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowActionModal({ show: false, action: null })}
              >
                Cancel
              </Button>
              <Button onClick={handleAction}>Confirm</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FirmDetailsPage;
