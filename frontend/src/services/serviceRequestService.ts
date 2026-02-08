import api from './api';

export interface CreateServiceRequestData {
  caId: string;
  serviceType: string;
  description: string;
  deadline?: string;
  estimatedHours?: number;
}

export interface UpdateServiceRequestData {
  status?: 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  description?: string;
  deadline?: string;
  estimatedHours?: number;
}

const serviceRequestService = {
  // Create service request
  createRequest: async (data: CreateServiceRequestData) => {
    const response = await api.post('/service-requests', data);
    return response.data;
  },

  // Get all service requests (filtered by role)
  getRequests: async (params: { status?: string; page?: number; limit?: number } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const response = await api.get(`/service-requests?${queryParams.toString()}`);
    return response.data;
  },

  // Get service request by ID
  getRequestById: async (id: string) => {
    const response = await api.get(`/service-requests/${id}`);
    return response.data;
  },

  // Update service request status (CA)
  updateRequest: async (id: string, data: UpdateServiceRequestData) => {
    const response = await api.put(`/service-requests/${id}`, data);
    return response.data;
  },

  // Accept service request (CA)
  acceptRequest: async (id: string) => {
    const response = await api.put(`/service-requests/${id}/accept`);
    return response.data;
  },

  // Cancel service request
  cancelRequest: async (id: string, reason?: string) => {
    const response = await api.post(`/service-requests/${id}/cancel`, { reason });
    return response.data;
  },

  // Complete service request (CA)
  completeRequest: async (id: string) => {
    const response = await api.put(`/service-requests/${id}/complete`);
    return response.data;
  },

  // Reject service request (CA) - reopens for reassignment
  rejectRequest: async (id: string, reason: string) => {
    const response = await api.post(`/service-requests/${id}/reject`, { reason });
    return response.data;
  },

  // Abandon service request (CA) - after acceptance
  abandonRequest: async (id: string, reason: string, reasonText?: string) => {
    const response = await api.post(`/service-requests/${id}/abandon`, {
      reason,
      reasonText
    });
    return response.data;
  },
};

export default serviceRequestService;
