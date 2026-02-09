import api from './api';

// Type definitions for Firm-related operations
export interface FirmFilters {
  status?: string;
  firmType?: string;
  verificationLevel?: string;
  city?: string;
  state?: string;
  searchQuery?: string;
  minEstablishedYear?: number;
  maxEstablishedYear?: number;
  page?: number;
  limit?: number;
}

export interface CreateFirmData {
  firmName: string;
  registrationNumber: string;
  gstin?: string;
  pan?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  firmType: string;
  establishedYear: number;
  description?: string;
  website?: string;
  logoUrl?: string;
  profileImage?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  allowIndependentWork?: boolean;
  autoAssignmentEnabled?: boolean;
  minimumCARequired?: number;
  platformFeePercent?: number;
}

export interface AddMemberData {
  firmId: string;
  caId: string;
  role: string;
  membershipType: string;
  canWorkIndependently?: boolean;
  commissionPercent?: number;
  responsibilities?: string;
}

export interface UploadDocumentData {
  firmId: string;
  documentType: string;
  documentUrl: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
}

export interface CreateReviewData {
  firmId: string;
  requestId: string;
  rating: number;
  review?: string;
  professionalismRating?: number;
  communicationRating?: number;
  timelinessRating?: number;
  valueForMoneyRating?: number;
}

export interface CreateIndependentWorkRequestData {
  firmId: string;
  clientId: string;
  serviceType: string;
  estimatedValue: number;
  duration?: string;
  justification: string;
  firmCommissionPercent?: number;
}

const firmService = {
  // ============ Firm Operations ============

  // Get all firms with filters
  getFirms: async (filters: FirmFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    const response = await api.get(`/firms?${params.toString()}`);
    return response.data;
  },

  // Search firms
  searchFirms: async (query: string, limit: number = 10) => {
    const response = await api.get(`/firms/search?q=${query}&limit=${limit}`);
    return response.data;
  },

  // Get firm by ID
  getFirmById: async (firmId: string, includeDetails: boolean = false) => {
    const response = await api.get(`/firms/${firmId}?details=${includeDetails}`);
    return response.data;
  },

  // Create a new firm (Admin only)
  createFirm: async (data: CreateFirmData) => {
    const response = await api.post('/firms', data);
    return response.data;
  },

  // Update firm details
  updateFirm: async (firmId: string, data: Partial<CreateFirmData>) => {
    const response = await api.put(`/firms/${firmId}`, data);
    return response.data;
  },

  // Submit firm for verification
  submitForVerification: async (firmId: string, requiredDocumentIds: string[]) => {
    const response = await api.post(`/firms/${firmId}/submit-verification`, {
      requiredDocumentIds,
    });
    return response.data;
  },

  // Approve firm (Admin only)
  approveFirm: async (firmId: string, verificationLevel: string, notes?: string) => {
    const response = await api.post(`/firms/${firmId}/approve`, {
      verificationLevel,
      notes,
    });
    return response.data;
  },

  // Reject firm (Admin only)
  rejectFirm: async (firmId: string, reason: string) => {
    const response = await api.post(`/firms/${firmId}/reject`, { reason });
    return response.data;
  },

  // Suspend firm (Admin only)
  suspendFirm: async (firmId: string, reason: string) => {
    const response = await api.post(`/firms/${firmId}/suspend`, { reason });
    return response.data;
  },

  // Reactivate firm (Admin only)
  reactivateFirm: async (firmId: string) => {
    const response = await api.post(`/firms/${firmId}/reactivate`);
    return response.data;
  },

  // Dissolve firm
  dissolveFirm: async (firmId: string, reason?: string) => {
    const response = await api.post(`/firms/${firmId}/dissolve`, { reason });
    return response.data;
  },

  // Get firm statistics
  getFirmStats: async (firmId: string) => {
    const response = await api.get(`/firms/${firmId}/stats`);
    return response.data;
  },

  // ============ Membership Operations ============

  // Get firm members
  getFirmMembers: async (firmId: string, activeOnly: boolean = true) => {
    const response = await api.get(`/firm-memberships/firm/${firmId}?activeOnly=${activeOnly}`);
    return response.data;
  },

  // Get CA's current firm
  getCACurrentFirm: async (caId: string) => {
    const response = await api.get(`/firm-memberships/ca/${caId}/current-firm`);
    return response.data;
  },

  // Check if CA can join firm
  checkCAEligibility: async (caId: string, firmId: string) => {
    const response = await api.get(`/firm-memberships/check-eligibility?caId=${caId}&firmId=${firmId}`);
    return response.data;
  },

  // Add member to firm (Admin only)
  addMember: async (data: AddMemberData) => {
    const response = await api.post('/firm-memberships', data);
    return response.data;
  },

  // Update membership
  updateMembership: async (membershipId: string, data: Partial<AddMemberData>) => {
    const response = await api.put(`/firm-memberships/${membershipId}`, data);
    return response.data;
  },

  // Deactivate membership
  deactivateMembership: async (membershipId: string, reason: string) => {
    const response = await api.post(`/firm-memberships/${membershipId}/deactivate`, { reason });
    return response.data;
  },

  // Remove member
  removeMember: async (membershipId: string, reason: string) => {
    const response = await api.delete(`/firm-memberships/${membershipId}`, {
      data: { reason },
    });
    return response.data;
  },

  // Get membership history
  getMembershipHistory: async (membershipId: string) => {
    const response = await api.get(`/firm-memberships/${membershipId}/history`);
    return response.data;
  },

  // Get member statistics
  getMemberStats: async (membershipId: string) => {
    const response = await api.get(`/firm-memberships/${membershipId}/stats`);
    return response.data;
  },

  // ============ Document Operations ============

  // Get firm documents
  getFirmDocuments: async (firmId: string, includeUnverified: boolean = true) => {
    const response = await api.get(`/firm-documents/firm/${firmId}?includeUnverified=${includeUnverified}`);
    return response.data;
  },

  // Upload document
  uploadDocument: async (data: UploadDocumentData) => {
    const response = await api.post('/firm-documents', data);
    return response.data;
  },

  // Verify document (Admin only)
  verifyDocument: async (documentId: string, isVerified: boolean, verificationNotes?: string) => {
    const response = await api.post(`/firm-documents/${documentId}/verify`, {
      isVerified,
      verificationNotes,
    });
    return response.data;
  },

  // Reject document (Admin only)
  rejectDocument: async (documentId: string, reason: string) => {
    const response = await api.post(`/firm-documents/${documentId}/reject`, { reason });
    return response.data;
  },

  // Delete document
  deleteDocument: async (documentId: string) => {
    const response = await api.delete(`/firm-documents/${documentId}`);
    return response.data;
  },

  // Check document completeness
  checkDocumentCompleteness: async (firmId: string) => {
    const response = await api.get(`/firm-documents/firm/${firmId}/completeness`);
    return response.data;
  },

  // Get pending verification documents (Admin)
  getPendingDocuments: async (page: number = 1, limit: number = 20) => {
    const response = await api.get(`/firm-documents/admin/pending-verification?page=${page}&limit=${limit}`);
    return response.data;
  },

  // ============ Assignment Operations ============

  // Auto-assign request
  autoAssignRequest: async (requestId: string, preferFirm: boolean = false) => {
    const response = await api.post('/firm-assignments/auto-assign', {
      requestId,
      preferFirm,
    });
    return response.data;
  },

  // Manual assignment
  manualAssignRequest: async (requestId: string, caId: string, firmId?: string, reason?: string) => {
    const response = await api.post('/firm-assignments/manual-assign', {
      requestId,
      caId,
      firmId,
      reason,
    });
    return response.data;
  },

  // Get assignment recommendations
  getAssignmentRecommendations: async (serviceType: string, city?: string, state?: string, limit: number = 5) => {
    const params = new URLSearchParams({ serviceType, limit: limit.toString() });
    if (city) params.append('city', city);
    if (state) params.append('state', state);
    const response = await api.get(`/firm-assignments/recommendations?${params.toString()}`);
    return response.data;
  },

  // ============ Payment Operations ============

  // Calculate payment distribution
  calculateDistribution: async (totalAmount: number, caId: string, firmId?: string) => {
    const response = await api.post('/firm-payments/calculate', {
      totalAmount,
      caId,
      firmId,
    });
    return response.data;
  },

  // Get firm payment summary
  getFirmPaymentSummary: async (firmId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await api.get(`/firm-payments/summary/firm/${firmId}?${params.toString()}`);
    return response.data;
  },

  // Get CA payment summary
  getCAPaymentSummary: async (caId: string, firmId?: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (firmId) params.append('firmId', firmId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await api.get(`/firm-payments/summary/ca/${caId}?${params.toString()}`);
    return response.data;
  },

  // Get pending distributions
  getPendingDistributions: async (firmId?: string, page: number = 1, limit: number = 20) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (firmId) params.append('firmId', firmId);
    const response = await api.get(`/firm-payments/distributions/pending?${params.toString()}`);
    return response.data;
  },

  // ============ Independent Work Operations ============

  // Create independent work request (CA)
  createIndependentWorkRequest: async (data: CreateIndependentWorkRequestData) => {
    const response = await api.post('/independent-work-requests', data);
    return response.data;
  },

  // Get firm requests
  getFirmIndependentWorkRequests: async (firmId: string, status?: string, page: number = 1, limit: number = 20) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    const response = await api.get(`/independent-work-requests/firm/${firmId}?${params.toString()}`);
    return response.data;
  },

  // Get CA requests
  getCAIndependentWorkRequests: async (caId: string, status?: string, page: number = 1, limit: number = 20) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    const response = await api.get(`/independent-work-requests/ca/${caId}?${params.toString()}`);
    return response.data;
  },

  // Review independent work request (Admin)
  reviewIndependentWorkRequest: async (requestId: string, status: string, reviewNotes?: string, approvedFirmCommission?: number) => {
    const response = await api.post(`/independent-work-requests/${requestId}/review`, {
      status,
      reviewNotes,
      approvedFirmCommission,
    });
    return response.data;
  },

  // Cancel request (CA)
  cancelIndependentWorkRequest: async (requestId: string, reason?: string) => {
    const response = await api.post(`/independent-work-requests/${requestId}/cancel`, { reason });
    return response.data;
  },

  // Get request statistics
  getIndependentWorkStats: async (firmId?: string, caId?: string) => {
    const params = new URLSearchParams();
    if (firmId) params.append('firmId', firmId);
    if (caId) params.append('caId', caId);
    const response = await api.get(`/independent-work-requests/stats/summary?${params.toString()}`);
    return response.data;
  },

  // ============ Review Operations ============

  // Get firm reviews
  getFirmReviews: async (firmId: string, page: number = 1, limit: number = 20, minRating?: number) => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (minRating) params.append('minRating', minRating.toString());
    const response = await api.get(`/firm-reviews/firm/${firmId}?${params.toString()}`);
    return response.data;
  },

  // Create firm review (Client)
  createFirmReview: async (data: CreateReviewData) => {
    const response = await api.post('/firm-reviews', data);
    return response.data;
  },

  // Update review
  updateFirmReview: async (reviewId: string, data: Partial<CreateReviewData>) => {
    const response = await api.put(`/firm-reviews/${reviewId}`, data);
    return response.data;
  },

  // Delete review
  deleteFirmReview: async (reviewId: string) => {
    const response = await api.delete(`/firm-reviews/${reviewId}`);
    return response.data;
  },

  // Get firm rating statistics
  getFirmRatingStats: async (firmId: string) => {
    const response = await api.get(`/firm-reviews/firm/${firmId}/stats`);
    return response.data;
  },

  // Get top rated firms
  getTopRatedFirms: async (limit: number = 10, minReviews: number = 5) => {
    const response = await api.get(`/firm-reviews/admin/top-rated?limit=${limit}&minReviews=${minReviews}`);
    return response.data;
  },
};

export default firmService;
