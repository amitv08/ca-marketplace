# Security Features Documentation

This document outlines all security measures implemented in the CA Marketplace backend application.

## Table of Contents

1. [Rate Limiting](#rate-limiting)
2. [Security Headers (Helmet.js)](#security-headers)
3. [Input Validation & Sanitization](#input-validation--sanitization)
4. [JWT Authentication & Session Management](#jwt-authentication--session-management)
5. [Password Security](#password-security)
6. [File Upload Security](#file-upload-security)
7. [Testing](#testing)

---

## Rate Limiting

### Implementation
- **Library**: `express-rate-limit` with Redis store
- **Storage**: Redis (for distributed rate limiting)

### Configured Limits

#### General API Rate Limiter
- **Limit**: 100 requests per 15 minutes per IP
- **Applied to**: All API endpoints
```typescript
import { apiLimiter } from './middleware/rateLimiter';
app.use('/api', apiLimiter);
```

#### Authentication Endpoints
- **Limit**: 5 requests per 15 minutes per IP
- **Applied to**: `/api/auth/login`, `/api/auth/register`
- **Feature**: Doesn't count successful requests
```typescript
router.post('/login', authLimiter, checkLoginAttempts, loginValidation, ...);
```

#### Login Attempt Tracking
- **Max Attempts**: 5 failed attempts
- **Lockout Duration**: 15 minutes
- **Features**:
  - Tracks failed login attempts per email
  - Locks account temporarily after max attempts
  - Auto-expires after lockout duration
  - Resets on successful login

**Usage**:
```typescript
import { loginAttemptTracker, checkLoginAttempts } from './middleware/rateLimiter';

// Check if account is locked
const isLocked = await loginAttemptTracker.isLocked('user@example.com');

// Record failed attempt
await loginAttemptTracker.recordFailedAttempt('user@example.com');

// Reset attempts on success
await loginAttemptTracker.resetAttempts('user@example.com');
```

#### Payment Endpoints
- **Limit**: 10 requests per hour per IP
- **Applied to**: `/api/payments/*`

#### File Upload
- **Limit**: 20 uploads per hour per IP
- **Applied to**: File upload endpoints

---

## Security Headers

### Helmet.js Configuration

All security headers are automatically applied via Helmet.js middleware.

#### Content Security Policy (CSP)
```javascript
{
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: ["'self'", "https://api.razorpay.com"],
  frameSrc: ["'self'", "https://api.razorpay.com"],
}
```

#### HTTP Strict Transport Security (HSTS)
- **Max Age**: 1 year
- **Include Subdomains**: Yes
- **Preload**: Yes

#### Other Headers
- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff (prevents MIME sniffing)
- **X-XSS-Protection**: 1; mode=block
- **Referrer-Policy**: strict-origin-when-cross-origin
- **X-Powered-By**: Removed (hides technology stack)

### Custom Security Middleware

```typescript
import {
  securityHeaders,
  customSecurityHeaders,
  sanitizeInput
} from './middleware/security';

app.use(securityHeaders);
app.use(customSecurityHeaders);
app.use(sanitizeInput);
```

---

## Input Validation & Sanitization

### Express-Validator Integration

All API endpoints use express-validator for comprehensive input validation.

#### Password Policy Validation
```typescript
const passwordPolicy = () =>
  body('password')
    .isLength({ min: 12 })
    .matches(/[A-Z]/)
    .matches(/[a-z]/)
    .matches(/[0-9]/)
    .matches(/[!@#$%^&*(),.?":{}|<>]/);
```

#### Example Validations

**Registration**:
```typescript
import { registerValidation } from './middleware/validation';

router.post('/register', registerValidation, async (req, res) => {
  // Request is validated
});
```

**Service Request**:
```typescript
import { createServiceRequestValidation } from './middleware/validation';

router.post('/service-requests', createServiceRequestValidation, ...);
```

### Input Sanitization

Automatically sanitizes all incoming data:
- Removes `<script>` tags
- Prevents XSS attacks
- Removes potentially dangerous characters
- Prevents parameter pollution

```typescript
import { sanitizeInput } from './middleware/security';
app.use(sanitizeInput);
```

---

## JWT Authentication & Session Management

### Token Types

#### Access Token
- **Lifetime**: 15 minutes
- **Purpose**: API authentication
- **Storage**: Client localStorage/memory
- **Secret**: `JWT_SECRET`

#### Refresh Token
- **Lifetime**: 7 days
- **Purpose**: Renew access tokens
- **Storage**: HttpOnly cookie (recommended) or localStorage
- **Secret**: `JWT_REFRESH_SECRET`

### Token Service

```typescript
import { TokenService } from './services/token.service';

// Generate token pair
const { accessToken, refreshToken } = TokenService.generateTokenPair({
  userId: user.id,
  email: user.email,
  role: user.role,
});

// Verify access token
const payload = await TokenService.verifyAccessToken(token);

// Refresh access token
const newAccessToken = await TokenService.refreshAccessToken(refreshToken);

// Blacklist token (logout)
await TokenService.blacklistToken(token);

// Revoke all user tokens
await TokenService.blacklistAllUserTokens(userId);
```

### Token Blacklisting

- **Storage**: Redis
- **TTL**: Matches token expiration
- **Use Cases**:
  - User logout
  - Password change
  - Account deletion
  - Security breach

### Authentication Flow

```
1. User logs in → Receives access + refresh tokens
2. Client stores tokens securely
3. Client sends access token with each request
4. Access token expires (15 min) → Use refresh token to get new access token
5. Refresh token expires (7 days) → User must login again
```

### Secure Cookies Configuration

```typescript
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,     // Not accessible via JavaScript
  secure: true,       // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

---

## Password Security

### Password Policy

#### Requirements
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*(),.?":{}|<>)
- No common patterns (123, abc, password, qwerty)
- No repeated characters (4+ times)
- Maximum 128 characters (prevent DOS)

### Password Service

```typescript
import { PasswordService } from './services/password.service';

// Validate password policy
const { valid, errors } = PasswordService.validatePasswordPolicy(password);

// Calculate password strength
const strength = PasswordService.calculatePasswordStrength(password);
// Returns: { score: 85, strength: 'strong', feedback: [] }

// Hash password (bcrypt with 12 rounds)
const hash = await PasswordService.hashPassword(password);

// Verify password
const isMatch = await PasswordService.comparePassword(password, hash);

// Check password reuse
const isReused = await PasswordService.isPasswordReused(userId, password);

// Change password with validation
const result = await PasswordService.changePassword(
  userId,
  currentPassword,
  newPassword
);
```

### Password History

- **Limit**: Cannot reuse last 5 passwords
- **Storage**: Database (`PasswordHistory` model)
- **Cleanup**: Automatically removes passwords beyond limit

### Password Strength Meter

**Score Ranges**:
- 0-29: Weak
- 30-49: Fair
- 50-69: Good
- 70-84: Strong
- 85-100: Very Strong

**API Endpoint**:
```bash
POST /api/auth/password-strength
{
  "password": "TestP@ssw0rd123"
}

Response:
{
  "strength": "strong",
  "score": 85,
  "feedback": [],
  "policyValid": true,
  "policyErrors": []
}
```

---

## File Upload Security

### Allowed File Types

#### Images
- MIME Types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Max Size: 5MB

#### Documents
- MIME Types: `application/pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `text/plain`
- Extensions: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.txt`
- Max Size: 10MB

### Security Features

#### 1. File Type Validation
- MIME type verification
- File extension checking
- Magic number (file signature) validation

```typescript
// Magic numbers for validation
const FILE_SIGNATURES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};
```

#### 2. Filename Sanitization
- Removes path separators
- Removes special characters
- Prevents directory traversal
- Limits filename length

#### 3. Malware Detection
- Checks file signatures
- Scans for null bytes
- Detects suspicious patterns
- Validates file size

#### 4. Upload Middleware

```typescript
import {
  imageUpload,
  documentUpload,
  profileImageUpload,
  validateUploadedFiles,
} from './middleware/fileUpload';

// Multiple images
router.post('/upload/images',
  imageUpload,              // Multer middleware
  validateUploadedFiles,    // Post-upload validation
  async (req, res) => {
    // req.files contains validated files
  }
);

// Single profile image
router.post('/upload/profile',
  profileImageUpload,
  validateUploadedFiles,
  async (req, res) => {
    // req.file contains validated file
  }
);
```

#### 5. Security Checks

**Rejected Files**:
- Executable files (.exe, .bat, .sh, .php)
- Files with null bytes
- Files with suspicious patterns
- Oversized files
- Files with invalid magic numbers

---

## Testing

### Test Coverage

Run tests with coverage:
```bash
npm test
```

### Test Files

1. **password.service.test.ts**: Password policy, hashing, history
2. **token.service.test.ts**: Token generation, verification, blacklisting
3. **validation.test.ts**: Input validation for all endpoints

### Example Test

```typescript
describe('PasswordService', () => {
  it('should reject password without special characters', () => {
    const password = 'NoSpecialChars123';
    const result = PasswordService.validatePasswordPolicy(password);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least one special character'
    );
  });
});
```

---

## Environment Variables

### Required Security Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_REFRESH_EXPIRES_IN=7d

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# CORS
CORS_ORIGIN=https://yourdomain.com

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_secret
```

---

## Security Best Practices

### 1. Secrets Management
- Never commit secrets to git
- Use environment variables
- Rotate secrets regularly
- Use strong, random secrets

### 2. HTTPS Only
- Use HTTPS in production
- Enable HSTS
- Redirect HTTP to HTTPS

### 3. Rate Limiting
- Implement on all endpoints
- Use Redis for distributed systems
- Monitor for attacks

### 4. Regular Updates
- Update dependencies monthly
- Apply security patches immediately
- Monitor vulnerability databases

### 5. Logging & Monitoring
- Log security events
- Monitor failed login attempts
- Set up alerts for suspicious activity
- Review logs regularly

### 6. Database Security
- Use parameterized queries (Prisma does this)
- Encrypt sensitive data at rest
- Regular backups
- Principle of least privilege

---

## Security Checklist

- [x] Rate limiting implemented
- [x] Security headers configured (Helmet.js)
- [x] Input validation on all endpoints
- [x] Password policy enforced
- [x] Password history tracking
- [x] JWT with short expiry
- [x] Refresh token mechanism
- [x] Token blacklisting
- [x] File upload validation
- [x] Magic number verification
- [x] CORS configured
- [x] SQL injection prevention (Prisma)
- [x] XSS protection
- [x] CSRF protection (sameSite cookies)
- [x] Login attempt tracking
- [x] Comprehensive test coverage

---

## Security Incident Response

### If a Security Breach Occurs:

1. **Immediate Actions**:
   ```typescript
   // Revoke all user tokens
   await TokenService.blacklistAllUserTokens(userId);

   // Force password change
   await prisma.user.update({
     where: { id: userId },
     data: { passwordChangeRequired: true }
   });
   ```

2. **Investigation**:
   - Check logs for suspicious activity
   - Review rate limit violations
   - Check failed login attempts

3. **Notification**:
   - Notify affected users
   - Document the incident
   - Report to authorities if required

4. **Prevention**:
   - Rotate all secrets
   - Update dependencies
   - Review and improve security measures

---

## Support

For security issues or questions:
- Email: security@yourdomain.com
- Create a GitHub issue (for non-sensitive issues)
- Review documentation: https://docs.yourdomain.com/security

## License

All security implementations follow industry best practices and are compliant with OWASP guidelines.
