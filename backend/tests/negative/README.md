# Negative Test Scenarios

Comprehensive negative test suite for the CA Marketplace application covering authentication, payments, data integrity, business logic, and race conditions.

## Overview

This directory contains automated negative tests that validate the application's security, data integrity, and business logic by testing failure scenarios and edge cases.

## Test Categories

### 1. Authentication Tests (`auth-negative.test.ts`)

Tests authentication security with negative scenarios:

- **Account Lockout**: Login with incorrect password 6 times → Account lock
- **JWT Token Tampering**: Token manipulation and signature verification
- **Unauthorized Access**: Access protected routes without valid tokens
- **Token Reuse**: Refresh token reuse after logout and replay attack prevention

**Key Scenarios:**
- ✅ Account locks after 5 failed login attempts
- ✅ Lockout duration enforced (30 minutes)
- ✅ Token tampering detection and rejection
- ✅ Expired token rejection
- ✅ Malformed token handling
- ✅ Missing token claims validation
- ✅ Refresh token rotation and reuse detection
- ✅ Token theft detection and mitigation

### 2. Payment Tests (`payment-negative.test.ts`)

Tests payment security and integrity:

- **Invalid Payment Creation**: Negative/zero amounts, excessive amounts, non-existent requests
- **Double Payment Prevention**: Concurrent and duplicate payment attempts
- **Signature Tampering**: Razorpay signature validation and manipulation detection
- **Webhook Security**: Webhook signature verification and payload tampering
- **Access Control**: Payment access restrictions by role
- **Amount Manipulation**: Platform fee validation and consistency checks
- **State Consistency**: Concurrent payment creation prevention

**Key Scenarios:**
- ✅ Reject negative, zero, or excessively large payment amounts
- ✅ Prevent duplicate payments for same service request
- ✅ Detect and reject tampered payment signatures
- ✅ Validate webhook signatures and prevent payload manipulation
- ✅ Enforce payment access control by client/CA/admin roles
- ✅ Verify platform fee calculations (10% commission)
- ✅ Handle concurrent payment attempts safely
- ✅ Prevent payment before CA assignment

### 3. Data Integrity Tests (`data-integrity-negative.test.ts`)

Tests data security and input validation:

- **SQL Injection Prevention**: Test injection in login, search, filters, and user input
- **XSS Prevention**: Test cross-site scripting in messages, reviews, profiles
- **File Upload Security**: Malicious file detection, size limits, MIME validation
- **Input Validation**: Boundary tests for length, format, and special characters
- **Special Character Handling**: Unicode, emojis, special characters
- **JSON Injection**: Nested objects and prototype pollution prevention
- **NoSQL Injection**: Prevention in search and filter queries

**Key Scenarios:**
- ✅ Block SQL injection attempts in all input fields
- ✅ Sanitize XSS payloads in user-generated content
- ✅ Reject files with malicious extensions (.exe, .bat, .sh, .php)
- ✅ Enforce file size limits (prevent 20MB+ uploads)
- ✅ Validate MIME types match file extensions
- ✅ Enforce string length limits (title: 1000 chars, description: 10000 chars)
- ✅ Validate rating range (1-5), hourly rates (positive), experience (non-negative)
- ✅ Handle Unicode characters gracefully
- ✅ Prevent JSON injection and prototype pollution

### 4. Business Logic Tests (`business-logic-negative.test.ts`)

Tests business rule enforcement:

- **Self-Service Violations**: Client accepting own requests, CA self-reviews
- **Payment Release Logic**: Prevent early release, unauthorized access
- **Invalid State Transitions**: Enforce proper workflow states
- **CA Assignment**: Verify unverified CA restrictions, prevent double assignment
- **Message Authorization**: Restrict messaging to involved parties
- **Admin Boundaries**: Enforce admin-only operations
- **Business Rules**: Validate deadlines, estimated hours, payment timing

**Key Scenarios:**
- ✅ Prevent clients from accepting/completing own requests
- ✅ Block CA self-reviews and reviews for incomplete work
- ✅ Enforce state transitions: PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
- ✅ Prevent reactivation of CANCELLED or COMPLETED requests
- ✅ Restrict unverified CAs from accepting requests
- ✅ Prevent CA reassignment of already accepted requests
- ✅ Limit messaging to client-CA pairs involved in same request
- ✅ Enforce admin-only operations (verify CA, release payment, view stats)
- ✅ Validate deadlines are in the future
- ✅ Prevent payment before service request acceptance

### 5. Race Condition Tests (`race-condition-negative.test.ts`)

Tests concurrency and race condition handling:

- **Availability Double-Booking**: Prevent simultaneous slot bookings
- **Concurrent Request Acceptance**: Multiple CAs accepting same request
- **Concurrent Payments**: Duplicate payment creation prevention
- **Concurrent Reviews**: Prevent duplicate review submission
- **Parallel State Transitions**: Handle simultaneous status updates
- **Resource Locking**: Profile updates, payment releases
- **Message Race Conditions**: Rapid message sending and read status updates
- **Transaction Isolation**: Data consistency under concurrent operations

**Key Scenarios:**
- ✅ Allow only one booking per availability slot (test 2+ simultaneous attempts)
- ✅ Assign service request to only one CA (test concurrent acceptances)
- ✅ Create only one payment per request (test 5 rapid attempts)
- ✅ Allow only one review per service request
- ✅ Handle concurrent state changes consistently (accept vs cancel)
- ✅ Maintain profile consistency under concurrent updates
- ✅ Prevent duplicate payment releases
- ✅ Handle 10 rapid message sends gracefully
- ✅ Ensure unique IDs for concurrent resource creation

## Running the Tests

### Run All Negative Tests

```bash
cd backend
npm test -- tests/negative
```

### Run Specific Test Suites

```bash
# Authentication tests
npm test -- tests/negative/auth-negative.test.ts

# Payment tests
npm test -- tests/negative/payment-negative.test.ts

# Data integrity tests
npm test -- tests/negative/data-integrity-negative.test.ts

# Business logic tests
npm test -- tests/negative/business-logic-negative.test.ts

# Race condition tests
npm test -- tests/negative/race-condition-negative.test.ts
```

### Run with Coverage

```bash
npm test -- --coverage tests/negative
```

### Run in Watch Mode

```bash
npm test -- --watch tests/negative
```

### Run in Docker

```bash
# Inside backend container
docker exec -it ca_backend sh
npm test -- tests/negative

# Or from host
docker-compose exec backend npm test -- tests/negative
```

## Test Configuration

### Environment Variables

Tests use environment variables from `backend/.env.test`:

```env
NODE_ENV=test
DATABASE_URL=postgresql://user:pass@localhost:5432/ca_test
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/ca_test
JWT_SECRET=test-jwt-secret-key-for-testing
JWT_REFRESH_SECRET=test-jwt-refresh-secret-key-for-testing
RAZORPAY_KEY_SECRET=test-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=test-webhook-secret
```

### Test Database

- Tests use a separate test database
- Database is cleared before each test suite (`beforeAll`)
- Database is seeded with fixtures for consistent testing
- Database is cleaned up after tests (`afterAll`)

## Test Fixtures

Test data is defined in:

- `tests/fixtures/users.fixture.ts` - Test users (admin, CAs, clients)
- `tests/fixtures/cas.fixture.ts` - CA profiles and availability
- `tests/fixtures/requests.fixture.ts` - Service requests, payments, reviews

## Expected Failures

All tests in this suite expect operations to **fail** with appropriate error responses:

- `400` - Bad Request (validation errors, business rule violations)
- `401` - Unauthorized (missing/invalid authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (non-existent resources)
- `413` - Payload Too Large (file size limits)
- `415` - Unsupported Media Type (invalid file types)
- `423` - Locked (account lockout)
- `429` - Too Many Requests (rate limiting)

## Security Testing Coverage

### OWASP Top 10 Coverage

1. **Injection** ✅
   - SQL injection prevention
   - NoSQL injection prevention
   - Command injection prevention

2. **Broken Authentication** ✅
   - Account lockout mechanisms
   - Token security and rotation
   - Session management

3. **Sensitive Data Exposure** ✅
   - Payment data protection
   - Access control enforcement
   - PII handling

4. **XML External Entities (XXE)** N/A
   - Application uses JSON, not XML

5. **Broken Access Control** ✅
   - Role-based access enforcement
   - Resource ownership validation
   - Admin privilege restrictions

6. **Security Misconfiguration** ✅
   - Input validation
   - Error handling without information leakage

7. **Cross-Site Scripting (XSS)** ✅
   - Input sanitization
   - Output encoding

8. **Insecure Deserialization** ✅
   - JSON injection prevention
   - Prototype pollution prevention

9. **Using Components with Known Vulnerabilities** ⚠️
   - Dependency auditing (separate process)

10. **Insufficient Logging & Monitoring** ⚠️
    - Audit logging (separate tests)

## Performance Considerations

### Test Execution Time

- Full negative test suite: ~2-5 minutes
- Individual test suites: ~30-60 seconds each
- Race condition tests may take longer due to concurrent operations

### Optimization Tips

1. Run tests in parallel when possible
2. Use test database optimization (smaller dataset)
3. Mock external services (Razorpay) where appropriate
4. Use connection pooling for database tests

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Negative Tests
  run: |
    cd backend
    npm test -- tests/negative --coverage --maxWorkers=2
```

## Maintenance

### Adding New Negative Tests

1. Identify the failure scenario to test
2. Choose appropriate test file or create new one
3. Write test with clear description
4. Verify expected failure status codes
5. Ensure database cleanup after test
6. Update this README with new scenarios

### Test Naming Convention

```typescript
describe('Category - Subcategory', () => {
  it('should reject/prevent/block [action] when [condition]', async () => {
    // Test implementation
  });
});
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase Jest timeout: `jest.setTimeout(30000)`
   - Check database connection
   - Verify Docker services are running

2. **Database connection errors**
   - Ensure test database exists
   - Run migrations: `npx prisma migrate deploy`
   - Check DATABASE_URL in .env.test

3. **Fixture data issues**
   - Clear database: `npm run test:db:reset`
   - Verify fixture files are correct
   - Check seed functions in database.utils.ts

4. **Race condition test failures**
   - These tests are inherently non-deterministic
   - May need retry logic or adjusted timing
   - Verify database supports proper locking

### Debug Mode

Run tests with debug output:

```bash
DEBUG=* npm test -- tests/negative
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Assertions**: Use descriptive expect messages
3. **Error Messages**: Verify error messages are user-friendly
4. **Status Codes**: Always check HTTP status codes
5. **Database State**: Verify database state after operations
6. **Cleanup**: Always clean up test data
7. **Documentation**: Update README when adding tests

## Security Reporting

If you discover a security vulnerability that these tests don't cover:

1. Do NOT create a public GitHub issue
2. Contact the security team
3. Provide detailed reproduction steps
4. Suggest a test case to cover the vulnerability

## References

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)

---

**Last Updated**: 2026-01-16
**Test Coverage**: 4 test suites, 100+ test cases
**Maintained By**: Development Team
