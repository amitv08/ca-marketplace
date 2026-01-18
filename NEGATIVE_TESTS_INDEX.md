# Negative Test Suite - File Index

Quick reference index for all negative test files and documentation.

## 📁 Test Files

### Location: `/backend/tests/negative/`

1. **auth-negative.test.ts** (400 lines)
   - Account lockout after 5 failed attempts
   - JWT token tampering and validation
   - Protected route access control
   - Refresh token security and replay prevention

2. **payment-negative.test.ts** (650 lines)
   - Invalid payment creation attempts
   - Double payment prevention
   - Razorpay signature verification
   - Webhook security and validation
   - Payment access control
   - Amount manipulation detection
   - Concurrent payment handling

3. **data-integrity-negative.test.ts** (700 lines)
   - SQL injection prevention (10+ payloads)
   - XSS prevention (14+ payloads)
   - File upload security
   - Input validation boundaries
   - Special character handling
   - JSON injection prevention
   - NoSQL injection prevention

4. **business-logic-negative.test.ts** (750 lines)
   - Self-service request violations
   - Self-review prevention
   - Payment release logic
   - Invalid state transitions
   - CA assignment rules
   - Message authorization
   - Admin boundary enforcement
   - Business rule validation

5. **race-condition-negative.test.ts** (600 lines)
   - Availability double-booking prevention
   - Concurrent service request acceptance
   - Concurrent payment processing
   - Concurrent review submission
   - Parallel state transitions
   - Resource locking
   - Message race conditions
   - Transaction isolation

## 📚 Documentation Files

### Location: `/`

- **NEGATIVE_TESTS_SUMMARY.md**
  - Comprehensive overview of all test scenarios
  - Statistics and coverage metrics
  - Security vulnerability coverage
  - OWASP Top 10 mapping

- **NEGATIVE_TESTS_QUICKSTART.md**
  - Quick start guide
  - Command reference
  - Troubleshooting tips
  - CI/CD integration examples

- **NEGATIVE_TESTS_INDEX.md** (this file)
  - File index and quick reference

### Location: `/backend/tests/negative/`

- **README.md**
  - Detailed test documentation
  - Running instructions
  - Test categories explanation
  - Best practices

- **verify-tests.sh**
  - Test suite verification script
  - Checks file presence
  - Validates configuration
  - Counts test cases

## 🧪 Test Statistics

- **Total Test Files**: 5
- **Total Lines of Code**: ~3,100
- **Total Test Cases**: 165+
- **Total Test Suites**: 35+
- **Security Coverage**: OWASP Top 10 (8/10)

## 🚀 Quick Commands

```bash
# Run all negative tests
npm test -- tests/negative

# Run specific test file
npm test -- tests/negative/auth-negative.test.ts

# Run with coverage
npm test -- tests/negative --coverage

# Verify test setup
./tests/negative/verify-tests.sh
```

## 🔗 Related Files

### Test Infrastructure
- `/backend/tests/setup.ts` - Global test configuration
- `/backend/tests/utils/auth.utils.ts` - Authentication helpers
- `/backend/tests/utils/database.utils.ts` - Database helpers
- `/backend/tests/utils/api.utils.ts` - API test helpers

### Test Fixtures
- `/backend/tests/fixtures/users.fixture.ts` - Test user data
- `/backend/tests/fixtures/cas.fixture.ts` - CA profiles and availability
- `/backend/tests/fixtures/requests.fixture.ts` - Service requests, payments, reviews

## 📊 Coverage by Category

| Category | Tests | Files |
|----------|-------|-------|
| Authentication | 25+ | 1 |
| Payments | 35+ | 1 |
| Data Integrity | 45+ | 1 |
| Business Logic | 40+ | 1 |
| Race Conditions | 20+ | 1 |

## 🎯 Next Steps

1. Review documentation files
2. Run verification script
3. Execute test suite
4. Review coverage report
5. Add tests for new features

---

**Last Updated**: 2026-01-16
**Maintained By**: Development Team
