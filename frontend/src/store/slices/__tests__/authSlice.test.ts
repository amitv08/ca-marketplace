import authReducer, {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  setUser,
  clearError,
  User,
} from '../authSlice';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'CLIENT',
  name: 'Test User',
};

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

describe('authSlice', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should return the initial state', () => {
    const state = authReducer(undefined, { type: '@@INIT' });
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
  });

  describe('loginStart', () => {
    it('sets loading to true and clears error', () => {
      const state = authReducer({ ...initialState, error: 'some error' }, loginStart());
      expect(state.loading).toBe(true);
      expect(state.error).toBe(null);
    });
  });

  describe('loginSuccess', () => {
    it('sets user, token, and isAuthenticated', () => {
      const state = authReducer(
        { ...initialState, loading: true },
        loginSuccess({ user: mockUser, token: 'test-token' })
      );
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('test-token');
      expect(state.error).toBe(null);
    });

    it('stores token and user in localStorage', () => {
      authReducer(
        initialState,
        loginSuccess({ user: mockUser, token: 'test-token' })
      );
      expect(localStorageMock.getItem('token')).toBe('test-token');
      expect(JSON.parse(localStorageMock.getItem('user')!)).toEqual(mockUser);
    });
  });

  describe('loginFailure', () => {
    it('sets error and clears auth state', () => {
      const state = authReducer(
        { ...initialState, loading: true, isAuthenticated: true, user: mockUser, token: 'token' },
        loginFailure('Invalid credentials')
      );
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBe(null);
      expect(state.token).toBe(null);
      expect(state.error).toBe('Invalid credentials');
    });

    it('removes token and user from localStorage', () => {
      localStorageMock.setItem('token', 'old-token');
      localStorageMock.setItem('user', JSON.stringify(mockUser));
      authReducer(initialState, loginFailure('Error'));
      expect(localStorageMock.getItem('token')).toBe(null);
      expect(localStorageMock.getItem('user')).toBe(null);
    });
  });

  describe('logout', () => {
    it('clears all auth state', () => {
      const loggedInState = {
        user: mockUser,
        token: 'test-token',
        isAuthenticated: true,
        loading: false,
        error: null,
      };
      const state = authReducer(loggedInState, logout());
      expect(state.user).toBe(null);
      expect(state.token).toBe(null);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe(null);
    });

    it('removes token and user from localStorage', () => {
      localStorageMock.setItem('token', 'test-token');
      localStorageMock.setItem('user', JSON.stringify(mockUser));
      authReducer(initialState, logout());
      expect(localStorageMock.getItem('token')).toBe(null);
      expect(localStorageMock.getItem('user')).toBe(null);
    });
  });

  describe('setUser', () => {
    it('updates the user in state', () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      const state = authReducer(
        { ...initialState, user: mockUser },
        setUser(updatedUser)
      );
      expect(state.user).toEqual(updatedUser);
    });

    it('stores updated user in localStorage', () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      authReducer(initialState, setUser(updatedUser));
      expect(JSON.parse(localStorageMock.getItem('user')!)).toEqual(updatedUser);
    });
  });

  describe('clearError', () => {
    it('clears the error', () => {
      const state = authReducer(
        { ...initialState, error: 'Some error' },
        clearError()
      );
      expect(state.error).toBe(null);
    });
  });
});
