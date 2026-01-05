import api from './api';

export interface CAFilters {
  specialization?: string;
  minExperience?: number;
  maxHourlyRate?: number;
  language?: string;
  verificationStatus?: 'VERIFIED';
  page?: number;
  limit?: number;
}

const caService = {
  // Get all CAs with filters
  getCAs: async (filters: CAFilters = {}) => {
    const params = new URLSearchParams();

    if (filters.specialization) params.append('specialization', filters.specialization);
    if (filters.minExperience) params.append('minExperience', filters.minExperience.toString());
    if (filters.maxHourlyRate) params.append('maxHourlyRate', filters.maxHourlyRate.toString());
    if (filters.language) params.append('language', filters.language);
    if (filters.verificationStatus) params.append('verificationStatus', filters.verificationStatus);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/cas?${params.toString()}`);
    return response.data;
  },

  // Get CA by ID
  getCAById: async (id: string) => {
    const response = await api.get(`/cas/${id}`);
    return response.data;
  },

  // Get CA profile (for logged-in CA)
  getMyProfile: async () => {
    const response = await api.get('/cas/profile');
    return response.data;
  },

  // Update CA profile
  updateProfile: async (data: any) => {
    const response = await api.put('/cas/profile', data);
    return response.data;
  },

  // Get CA availability
  getAvailability: async (caId: string) => {
    const response = await api.get(`/cas/${caId}/availability`);
    return response.data;
  },

  // Set availability (for logged-in CA)
  setAvailability: async (data: any) => {
    const response = await api.post('/cas/availability', data);
    return response.data;
  },
};

export default caService;
