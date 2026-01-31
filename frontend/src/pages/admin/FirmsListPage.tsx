import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Loading, Modal, Input } from '../../components/common';
import { firmService, FirmFilters } from '../../services';

interface Firm {
  id: string;
  firmName: string;
  registrationNumber: string;
  firmType: string;
  status: string;
  verificationLevel: string;
  city: string;
  state: string;
  establishedYear: number;
  email: string;
  phone: string;
  _count?: {
    members: number;
    currentCAs: number;
    serviceRequests: number;
    firmReviews: number;
  };
}

const FirmsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [filters, setFilters] = useState<FirmFilters>({
    page: 1,
    limit: 20,
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFirms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadFirms = async () => {
    try {
      setLoading(true);
      const response = await firmService.getFirms(filters);
      setFirms(response.data.firms);
      setPagination(response.data.pagination);
    } catch (error: any) {
      console.error('Failed to load firms:', error);
      alert(error.response?.data?.message || 'Failed to load firms');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, searchQuery, page: 1 });
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
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

  const getVerificationBadgeColor = (level: string) => {
    switch (level) {
      case 'PREMIUM':
        return 'bg-purple-100 text-purple-800';
      case 'VERIFIED':
        return 'bg-blue-100 text-blue-800';
      case 'BASIC':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && firms.length === 0) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">CA Firms Management</h1>
          <p className="text-gray-600">Manage CA firms, memberships, and verification</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          + Create Firm
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">{pagination.total}</p>
          <p className="text-sm text-gray-600">Total Firms</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">
            {firms.filter(f => f.status === 'ACTIVE').length}
          </p>
          <p className="text-sm text-gray-600">Active Firms</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {firms.filter(f => f.status === 'PENDING_VERIFICATION').length}
          </p>
          <p className="text-sm text-gray-600">Pending Verification</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-600">
            {firms.reduce((sum, f) => sum + (f._count?.currentCAs || 0), 0)}
          </p>
          <p className="text-sm text-gray-600">Total CAs</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="col-span-2">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search by firm name or registration number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="outline">Search</Button>
            </div>
          </form>

          {/* Status Filter */}
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISSOLVED">Dissolved</option>
          </select>

          {/* Firm Type Filter */}
          <select
            value={filters.firmType || ''}
            onChange={(e) => handleFilterChange('firmType', e.target.value || undefined)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="SOLE_PROPRIETORSHIP">Sole Proprietorship</option>
            <option value="PARTNERSHIP">Partnership</option>
            <option value="LLP">LLP</option>
            <option value="PRIVATE_LIMITED">Private Limited</option>
          </select>
        </div>
      </Card>

      {/* Firms List */}
      <div className="space-y-4">
        {firms.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-gray-500 mb-4">No firms found</p>
            <Button onClick={() => setShowCreateModal(true)}>Create First Firm</Button>
          </Card>
        ) : (
          firms.map((firm) => (
            <Card key={firm.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <div
                className="flex justify-between items-start"
                onClick={() => navigate(`/admin/firms/${firm.id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{firm.firmName}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(firm.status)}`}>
                      {firm.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getVerificationBadgeColor(firm.verificationLevel)}`}>
                      {firm.verificationLevel}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    {firm.firmType.replace(/_/g, ' ')} • Reg: {firm.registrationNumber}
                  </p>

                  <p className="text-sm text-gray-600 mb-3">
                    📍 {firm.city}, {firm.state} • Est. {firm.establishedYear}
                  </p>

                  <div className="flex gap-6 text-sm text-gray-600">
                    <span>👥 {firm._count?.currentCAs || 0} CAs</span>
                    <span>📝 {firm._count?.serviceRequests || 0} Requests</span>
                    <span>⭐ {firm._count?.firmReviews || 0} Reviews</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-1">{firm.email}</p>
                  <p className="text-sm text-gray-600">{firm.phone}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create Firm Modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Firm">
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              Firm creation form will be implemented here.
            </p>
            <Button onClick={() => setShowCreateModal(false)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FirmsListPage;
