# Frontend Integration Guide - Security Updates

**Date**: 2026-02-08  
**Purpose**: Guide frontend teams through integrating security enhancements  
**Target**: React/TypeScript frontend developers

---

## 🚨 Breaking Changes - Action Required

This guide covers the **3 breaking changes** introduced by the security hardening work that require frontend updates.

---

## 1. Token Refresh - NEW Refresh Token Rotation (SEC-012)

### What Changed

The `/api/auth/refresh` endpoint now returns **both** a new access token AND a new refresh token. Previously, only the access token was returned.

### Why This Changed

**Security Enhancement**: Token rotation prevents prolonged session compromise. If a refresh token is stolen and reused, all sessions are automatically revoked (security breach detection).

### Old vs New

**❌ Old Response (No longer valid)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc..."
  }
}
```

**✅ New Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "dGhpcyBpc...",  // ← NEW! Must be stored
    "expiresIn": 900
  }
}
```

### Frontend Changes Required

#### Before (Old Code):
```typescript
// ❌ OLD - Don't use this anymore
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  const data = await response.json();
  
  // ❌ Only stored access token
  localStorage.setItem('accessToken', data.data.accessToken);
}
```

#### After (New Code):
```typescript
// ✅ NEW - Use this instead
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  if (!response.ok) {
    // Token refresh failed - logout user
    handleLogout();
    throw new Error('Session expired');
  }
  
  const data = await response.json();
  
  // ✅ Store BOTH tokens
  localStorage.setItem('accessToken', data.data.accessToken);
  localStorage.setItem('refreshToken', data.data.refreshToken); // ← NEW!
  
  return data.data.accessToken;
}
```

#### React Hook Example:
```typescript
import { useState, useEffect } from 'react';

export function useTokenRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    // Refresh token every 14 minutes (before 15min expiry)
    const interval = setInterval(async () => {
      try {
        setIsRefreshing(true);
        await refreshAccessToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Redirect to login
        window.location.href = '/login';
      } finally {
        setIsRefreshing(false);
      }
    }, 14 * 60 * 1000); // 14 minutes
    
    return () => clearInterval(interval);
  }, []);
  
  return { isRefreshing };
}

// Use in App.tsx
function App() {
  const { isRefreshing } = useTokenRefresh();
  
  return (
    <div>
      {isRefreshing && <LoadingIndicator />}
      {/* rest of app */}
    </div>
  );
}
```

#### Axios Interceptor Example:
```typescript
import axios from 'axios';

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Response interceptor for token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return axios(originalRequest);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        
        // ✅ Store both tokens
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken); // ← NEW!
        
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + data.data.accessToken;
        originalRequest.headers['Authorization'] = 'Bearer ' + data.data.accessToken;
        
        processQueue(null, data.data.accessToken);
        return axios(originalRequest);
      } catch (err) {
        processQueue(err, null);
        // Logout user
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);
```

---

## 2. Rate Limiting - Handle 429 Responses (SEC-008)

### What Changed

Login, registration, and password reset endpoints now enforce rate limiting:
- **Login**: 5 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP
- **Password Reset**: Rate limited

After exceeding the limit, the API returns **429 Too Many Requests** with account lockout.

### Frontend Changes Required

#### Before (Old Code):
```typescript
// ❌ OLD - No rate limit handling
async function handleLogin(email: string, password: string) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      setError(data.error); // Generic error
    }
  } catch (error) {
    setError('Login failed');
  }
}
```

#### After (New Code):
```typescript
// ✅ NEW - Handle 429 rate limiting
async function handleLogin(email: string, password: string) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.status === 429) {
      // ✅ Rate limit exceeded
      setError('Too many login attempts. Please try again in 15 minutes.');
      setIsLocked(true);
      
      // Optional: Show countdown timer
      const retryAfter = response.headers.get('Retry-After'); // seconds
      if (retryAfter) {
        startCountdown(parseInt(retryAfter));
      }
      
      return;
    }
    
    if (!response.ok) {
      setError(data.error || 'Invalid credentials');
      return;
    }
    
    // Success - store tokens
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    
  } catch (error) {
    setError('Network error. Please try again.');
  }
}
```

#### React Component Example:
```typescript
import { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsLocked(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isLocked) {
      setError(`Account locked. Try again in ${countdown} seconds.`);
      return;
    }
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        setError('Too many attempts. Please wait.');
        setIsLocked(true);
        startCountdown(parseInt(retryAfter || '900')); // 15 min default
        return;
      }
      
      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      
      // Success
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      window.location.href = '/dashboard';
      
    } catch (error) {
      setError('Network error');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        disabled={isLocked}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        disabled={isLocked}
      />
      
      {error && (
        <div className="error">
          {error}
          {isLocked && countdown > 0 && (
            <span> ({Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')} remaining)</span>
          )}
        </div>
      )}
      
      <button type="submit" disabled={isLocked}>
        {isLocked ? `Locked (${countdown}s)` : 'Login'}
      </button>
    </form>
  );
}
```

---

## 3. Password Policy - Updated Validation (SEC-011)

### What Changed

Password requirements have been strengthened:

| Requirement | Old | New |
|-------------|-----|-----|
| **Min Length** | 8 characters | 12 characters |
| **Entropy** | Not checked | 40 bits minimum |
| **Common Passwords** | Not blocked | 30+ patterns blocked |
| **Keyboard Patterns** | Not blocked | qwerty, 12345, etc. blocked |
| **Repeated Characters** | Not checked | Excessive repetition blocked |

### Frontend Changes Required

#### Before (Old Validation):
```typescript
// ❌ OLD - Weak validation
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain uppercase letter';
  }
  
  if (!/[a-z]/.test(password)) {
    return 'Password must contain lowercase letter';
  }
  
  if (!/[0-9]/.test(password)) {
    return 'Password must contain number';
  }
  
  if (!/[!@#$%^&*]/.test(password)) {
    return 'Password must contain special character';
  }
  
  return null; // Valid
}
```

#### After (New Validation):
```typescript
// ✅ NEW - Call backend for validation
async function validatePassword(password: string): Promise<{
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number;
}> {
  // Frontend quick checks
  if (password.length < 12) {
    return {
      valid: false,
      errors: ['Password must be at least 12 characters'],
      strength: 'weak',
      score: 0
    };
  }
  
  // Call backend for full validation
  const response = await fetch('/api/auth/password-strength', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  
  const data = await response.json();
  
  return {
    valid: data.data.policyValid,
    errors: data.data.policyErrors || [],
    strength: data.data.strength,
    score: data.data.score
  };
}
```

#### React Component Example:
```typescript
import { useState, useEffect } from 'react';

export function PasswordInput({ onChange }: { onChange: (value: string) => void }) {
  const [password, setPassword] = useState('');
  const [validation, setValidation] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  
  useEffect(() => {
    if (password.length === 0) {
      setValidation(null);
      return;
    }
    
    // Debounce validation
    const timer = setTimeout(async () => {
      setIsChecking(true);
      const result = await validatePassword(password);
      setValidation(result);
      setIsChecking(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [password]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    onChange(value);
  };
  
  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak': return 'red';
      case 'fair': return 'orange';
      case 'good': return 'yellow';
      case 'strong': return 'green';
      default: return 'gray';
    }
  };
  
  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={handleChange}
        placeholder="Password (min 12 characters)"
      />
      
      {isChecking && <div>Checking password strength...</div>}
      
      {validation && (
        <div>
          <div className="strength-bar">
            <div 
              className="strength-fill"
              style={{
                width: `${validation.score}%`,
                backgroundColor: getStrengthColor(validation.strength)
              }}
            />
          </div>
          
          <div className={`strength-text ${getStrengthColor(validation.strength)}`}>
            {validation.strength.toUpperCase()}
          </div>
          
          {validation.errors.length > 0 && (
            <ul className="errors">
              {validation.errors.map((error: string, i: number) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}
          
          {validation.feedback && (
            <div className="feedback">{validation.feedback}</div>
          )}
        </div>
      )}
    </div>
  );
}
```

#### Registration Form Example:
```typescript
export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordValid, setPasswordValid] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate password before submitting
    const validation = await validatePassword(password);
    
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: '...',
          phone: '...',
          role: 'CLIENT'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      
      // Success
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      window.location.href = '/dashboard';
      
    } catch (error) {
      setError('Network error');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      
      <PasswordInput
        onChange={(value) => {
          setPassword(value);
          // You can also track validity
        }}
      />
      
      {error && <div className="error">{error}</div>}
      
      <button type="submit" disabled={!passwordValid}>
        Register
      </button>
    </form>
  );
}
```

---

## 4. CSRF Protection (Optional - SEC-013)

### When to Use

CSRF protection is **optional** for JWT-based APIs. You only need this if:
- Using cookie-based authentication (not recommended)
- Implementing defense-in-depth
- Regulatory compliance requires it

**Note**: Since this API uses Bearer tokens, CSRF protection is automatically bypassed by the backend. Implement only if specifically required.

### Implementation (If Needed)

```typescript
// Get CSRF token on app load
async function getCsrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf-token');
  const data = await response.json();
  return data.data.csrfToken;
}

// Store CSRF token
let csrfToken: string | null = null;

// Initialize on app load
useEffect(() => {
  getCsrfToken().then(token => {
    csrfToken = token;
  });
}, []);

// Include in requests
async function makeRequest(url: string, options: RequestInit) {
  const headers = {
    ...options.headers,
    'x-csrf-token': csrfToken || '',
  };
  
  return fetch(url, { ...options, headers });
}
```

---

## 📋 Migration Checklist

### Immediate (Before Deployment)
- [ ] Update token refresh logic to store both tokens
- [ ] Add 429 rate limit handling to login form
- [ ] Update password validation UI with new requirements
- [ ] Test token refresh auto-renewal
- [ ] Test rate limit lockout UI

### Testing
- [ ] Test token refresh every 14 minutes works
- [ ] Test 6th login attempt shows lockout message
- [ ] Test weak passwords are rejected
- [ ] Test network errors are handled gracefully
- [ ] Test session expiry redirects to login

### Optional
- [ ] Implement CSRF protection (if using cookies)
- [ ] Add countdown timer for rate limits
- [ ] Add password strength meter
- [ ] Add "forgot password" rate limit handling

---

## 🔗 API Reference

### Authentication Endpoints

**POST /api/auth/login**
- Rate limit: 5 attempts / 15 min
- Response: `{ accessToken, refreshToken, user }`
- 429 on rate limit exceeded

**POST /api/auth/register**
- Rate limit: 3 attempts / 60 min
- Password: min 12 chars, entropy check
- Response: `{ accessToken, refreshToken, user }`

**POST /api/auth/refresh**
- No rate limit
- Returns: NEW access token AND NEW refresh token
- ⚠️ BREAKING: Now returns both tokens

**POST /api/auth/password-strength**
- No authentication required
- Request: `{ password: string }`
- Response: `{ strength, score, feedback, policyValid, policyErrors }`

**GET /api/auth/csrf-token** (optional)
- Returns CSRF token if needed
- Not required for Bearer token auth

---

## ❓ FAQ

### Q: Do I need to change all API calls?
**A**: No. Only the `/auth/refresh` endpoint response changed. All other endpoints work the same.

### Q: What happens if I don't update token refresh?
**A**: Old refresh tokens will stop working after one refresh. Users will be logged out unexpectedly.

### Q: Can I disable rate limiting for testing?
**A**: Yes, set `NODE_ENV=test` in backend. Never disable in production.

### Q: Why 12-character minimum password?
**A**: Industry standard for strong passwords. Provides ~70 bits of entropy with mixed characters.

### Q: Do I need CSRF tokens?
**A**: No, not for JWT Bearer token authentication. It's optional for defense-in-depth.

### Q: How do I test rate limiting locally?
**A**: Make 6 login attempts with wrong password. 6th attempt should return 429.

---

## 🆘 Support

If you encounter issues:

1. Check browser console for errors
2. Check network tab for API responses
3. Verify tokens are being stored correctly
4. Test with fresh browser session (clear storage)
5. Check backend logs for security events

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-08  
**Maintained By**: Backend Security Team  
**Contact**: [Your team contact info]
