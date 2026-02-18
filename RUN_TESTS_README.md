# 🚀 Quick Start - Running Automated Tests

## TL;DR - Run Tests Now

```bash
# Navigate to project root
cd /home/amit/ca-marketplace

# Run full test suite (15-20 mins)
./run-full-tests.sh

# View summary
cat test-summary.md
```

---

## What You Get

### ✅ Automated Test Runner
- **Script:** `run-full-tests.sh` - Orchestrates all tests in Docker
- **Duration:** 15-20 minutes for complete suite
- **Coverage:** Backend, Frontend, E2E, System Health

### ✅ GitHub Actions CI/CD
- **Full Suite:** `.github/workflows/mvp-ci.yml` - Runs on push/PR
- **Quick Check:** `.github/workflows/quick-test.yml` - Fast linting (< 5 min)
- **Automatic:** Runs on every commit

### ✅ Comprehensive Reports
- `test-summary.md` - Executive summary
- `backend-test-results.txt` - Detailed backend logs
- `frontend-test-results.txt` - Detailed frontend logs
- `e2e-test-results.txt` - End-to-end test logs

---

## Step-by-Step First Run

### 1. Prerequisites Check
```bash
# Verify Docker is running
docker --version
docker-compose --version

# Check services
docker-compose ps
```

### 2. Run Tests
```bash
# Make script executable (first time only)
chmod +x run-full-tests.sh

# Execute full test suite
./run-full-tests.sh
```

### 3. Monitor Progress
You'll see 8 steps:
```
Step 1/8: Validating environment... ✓
Step 2/8: Starting Docker services... ✓
Step 3/8: Setting up database... ✓
Step 4/8: Starting application services... ✓
Step 5/8: Running backend tests... ✓
Step 6/8: Running frontend tests... ✓
Step 7/8: Running E2E tests... ✓
Step 8/8: Generating test summary... ✓
```

### 4. Review Results
```bash
# Quick summary
cat test-summary.md

# Detailed backend results
cat backend-test-results.txt

# Detailed frontend results
cat frontend-test-results.txt
```

---

## Understanding Test Output

### ✅ Success Output
```
╔════════════════════════════════════════════════════════╗
║              TEST EXECUTION COMPLETE                   ║
╚════════════════════════════════════════════════════════╝

Test Results Summary

Backend Unit/Integration: ✅ PASS (45 tests passed)
Frontend Unit: ✅ PASS (32 tests passed)
E2E Tests: ✅ PASS (12 tests passed)

✅ TEST SUITE PASSED: All tests successful!
```

### ❌ Failure Output
```
Backend Unit/Integration: ❌ FAIL (2 failures)

See backend-test-results.txt for details:
  Line 234: Test "should validate user input" failed
  Expected: valid
  Received: invalid

FIX: Update validation logic in src/services/user.service.ts:45
```

### ⚠️ Warning Output
```
Frontend tests: ⚠️ WARNING
  No tests found (test suite not configured)

This is OK if you haven't written frontend tests yet.
Continue with manual testing.
```

---

## What Each Test Suite Covers

### 🧪 Backend Tests (`Step 5/8`)
Tests in `backend/tests/`:
- **Unit Tests:** Service logic, utilities, helpers
- **Integration Tests:** API endpoints with real database
- **Security Tests:** Auth bypass, SQL injection, XSS
- **Negative Tests:** Invalid inputs, error handling

**Run individually:**
```bash
cd backend
npm run test:unit           # Unit tests only
npm run test:integration    # Integration only
npm run test:security       # Security only
npm run test:all            # Everything
```

### 🎨 Frontend Tests (`Step 6/8`)
Tests in `frontend/src/__tests__/`:
- **Component Tests:** React component rendering
- **Hook Tests:** Custom React hooks
- **Store Tests:** Redux state management
- **Utility Tests:** Helper functions

**Run individually:**
```bash
cd frontend
npm run test                     # All tests
npm run test -- --coverage       # With coverage
npm run test -- --watch          # Watch mode
```

### 🌐 E2E Tests (`Step 7/8`)
Tests in `frontend/cypress/e2e/`:
- **User Flows:** Login, registration, navigation
- **Feature Flows:** Create request, payment, chat
- **Integration:** Frontend + Backend + Database
- **Browser Testing:** Real browser interaction

**Run individually:**
```bash
cd frontend
npm run test:e2e                 # Headless mode
npm run cypress:open             # Interactive mode
```

---

## Troubleshooting Guide

### Issue: "docker-compose.yml not found"
**Fix:**
```bash
cd /home/amit/ca-marketplace
ls docker-compose.yml  # Verify file exists
```

### Issue: "Backend tests failed - Jest not found"
**Fix:**
```bash
cd backend
npm install  # Install dependencies
npm run test:all  # Retry
```

### Issue: "PostgreSQL connection refused"
**Fix:**
```bash
docker-compose restart postgres
docker-compose logs postgres --tail 50
```

### Issue: "Frontend build failed"
**Fix:**
```bash
cd frontend
rm -rf node_modules
npm install
npm run build
```

### Issue: "Tests timeout"
**Symptom:** Tests hang and never complete

**Fix:**
```bash
# Increase timeout in package.json
{
  "jest": {
    "testTimeout": 30000
  }
}
```

---

## GitHub Actions Setup

### Enable CI/CD

1. **Push to GitHub:**
```bash
git add .github/workflows/
git commit -m "Add automated test workflows"
git push origin main
```

2. **View Results:**
- Go to GitHub repository
- Click "Actions" tab
- See test runs for each commit

3. **Test Status Badges:**
Add to README.md:
```markdown
![Tests](https://github.com/YOUR_USERNAME/ca-marketplace/workflows/MVP%20Full%20Test%20Suite/badge.svg)
```

### Workflow Triggers

- **Full Test Suite:** Runs on push to main/develop
- **Quick Test:** Runs on any branch push
- **Manual:** Can trigger manually in GitHub Actions UI

---

## Advanced Usage

### Run Tests in Background
```bash
# Run tests and continue working
./run-full-tests.sh > test-run.log 2>&1 &

# Check progress
tail -f test-run.log
```

### Run Only Specific Tests
```bash
# Backend unit tests only
docker-compose run --rm backend npm run test:unit

# Frontend E2E only
docker-compose run --rm frontend npm run test:e2e

# Manual smoke test
curl http://localhost:8081/api/monitoring/health
curl http://localhost:3001
```

### Debug Failing Tests
```bash
# Run single test file
cd backend
npm test -- tests/unit/specific-test.test.ts

# Run with verbose output
npm test -- --verbose

# Run in watch mode (auto-rerun on changes)
npm test -- --watch
```

---

## Performance Tips

### Speed Up Test Runs

1. **Skip E2E tests during development:**
```bash
# Edit run-full-tests.sh, comment out E2E section
```

2. **Use test:unit instead of test:all:**
```bash
cd backend && npm run test:unit  # Faster
```

3. **Run tests in parallel (if configured):**
```bash
npm test -- --maxWorkers=4
```

---

## Integration with IDE

### VS Code
Install extensions:
- Jest Runner
- Cypress Test Runner
- Test Explorer UI

### Run tests from IDE:
- Click green play button next to test
- View results inline
- Debug with breakpoints

---

## Test Data Management

### Seed Test Data
```bash
# Seed database with test data
docker-compose exec backend npx prisma db seed

# Or reset and seed
docker-compose exec backend npx prisma migrate reset
```

### Clean Test Data
```bash
# Remove all test data
docker-compose down -v  # Deletes volumes
docker-compose up -d    # Fresh start
```

---

## Maintenance

### Update Test Dependencies
```bash
# Backend
cd backend
npm update jest @types/jest supertest

# Frontend
cd frontend
npm update @testing-library/react @testing-library/jest-dom
```

### Review Test Coverage
```bash
# Backend coverage report
cd backend
npm run test:all -- --coverage
open coverage/lcov-report/index.html

# Frontend coverage
cd frontend
npm test -- --coverage
open coverage/lcov-report/index.html
```

---

## Next Steps After First Test Run

### ✅ If All Tests Pass
1. ✓ Review test-summary.md
2. ✓ Commit to Git
3. ✓ Push to GitHub (triggers CI)
4. ✓ Monitor GitHub Actions
5. ✓ Proceed with development

### ❌ If Tests Fail
1. Check detailed logs (`*-test-results.txt`)
2. Identify failure type (P0 blocker vs P1 enhancement)
3. Fix issues based on error messages
4. Re-run tests: `./run-full-tests.sh`
5. Repeat until green

### ⚠️ If Tests Don't Exist
1. Tests may not be written yet (expected for new projects)
2. Manual testing required
3. Write tests as you develop features
4. Re-run automation as tests are added

---

## Success Criteria

**You're ready for production when:**
- ✅ `./run-full-tests.sh` exits with code 0
- ✅ test-summary.md shows "ALL TESTS PASSED"
- ✅ GitHub Actions shows green checkmarks
- ✅ Coverage reports meet targets (80% backend, 70% frontend)
- ✅ Manual smoke tests on 5 critical flows pass

---

## 📞 Support

**Questions?**
- Review TEST_AUTOMATION_GUIDE.md for detailed info
- Check troubleshooting section above
- Review test output logs
- File GitHub issue with error details

**Ready to deploy?**
- Ensure all tests pass
- Review security scan results
- Check performance metrics
- Update documentation

---

**Created:** 2026-02-09
**Last Updated:** 2026-02-09
**Version:** 1.0.0
