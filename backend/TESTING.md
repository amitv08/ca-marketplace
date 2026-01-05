# Testing Guide - CA Marketplace

Comprehensive testing documentation for the CA Marketplace backend application.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The CA Marketplace employs a comprehensive testing strategy covering:

- **Unit Tests**: Business logic, utility functions, validation
- **Integration Tests**: API endpoints, database operations, authentication flows
- **E2E Tests**: Complete user journeys using Playwright
- **Security Tests**: SQL injection, XSS, authentication bypass, rate limiting
- **Performance Tests**: Load testing, stress testing using k6

### Test Coverage Goals

- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical user flows (registration, service requests, payments)
- **Security Tests**: OWASP Top 10 vulnerabilities
- **Performance Tests**: 100+ concurrent users handling

## Test Types

### 1. Unit Tests

**Location**: `tests/unit/`

**Purpose**: Test individual functions and business logic in isolation

**Tools**: Jest, TypeScript

**Examples**:
- Helper functions (`parsePaginationParams`, `calculateAverageRating`)
- Password hashing and comparison
- Data transformation utilities

**Run**: `npm run test:unit`

### 2. Integration Tests

**Location**: `tests/integration/`

**Purpose**: Test API endpoints with real database interactions

**Tools**: Jest, SuperTest, Prisma

**Examples**:
- Authentication API (`auth.test.ts`)
- Service Requests API (`service-requests.test.ts`)
- Payments API
- Messaging system

**Run**: `npm run test:integration`

### 3. E2E Tests

**Location**: `tests/e2e/`

**Purpose**: Test complete user flows in a browser environment

**Tools**: Playwright

**Examples**:
- User registration flow
- Service request creation
- CA profile setup
- Payment processing

**Run**: `npm run test:e2e`

### 4. Security Tests

**Location**: `tests/security/`

**Purpose**: Test for common security vulnerabilities

**Tools**: Jest, SuperTest

**Tests**:
- SQL Injection attempts
- XSS payload testing
- Authentication bypass attempts
- Rate limiting validation
- CSRF protection
- Command injection prevention

**Run**: `npm run test:security`

### 5. Performance Tests

**Location**: `tests/performance/`

**Purpose**: Test system performance under load

**Tools**: k6

**Scenarios**:
- **Load Test**: Normal traffic (100 concurrent users)
- **Stress Test**: Maximum capacity (500+ users)
- **API Performance**: Endpoint-specific benchmarks

**Run**:
```bash
npm run test:perf          # Load test
npm run test:perf:stress   # Stress test
npm run test:perf:api      # API performance
```

## Setup

### Prerequisites

1. **Node.js 20+**
2. **PostgreSQL 15+**
3. **Redis 7+**
4. **k6** (for performance tests)

### Installation

```bash
cd backend

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Setup test database
cp .env.example .env.test
```

### Test Database Configuration

Create `.env.test`:

```env
DATABASE_URL="postgresql://test:test@localhost:5432/ca_marketplace_test"
REDIS_URL="redis://localhost:6379/1"
NODE_ENV="test"
JWT_SECRET="test-jwt-secret-key-for-testing"
```

### Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npx prisma migrate deploy --schema prisma/schema.prisma
```

## Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run specific test type
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:security      # Security tests only
npm run test:e2e          # E2E tests only

# Run all automated tests (no E2E)
npm run test:all

# Watch mode (for development)
npm run test:watch

# CI mode
npm run test:ci
```

### E2E Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# View HTML report
npm run test:e2e:report

# Run specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Performance Test Commands

```bash
# Basic load test (100 concurrent users)
npm run test:perf

# Stress test (up to 500 users)
npm run test:perf:stress

# API-specific performance test
npm run test:perf:api

# Custom k6 run
k6 run tests/performance/load-test.js --vus 50 --duration 2m
```

### Coverage Reports

```bash
# Generate coverage
npm test -- --coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/helpers.test.ts
import { calculateAverageRating } from '../../src/utils/helpers';

describe('calculateAverageRating', () => {
  it('should calculate average rating correctly', () => {
    const ratings = [4, 5, 3, 5, 4];
    const avg = calculateAverageRating(ratings);
    expect(avg).toBe(4.2);
  });

  it('should return 0 for empty array', () => {
    const avg = calculateAverageRating([]);
    expect(avg).toBe(0);
  });
});
```

### Integration Test Example

```typescript
// tests/integration/auth.test.ts
import request from 'supertest';
import { app } from '../../src/server';

describe('POST /api/auth/login', () => {
  it('should login successfully with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@test.com',
        password: 'ValidPassword@123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### E2E Test Example

```typescript
// tests/e2e/registration.spec.ts
import { test, expect } from '@playwright/test';

test('should register new client', async ({ page }) => {
  await page.goto('/register');
  await page.fill('input[name="email"]', 'newuser@test.com');
  await page.fill('input[name="password"]', 'ValidPass@123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
});
```

### Security Test Example

```typescript
// tests/security/injection.test.ts
const sqlInjectionPayloads = ["' OR '1'='1", "'; DROP TABLE users--"];

for (const payload of sqlInjectionPayloads) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: payload,
      password: 'password',
    });

  expect(response.status).not.toBe(200);
}
```

### Performance Test Example

```javascript
// tests/performance/custom-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '5m',
};

export default function () {
  const res = http.get('http://localhost:3000/api/cas');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## Test Fixtures and Utilities

### Using Test Fixtures

```typescript
import { testUsers } from '../fixtures/users.fixture';
import { testCAs } from '../fixtures/cas.fixture';
import { testServiceRequests } from '../fixtures/requests.fixture';

// Access predefined test data
const client = testUsers.client1;
const ca = testCAs.ca1;
```

### Using Auth Utilities

```typescript
import { testAuthHeaders } from '../utils/auth.utils';

// Get auth headers for testing
const response = await request(app)
  .get('/api/service-requests')
  .set(testAuthHeaders.client1());
```

### Using Database Utilities

```typescript
import { clearDatabase, seedDatabase } from '../utils/database.utils';

beforeAll(async () => {
  await clearDatabase();
  await seedDatabase();
});
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Workflow**: `.github/workflows/test.yml`

### Test Pipeline Stages

1. **Unit Tests** - Fast feedback (1-2 min)
2. **Integration Tests** - API validation (3-5 min)
3. **Security Tests** - Vulnerability scanning (2-3 min)
4. **E2E Tests** - Full flow validation (5-10 min)
5. **Code Quality** - Linting, type checking

### Required Status Checks

Before merging:
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Security tests pass
- ✅ E2E tests pass
- ✅ Code coverage > 70%

## Best Practices

### General

1. **Arrange-Act-Assert Pattern**
   ```typescript
   it('should create user', async () => {
     // Arrange
     const userData = { name: 'Test', email: 'test@test.com' };

     // Act
     const user = await createUser(userData);

     // Assert
     expect(user.email).toBe('test@test.com');
   });
   ```

2. **Test Naming**
   - Use descriptive names: `should create user successfully`
   - Follow pattern: `should [expected behavior] when [condition]`

3. **Test Isolation**
   - Each test should be independent
   - Clean up database between tests
   - Don't rely on test execution order

4. **Mock External Services**
   - Mock third-party APIs
   - Mock email services
   - Mock payment gateways

### Unit Tests

- Test pure functions
- Mock dependencies
- Test edge cases
- Keep tests fast (<50ms)

### Integration Tests

- Use real database (test instance)
- Test complete request-response cycle
- Verify database state changes
- Clean up after each test

### E2E Tests

- Test critical user paths
- Use stable selectors
- Handle async operations properly
- Take screenshots on failure
- Keep tests focused (one flow per test)

### Security Tests

- Test all input points
- Cover OWASP Top 10
- Test rate limiting
- Verify authentication
- Check authorization rules

### Performance Tests

- Establish baseline metrics
- Test under realistic load
- Monitor resource usage
- Document performance targets

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check PostgreSQL is running
pg_isready

# Reset test database
npx prisma migrate reset --force

# Regenerate Prisma client
npm run prisma:generate
```

#### Redis Connection Errors

```bash
# Check Redis is running
redis-cli ping

# Start Redis
redis-server
```

#### Test Timeouts

```bash
# Increase timeout in jest.config.js
testTimeout: 30000

# Or per-test
jest.setTimeout(30000);
```

#### Playwright Errors

```bash
# Reinstall browsers
npx playwright install --force

# Clear cache
npx playwright uninstall --all
npx playwright install
```

#### Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)
```

### Debugging Tests

#### Debug Jest Tests

```bash
# VS Code launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

#### Debug Playwright Tests

```bash
# Debug mode
npm run test:e2e:debug

# Headed mode (see browser)
npx playwright test --headed

# Specific test
npx playwright test user-registration.spec.ts --debug
```

#### Debug k6 Tests

```bash
# Verbose output
k6 run tests/performance/load-test.js --verbose

# Single VU for debugging
k6 run tests/performance/load-test.js --vus 1 --duration 10s
```

## Test Metrics

### Target Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Code Coverage | >70% | TBD |
| Unit Test Speed | <5s | TBD |
| Integration Test Speed | <30s | TBD |
| E2E Test Speed | <5min | TBD |
| API Response Time (P95) | <500ms | TBD |
| API Response Time (P99) | <1000ms | TBD |
| Load Test (100 users) | <1% error | TBD |

### Monitoring

```bash
# View coverage
npm test -- --coverage

# View performance metrics
k6 run tests/performance/api-performance.js

# View E2E report
npm run test:e2e:report
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [k6 Documentation](https://k6.io/docs/)
- [SuperTest Documentation](https://github.com/visionmedia/supertest)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

## Contributing

When adding new features:

1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain code coverage
4. Add E2E tests for user-facing features
5. Document new test utilities

## Support

For issues or questions:
- Create an issue on GitHub
- Check existing tests for examples
- Review this documentation

---

**Last Updated**: 2026-01-05
**Test Framework Versions**: Jest 29.7.0, Playwright 1.40.1, k6 latest
