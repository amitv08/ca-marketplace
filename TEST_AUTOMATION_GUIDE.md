# 🧪 Test Automation Guide

## Overview

This project has a comprehensive automated test suite that can run locally and in GitHub Actions CI/CD.

---

## 📁 Files

| File | Purpose |
|------|---------|
| `run-full-tests.sh` | Local Docker-based test runner (all tests) |
| `.github/workflows/mvp-ci.yml` | Full test suite in CI (on push/PR) |
| `.github/workflows/quick-test.yml` | Fast linting + build check (< 5 min) |

---

## 🚀 Running Tests Locally

### 1. Quick Smoke Test (5 minutes)
```bash
# Just verify everything compiles
./run-full-tests.sh --quick
```

### 2. Full Test Suite (15-20 minutes)
```bash
# Run all tests (unit/integration/E2E)
./run-full-tests.sh
```

### 3. Specific Test Suite
```bash
# Backend only
cd backend && npm run test:all

# Frontend only
cd frontend && npm run test

# E2E only
cd frontend && npm run test:e2e
```

---

## 📊 Test Output

After running `./run-full-tests.sh`, you'll get:

### Generated Files:
- `test-summary.md` - Markdown summary report
- `backend-test-results.txt` - Detailed backend test output
- `frontend-test-results.txt` - Detailed frontend test output
- `e2e-test-results.txt` - E2E test output

### Console Output:
```
╔════════════════════════════════════════════════════════╗
║  CA Marketplace - Full Test Suite Runner              ║
║  Docker + Jest + Cypress + Playwright                  ║
╚════════════════════════════════════════════════════════╝

🔍 Step 1/8: Validating environment...
  ✓ backend/.env exists
  ✓ frontend/.env exists

🐳 Step 2/8: Starting Docker services...
  ✓ PostgreSQL ready
  ✓ Redis ready

... (continues through all 8 steps)

✅ TEST SUITE PASSED: All tests successful!
```

---

## 🔧 Configuration

### Backend .env (auto-created if missing)
```env
DATABASE_URL=postgresql://caadmin:CaSecure123!@localhost:5432/camarketplace
JWT_SECRET=your-secret-key
RAZORPAY_KEY_ID=rzp_test_xxxxx
```

### Frontend .env (auto-created if missing)
```env
VITE_API_URL=http://localhost:8081/api
VITE_APP_NAME=CA Marketplace
VITE_RAZORPAY_KEY_ID=rzp_test_dummy
```

---

## 📋 Test Coverage

### Backend Tests
- **Unit Tests:** Service layer, utilities, middleware
- **Integration Tests:** API endpoints with database
- **Security Tests:** Auth bypass, SQL injection, rate limits
- **Coverage Target:** 80%+

### Frontend Tests
- **Unit Tests:** Components, hooks, utilities
- **Integration Tests:** Redux stores, API calls
- **E2E Tests:** Critical user flows (login, requests, payments)
- **Coverage Target:** 70%+

### E2E Test Scenarios
1. Client registration → Login → Create request
2. CA login → Accept request → Mark complete
3. Admin login → Verify CA → Manage users
4. Payment flow → Razorpay integration
5. Chat/messaging within requests

---

## 🐛 Troubleshooting

### Script fails with "docker-compose not found"
```bash
# Install docker-compose
sudo apt-get install docker-compose
```

### Tests fail with "Database connection refused"
```bash
# Restart PostgreSQL container
docker-compose restart postgres
docker-compose logs postgres
```

### Frontend build fails
```bash
# Clear node_modules and rebuild
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Backend tests timeout
```bash
# Increase test timeout in jest.config.js
{
  "testTimeout": 30000  // 30 seconds
}
```

---

## 🎯 CI/CD Integration

### GitHub Actions Workflows

#### 1. Full Test Suite (`mvp-ci.yml`)
**Trigger:** Push to main/develop, PRs
**Duration:** ~15 minutes
**Jobs:**
- Backend tests (with PostgreSQL/Redis services)
- Frontend tests
- E2E tests (Docker Compose)
- Build verification
- Test summary

**View Results:**
- Go to GitHub → Actions tab
- Click on latest run
- View job logs and artifacts

#### 2. Quick Test (`quick-test.yml`)
**Trigger:** Push to any branch
**Duration:** ~5 minutes
**Jobs:**
- Lint backend
- Lint frontend
- Build verification

---

## 📈 Continuous Improvement

### Adding New Tests

**Backend (Jest):**
```typescript
// backend/tests/unit/myFeature.test.ts
describe('MyFeature', () => {
  it('should do something', async () => {
    const result = await myFunction();
    expect(result).toBe(expected);
  });
});
```

**Frontend (Jest + React Testing Library):**
```typescript
// frontend/src/components/__tests__/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

**E2E (Cypress):**
```javascript
// frontend/cypress/e2e/myFlow.cy.js
describe('My User Flow', () => {
  it('completes the flow', () => {
    cy.visit('/');
    cy.get('[data-testid="login-button"]').click();
    // ... more steps
  });
});
```

---

## ✅ Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] All tests passing locally (`./run-full-tests.sh`)
- [ ] All tests passing in CI (GitHub Actions green)
- [ ] Code coverage meets targets (80% backend, 70% frontend)
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Database migrations tested
- [ ] Environment variables documented
- [ ] Manual smoke test on staging

---

## 🔗 Resources

- **Jest Documentation:** https://jestjs.io/
- **Cypress Documentation:** https://docs.cypress.io/
- **GitHub Actions:** https://docs.github.com/actions
- **Docker Compose:** https://docs.docker.com/compose/

---

## 🆘 Getting Help

**Issues with tests?**
1. Check `test-summary.md` for overview
2. Review detailed logs in `*-test-results.txt`
3. Check Docker logs: `docker-compose logs [service]`
4. Run specific failing test in isolation

**Still stuck?**
- File an issue with test output
- Include environment details (OS, Node version, Docker version)
- Share relevant error messages

---

**Last Updated:** 2026-02-09
**Maintained By:** Development Team
