# Negative Tests - Quick Start Guide

Quick reference for running and understanding the comprehensive negative test suite.

## 🚀 Quick Start

### 1. Setup Test Environment

```bash
# Navigate to backend
cd backend

# Install dependencies (if not already done)
npm install

# Setup test database
createdb ca_marketplace_test

# Run migrations
DATABASE_URL="postgresql://caadmin:CaSecure123!@localhost:5432/ca_marketplace_test" npx prisma migrate deploy
```

### 2. Run All Negative Tests

```bash
npm test -- tests/negative
```

### 3. View Results

Expected output:
```
PASS  tests/negative/auth-negative.test.ts
PASS  tests/negative/payment-negative.test.ts
PASS  tests/negative/data-integrity-negative.test.ts
PASS  tests/negative/business-logic-negative.test.ts
PASS  tests/negative/race-condition-negative.test.ts

Test Suites: 5 passed, 5 total
Tests:       165 passed, 165 total
```

---

## 📂 Test File Overview

| File | Focus Area | Test Cases | Key Scenarios |
|------|-----------|------------|---------------|
| `auth-negative.test.ts` | Authentication Security | 25+ | Account lockout, token tampering, refresh token reuse |
| `payment-negative.test.ts` | Payment Security | 35+ | Double payments, signature tampering, unauthorized access |
| `data-integrity-negative.test.ts` | Input Validation | 45+ | SQL injection, XSS, file uploads, boundary tests |
| `business-logic-negative.test.ts` | Business Rules | 40+ | Self-service violations, invalid state transitions, authorization |
| `race-condition-negative.test.ts` | Concurrency | 20+ | Double-booking, concurrent payments, resource locking |

---

## 🎯 Test by Category

### Run Authentication Tests Only
```bash
npm test -- tests/negative/auth-negative.test.ts
```
**Tests:** Account lockout, JWT tampering, unauthorized access, refresh token security

### Run Payment Tests Only
```bash
npm test -- tests/negative/payment-negative.test.ts
```
**Tests:** Invalid payments, double payments, signature verification, webhook security

### Run Data Integrity Tests Only
```bash
npm test -- tests/negative/data-integrity-negative.test.ts
```
**Tests:** SQL injection, XSS, file uploads, input validation, special characters

### Run Business Logic Tests Only
```bash
npm test -- tests/negative/business-logic-negative.test.ts
```
**Tests:** Self-service violations, invalid state transitions, authorization boundaries

### Run Race Condition Tests Only
```bash
npm test -- tests/negative/race-condition-negative.test.ts
```
**Tests:** Availability double-booking, concurrent requests, resource locking

---

## 🔍 Test Specific Scenarios

### Test Account Lockout (5 failed attempts)
```bash
npm test -- tests/negative/auth-negative.test.ts -t "should lock account after 5 failed"
```

### Test SQL Injection Prevention
```bash
npm test -- tests/negative/data-integrity-negative.test.ts -t "SQL Injection"
```

### Test Payment Signature Tampering
```bash
npm test -- tests/negative/payment-negative.test.ts -t "Payment Signature Tampering"
```

### Test Double-Booking Prevention
```bash
npm test -- tests/negative/race-condition-negative.test.ts -t "Availability Double-Booking"
```

---

## 📊 Run with Coverage

### All Negative Tests with Coverage
```bash
npm test -- tests/negative --coverage
```

### Specific Test with Coverage
```bash
npm test -- tests/negative/payment-negative.test.ts --coverage
```

### Generate HTML Coverage Report
```bash
npm test -- tests/negative --coverage --coverageReporters=html
# Open coverage/index.html in browser
```

---

## 🐳 Run in Docker

### Inside Backend Container
```bash
# Start services
docker-compose up -d

# Enter backend container
docker exec -it ca_backend sh

# Run tests
npm test -- tests/negative

# Exit container
exit
```

### From Host Machine
```bash
# Run all negative tests
docker-compose exec backend npm test -- tests/negative

# Run specific test suite
docker-compose exec backend npm test -- tests/negative/auth-negative.test.ts

# With coverage
docker-compose exec backend npm test -- tests/negative --coverage
```

---

## 🔧 Troubleshooting

### Issue: Tests Timing Out

**Solution:**
```bash
# Increase timeout in jest.config.js or test file
jest.setTimeout(30000);
```

### Issue: Database Connection Failed

**Solution:**
```bash
# Check .env.test file
TEST_DATABASE_URL=postgresql://caadmin:CaSecure123!@localhost:5432/ca_marketplace_test

# Verify database exists
psql -U caadmin -d postgres -c "SELECT datname FROM pg_database WHERE datname = 'ca_marketplace_test';"

# Create if needed
createdb -U caadmin ca_marketplace_test
```

### Issue: Migrations Not Applied

**Solution:**
```bash
# Apply migrations to test database
DATABASE_URL="postgresql://caadmin:CaSecure123!@localhost:5432/ca_marketplace_test" npx prisma migrate deploy

# Or reset test database
DATABASE_URL="postgresql://caadmin:CaSecure123!@localhost:5432/ca_marketplace_test" npx prisma migrate reset --force
```

### Issue: Fixture Data Missing

**Solution:**
```bash
# Tests auto-seed data, but if issues persist:
npm test -- tests/negative --verbose

# Check seeding logs in output
```

---

## 🎨 Debug Mode

### Run with Detailed Output
```bash
npm test -- tests/negative --verbose
```

### Run with Debug Logs
```bash
DEBUG=* npm test -- tests/negative
```

### Run Single Test in Watch Mode
```bash
npm test -- tests/negative/auth-negative.test.ts --watch
```

---

## ✅ Expected Test Results

### All Tests Should PASS

These are **negative tests** - they verify that the application **correctly rejects** invalid operations.

### Common Response Status Codes

| Code | Meaning | Example Scenario |
|------|---------|------------------|
| 400 | Bad Request | Invalid input, business rule violation |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 413 | Payload Too Large | File too big |
| 415 | Unsupported Media Type | Invalid file type |
| 423 | Locked | Account locked out |
| 429 | Too Many Requests | Rate limit exceeded |

---

## 📈 CI/CD Integration

### GitHub Actions Example
```yaml
name: Negative Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd backend
          npm ci

      - name: Run migrations
        run: |
          cd backend
          npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run negative tests
        run: |
          cd backend
          npm test -- tests/negative --coverage --ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          JWT_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📋 Test Checklists

### Before Running Tests
- [ ] Docker services running (if using Docker)
- [ ] Test database created
- [ ] Migrations applied
- [ ] Environment variables set (.env.test)
- [ ] Dependencies installed (npm install)

### After Test Failures
- [ ] Check test output for error messages
- [ ] Verify database connection
- [ ] Check environment variables
- [ ] Review recent code changes
- [ ] Run single failing test in isolation
- [ ] Check for timing issues (race conditions)

### Before Committing
- [ ] All negative tests pass
- [ ] Code coverage meets threshold (80%+)
- [ ] No console errors/warnings
- [ ] Test names are descriptive
- [ ] Documentation updated

---

## 🎓 Understanding Test Results

### Example: Successful Test
```
✓ should reject payment with negative amount (45ms)
```
**Meaning:** The application correctly rejected a payment with negative amount.

### Example: Failed Test
```
✕ should reject payment with negative amount (52ms)

Expected: 400
Received: 201
```
**Meaning:** The application accepted an invalid payment (security issue!).

---

## 🔗 Related Documentation

- **Full README**: `/backend/tests/negative/README.md`
- **Test Summary**: `/NEGATIVE_TESTS_SUMMARY.md`
- **Test Setup**: `/backend/tests/setup.ts`
- **Fixtures**: `/backend/tests/fixtures/`
- **Utilities**: `/backend/tests/utils/`

---

## 💡 Pro Tips

1. **Run tests frequently** during development
2. **Start with specific tests** when debugging
3. **Use watch mode** for active development
4. **Check coverage reports** to find gaps
5. **Add new tests** when finding bugs
6. **Keep tests isolated** and independent
7. **Use meaningful test names** for clarity

---

## 🆘 Getting Help

### Documentation
1. Read test file comments
2. Check README in tests/negative/
3. Review test utility functions

### Debugging
1. Run single test with `--verbose`
2. Check test logs for details
3. Use `console.log` in test code
4. Verify database state after test

### Support
- Review existing issues in project
- Check test documentation
- Contact development team

---

## 📊 Quick Stats

- **Total Test Files**: 5
- **Total Test Suites**: 35+
- **Total Test Cases**: 165+
- **Lines of Test Code**: 3,100+
- **Security Coverage**: OWASP Top 10 (8/10)
- **Execution Time**: ~2-5 minutes
- **Target Coverage**: 80%+

---

## 🎯 Next Steps

1. ✅ Run all negative tests
2. ✅ Verify all tests pass
3. ✅ Review coverage report
4. ✅ Add tests for new features
5. ✅ Keep tests up to date

---

**Happy Testing! 🧪**

*Remember: Negative tests ensure the application fails gracefully and securely.*
