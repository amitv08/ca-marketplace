import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ClientProfile {
  id: string;
  userId: string;
  companyName?: string;
  address?: string;
  taxNumber?: string;
  documents?: any;
}

interface CAProfile {
  id: string;
  userId: string;
  caLicenseNumber: string;
  specialization: string[];
  experienceYears: number;
  qualifications: string[];
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  hourlyRate: number;
  description?: string;
  languages: string[];
  availability?: any;
}

interface UserState {
  profile: ClientProfile | CAProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  profile: null,
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    fetchProfileStart: (state: UserState) => {
      state.loading = true;
      state.error = null;
    },
    fetchProfileSuccess: (state: UserState, action: PayloadAction<ClientProfile | CAProfile>) => {
      state.loading = false;
      state.profile = action.payload;
      state.error = null;
    },
    fetchProfileFailure: (state: UserState, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateProfile: (state: UserState, action: PayloadAction<Partial<ClientProfile | CAProfile>>) => {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload };
      }
    },
    clearProfile: (state: UserState) => {
      state.profile = null;
      state.error = null;
    },
  },
});

export const {
  fetchProfileStart,
  fetchProfileSuccess,
  fetchProfileFailure,
  updateProfile,
  clearProfile,
} = userSlice.actions;

export default userSlice.reducer;
