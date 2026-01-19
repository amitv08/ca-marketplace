import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Loading, Modal, RatingStars } from '../../components/common';
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

interface FirmMember {
  id: string;
  firmId: string;
  caId: string;
  role: string;
  membershipType: string;
  isActive: boolean;
  canWorkIndependently: boolean;
  commissionPercent?: number;
  joinedAt: string;
  ca: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
    licenseNumber: string;
    specializations: string[];
  };
}

interface FirmDocument {
  id: string;
  firmId: string;
  documentType: string;
  documentUrl: string;
  fileName: string;
  fileSize: string;
  isVerified: boolean;
  uploadedAt: string;
  verifiedAt?: string;
}

interface FirmReview {
  id: string;
  rating: number;
  review?: string;
  professionalismRating?: number;
  communicationRating?: number;
  timelinessRating?: number;
  valueForMoneyRating?: number;
  createdAt: string;
  client: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

interface PaymentSummary {
  totalRevenue: number;
  platformFees: number;
  firmCommissions: number;
  caPayouts: number;
  pendingDistributions: number;
  completedDistributions: number;
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

  // Members tab state
  const [members, setMembers] = useState<FirmMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Documents tab state
  const [documents, setDocuments] = useState<FirmDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<FirmDocument | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Reviews tab state
  const [reviews, setReviews] = useState<FirmReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPagination, setReviewsPagination] = useState({ page: 1, total: 0 });

  // Payments tab state
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  useEffect(() => {
    if (firmId) {
      loadFirmDetails();
      loadFirmStats();
    }
  }, [firmId]);

  useEffect(() => {
    if (firmId && activeTab !== 'overview') {
      loadTabData();
    }
  }, [firmId, activeTab]);

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

  const loadTabData = () => {
    switch (activeTab) {
      case 'members':
        loadMembers();
        break;
      case 'documents':
        loadDocuments();
        break;
      case 'reviews':
        loadReviews();
        break;
      case 'payments':
        loadPayments();
        break;
    }
  };

  const loadMembers = async () => {
    try {
      setMembersLoading(true);
      const response = await firmService.getFirmMembers(firmId!, false);
      setMembers(response.data);
    } catch (error: any) {
      console.error('Failed to load members:', error);
      alert(error.response?.data?.message || 'Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setDocumentsLoading(true);
      const response = await firmService.getFirmDocuments(firmId!, true);
      setDocuments(response.data);
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      alert(error.response?.data?.message || 'Failed to load documents');
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadReviews = async (page: number = 1) => {
    try {
      setReviewsLoading(true);
      const response = await firmService.getFirmReviews(firmId!, page, 10);
      setReviews(response.data.reviews);
      setReviewsPagination({ page, total: response.data.pagination.total });
    } catch (error: any) {
      console.error('Failed to load reviews:', error);
      alert(error.response?.data?.message || 'Failed to load reviews');
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      setPaymentsLoading(true);
      const response = await firmService.getFirmPaymentSummary(firmId!);
      setPaymentSummary(response.data);
    } catch (error: any) {
      console.error('Failed to load payment summary:', error);
      alert(error.response?.data?.message || 'Failed to load payment summary');
    } finally {
      setPaymentsLoading(false);
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

  const handleRemoveMember = async (membershipId: string) => {
    const reason = prompt('Please provide a reason for removing this member:');
    if (!reason) return;

    try {
      await firmService.removeMember(membershipId, reason);
      alert('Member removed successfully');
      loadMembers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleVerifyDocument = async (documentId: string, isVerified: boolean) => {
    try {
      const notes = isVerified ? '' : prompt('Please provide verification notes:') || '';
      await firmService.verifyDocument(documentId, isVerified, notes);
      alert(isVerified ? 'Document verified successfully' : 'Document marked as unverified');
      loadDocuments();
      setShowDocumentModal(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update document');
    }
  };

  const handleRejectDocument = async (documentId: string) => {
    const reason = prompt('Please provide a reason for rejecting this document:');
    if (!reason) return;

    try {
      await firmService.rejectDocument(documentId, reason);
      alert('Document rejected');
      loadDocuments();
      setShowDocumentModal(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reject document');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await firmService.deleteDocument(documentId);
      alert('Document deleted successfully');
      loadDocuments();
      setShowDocumentModal(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete document');
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
          <div>
            {membersLoading ? (
              <Loading />
            ) : (
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Firm Members ({members.length})</h3>
                </div>

                {members.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No members found</p>
                ) : (
                  <div className="space-y-4">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold">
                                {member.ca.user.firstName} {member.ca.user.lastName}
                              </h4>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  member.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {member.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                {member.role.replace(/_/g, ' ')}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div>
                                <span className="text-gray-600">Email:</span>
                                <span className="ml-2 font-medium">{member.ca.user.email}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">License:</span>
                                <span className="ml-2 font-medium">{member.ca.licenseNumber}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Membership Type:</span>
                                <span className="ml-2 font-medium">
                                  {member.membershipType.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Independent Work:</span>
                                <span className="ml-2 font-medium">
                                  {member.canWorkIndependently ? 'Allowed' : 'Not Allowed'}
                                </span>
                              </div>
                              {member.commissionPercent && (
                                <div>
                                  <span className="text-gray-600">Commission:</span>
                                  <span className="ml-2 font-medium">{member.commissionPercent}%</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-600">Joined:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(member.joinedAt).toLocaleDateString()}
                                </span>
                              </div>
                              {member.ca.specializations.length > 0 && (
                                <div className="col-span-2">
                                  <span className="text-gray-600">Specializations:</span>
                                  <div className="flex gap-2 mt-1">
                                    {member.ca.specializations.map((spec, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded"
                                      >
                                        {spec.replace(/_/g, ' ')}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {member.isActive && (
                              <Button
                                onClick={() => handleRemoveMember(member.id)}
                                variant="outline"
                                className="text-red-600 border-red-600 text-sm"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            {documentsLoading ? (
              <Loading />
            ) : (
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Firm Documents ({documents.length})</h3>
                </div>

                {documents.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No documents found</p>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedDocument(doc);
                          setShowDocumentModal(true);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-base font-semibold">{doc.fileName}</h4>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  doc.isVerified
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {doc.isVerified ? 'Verified' : 'Pending'}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Type:</span>
                                <span className="ml-2 font-medium">
                                  {doc.documentType.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Size:</span>
                                <span className="ml-2 font-medium">
                                  {(parseInt(doc.fileSize) / 1024 / 1024).toFixed(2)} MB
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Uploaded:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(doc.uploadedAt).toLocaleDateString()}
                                </span>
                              </div>
                              {doc.verifiedAt && (
                                <div>
                                  <span className="text-gray-600">Verified:</span>
                                  <span className="ml-2 font-medium">
                                    {new Date(doc.verifiedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(doc.documentUrl, '_blank');
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            {reviewsLoading ? (
              <Loading />
            ) : (
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Firm Reviews ({reviewsPagination.total})</h3>
                </div>

                {reviews.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No reviews yet</p>
                ) : (
                  <div>
                    <div className="space-y-6">
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold">
                                  {review.client.user.firstName} {review.client.user.lastName}
                                </h4>
                                <RatingStars rating={review.rating} size="sm" showValue />
                              </div>
                              <p className="text-sm text-gray-500">
                                {new Date(review.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>

                          {review.review && (
                            <p className="text-gray-700 mb-4">{review.review}</p>
                          )}

                          {/* Detailed Ratings */}
                          {(review.professionalismRating ||
                            review.communicationRating ||
                            review.timelinessRating ||
                            review.valueForMoneyRating) && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                              {review.professionalismRating && (
                                <div className="text-sm">
                                  <p className="text-gray-600 mb-1">Professionalism</p>
                                  <RatingStars rating={review.professionalismRating} size="sm" />
                                </div>
                              )}
                              {review.communicationRating && (
                                <div className="text-sm">
                                  <p className="text-gray-600 mb-1">Communication</p>
                                  <RatingStars rating={review.communicationRating} size="sm" />
                                </div>
                              )}
                              {review.timelinessRating && (
                                <div className="text-sm">
                                  <p className="text-gray-600 mb-1">Timeliness</p>
                                  <RatingStars rating={review.timelinessRating} size="sm" />
                                </div>
                              )}
                              {review.valueForMoneyRating && (
                                <div className="text-sm">
                                  <p className="text-gray-600 mb-1">Value for Money</p>
                                  <RatingStars rating={review.valueForMoneyRating} size="sm" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {reviewsPagination.total > 10 && (
                      <div className="flex justify-center gap-2 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => loadReviews(reviewsPagination.page - 1)}
                          disabled={reviewsPagination.page === 1}
                        >
                          Previous
                        </Button>
                        <span className="px-4 py-2 text-sm">
                          Page {reviewsPagination.page} of {Math.ceil(reviewsPagination.total / 10)}
                        </span>
                        <Button
                          variant="outline"
                          onClick={() => loadReviews(reviewsPagination.page + 1)}
                          disabled={reviewsPagination.page >= Math.ceil(reviewsPagination.total / 10)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            {paymentsLoading ? (
              <Loading />
            ) : paymentSummary ? (
              <div className="space-y-6">
                {/* Payment Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      ₹{paymentSummary.totalRevenue.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Total Revenue</p>
                  </Card>
                  <Card className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      ₹{paymentSummary.firmCommissions.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Firm Commissions</p>
                  </Card>
                  <Card className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      ₹{paymentSummary.caPayouts.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">CA Payouts</p>
                  </Card>
                  <Card className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      ₹{paymentSummary.platformFees.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Platform Fees</p>
                  </Card>
                  <Card className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {paymentSummary.pendingDistributions}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Pending Distributions</p>
                  </Card>
                  <Card className="text-center">
                    <p className="text-2xl font-bold text-teal-600">
                      {paymentSummary.completedDistributions}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Completed Distributions</p>
                  </Card>
                </div>

                {/* Payment Breakdown */}
                <Card>
                  <h3 className="text-lg font-semibold mb-4">Payment Distribution Breakdown</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">Total Revenue Generated</span>
                      <span className="text-lg font-bold text-green-600">
                        ₹{paymentSummary.totalRevenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="pl-6 space-y-2">
                      <div className="flex items-center justify-between p-2 border-l-4 border-orange-400">
                        <span className="text-gray-700">Platform Fees Collected</span>
                        <span className="font-semibold text-orange-600">
                          - ₹{paymentSummary.platformFees.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 border-l-4 border-blue-400">
                        <span className="text-gray-700">Firm Commission Earned</span>
                        <span className="font-semibold text-blue-600">
                          ₹{paymentSummary.firmCommissions.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 border-l-4 border-purple-400">
                        <span className="text-gray-700">Total CA Payouts</span>
                        <span className="font-semibold text-purple-600">
                          ₹{paymentSummary.caPayouts.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Commission Percentage */}
                    <div className="mt-6 p-4 bg-blue-50 rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">
                          Firm Commission Rate
                        </span>
                        <span className="text-xl font-bold text-blue-600">
                          {paymentSummary.totalRevenue > 0
                            ? (
                                (paymentSummary.firmCommissions /
                                  (paymentSummary.totalRevenue - paymentSummary.platformFees)) *
                                100
                              ).toFixed(1)
                            : '0.0'}
                          %
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        Calculated from total commissions earned on revenue after platform fees
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              <Card>
                <p className="text-center text-gray-500 py-8">No payment data available</p>
              </Card>
            )}
          </div>
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

      {/* Document Modal */}
      {showDocumentModal && selectedDocument && (
        <Modal
          onClose={() => {
            setShowDocumentModal(false);
            setSelectedDocument(null);
          }}
          title="Document Details"
        >
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{selectedDocument.fileName}</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Type:</span>
                  <span className="ml-2 font-medium">
                    {selectedDocument.documentType.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span
                    className={`ml-2 px-2 py-1 text-xs font-medium rounded ${
                      selectedDocument.isVerified
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {selectedDocument.isVerified ? 'Verified' : 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Size:</span>
                  <span className="ml-2 font-medium">
                    {(parseInt(selectedDocument.fileSize) / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Uploaded:</span>
                  <span className="ml-2 font-medium">
                    {new Date(selectedDocument.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
                {selectedDocument.verifiedAt && (
                  <div className="col-span-2">
                    <span className="text-gray-600">Verified:</span>
                    <span className="ml-2 font-medium">
                      {new Date(selectedDocument.verifiedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={() => window.open(selectedDocument.documentUrl, '_blank')}
                variant="outline"
                className="flex-1"
              >
                View Document
              </Button>
              {!selectedDocument.isVerified ? (
                <>
                  <Button
                    onClick={() => handleVerifyDocument(selectedDocument.id, true)}
                    className="bg-green-600 hover:bg-green-700 flex-1"
                  >
                    Verify
                  </Button>
                  <Button
                    onClick={() => handleRejectDocument(selectedDocument.id)}
                    variant="outline"
                    className="text-red-600 border-red-600 flex-1"
                  >
                    Reject
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => handleVerifyDocument(selectedDocument.id, false)}
                  variant="outline"
                  className="text-orange-600 border-orange-600 flex-1"
                >
                  Unverify
                </Button>
              )}
              <Button
                onClick={() => handleDeleteDocument(selectedDocument.id)}
                variant="outline"
                className="text-red-600 border-red-600"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FirmDetailsPage;
