import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword?: string; // For form validation only
  name: string;
  role: 'CLIENT' | 'CA';
  phone?: string;

  // CA-specific fields
  caLicenseNumber?: string;
  specialization?: string[];
  experienceYears?: number;
  qualifications?: string[];
  hourlyRate?: number;
  description?: string;
  languages?: string[];

  // Client-specific fields
  companyName?: string;
  address?: string;
  taxNumber?: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: {
      userId: string;
      email: string;
      role: 'CLIENT' | 'CA' | 'ADMIN';
      name: string;
      phone?: string;
      profileImage?: string;
    };
    token: string;
  };
  message: string;
}

export interface RegisterResponse {
  success: boolean;
  data: {
    user: any;
    token: string;
  };
  message: string;
}

const authService = {
  // Login
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // Register
  register: async (data: RegisterData): Promise<RegisterResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export default authService;
