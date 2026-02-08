# Cypress E2E Testing Guide

## Overview

This guide covers the complete Cypress end-to-end testing setup for the CA Marketplace platform. These tests validate the **actual user interface workflows** through the browser.

---

## Quick Start

### 1. Install Cypress

```bash
# Navigate to frontend directory
cd frontend

# Install Cypress (if not already installed)
npm install cypress --save-dev

# Or install all dependencies
npm install
```

### 2. Run Tests

**Interactive Mode** (Recommended for development):
```bash
npm run cypress:open
```

**Headless Mode** (For CI/CD):
```bash
npm run cypress:run
```

**Specific Browser**:
```bash
npm run test:e2e:chrome    # Chrome
npm run test:e2e:firefox   # Firefox
```

**With Video**:
```bash
npm run cypress:run --headed  # See browser while tests run
```

---

## Prerequisites

### Services Must Be Running

Before running Cypress tests, ensure all services are up:

```bash
# From project root
docker-compose ps

# All services should show "Up" status:
# - ca_backend (port 8081)
# - ca_frontend (port 3001)
# - ca_postgres (port 54320)
# - ca_redis (port 63790)
```

**Start services if needed**:
```bash
docker-compose up -d
```

**Verify frontend is accessible**:
```bash
curl http://localhost:3001
# Should return HTML
```

**Verify backend is accessible**:
```bash
curl http://localhost:8081/api/health
# Should return {"success":true}
```

### Demo Data

Tests use demo accounts from `DEMO_CREDENTIALS.txt`. Ensure demo data is seeded:

```bash
# Check if demo data exists
docker exec ca_backend npx prisma studio
# Open http://localhost:5555 and verify users exist
```

---

## Test Structure

### Test Files

```
frontend/cypress/
├── e2e/
│   ├── 01-authentication.cy.js      # Login, logout, session tests
│   ├── 02-client-workflow.cy.js     # Client end-to-end workflow
│   ├── 03-ca-workflow.cy.js         # CA end-to-end workflow
│   ├── 04-firm-workflow.cy.js       # Firm admin workflow
│   └── 05-edge-cases.cy.js          # Error handling, validation
├── fixtures/
│   └── testData.json                # Test data and mock responses
├── support/
│   ├── commands.js                  # Custom Cypress commands
│   └── e2e.js                       # Global configuration
└── cypress.config.js                # Cypress configuration
```

### Test Coverage

#### 1. Authentication Tests (01-authentication.cy.js)
- ✅ Client login
- ✅ CA login
- ✅ Firm admin login
- ✅ Invalid credentials handling
- ✅ Form validation
- ✅ Logout functionality
- ✅ Session persistence
- ✅ Protected route access
- ✅ Role-based access control

#### 2. Client Workflow Tests (02-client-workflow.cy.js)
- ✅ Browse available CAs
- ✅ Filter CAs by specialization
- ✅ View CA profile details
- ✅ Create service request
- ✅ Form validation
- ✅ View request status
- ✅ View request timeline
- ✅ Send messages to CA
- ✅ Cancel request
- ✅ Dashboard overview

#### 3. CA Workflow Tests (03-ca-workflow.cy.js)
- ✅ View CA dashboard
- ✅ View assigned requests
- ✅ Filter requests by status
- ✅ Accept service request
- ✅ Access control validation
- ✅ Start work on request
- ✅ Send messages to client
- ✅ Complete request
- ✅ View earnings
- ✅ CA profile management

#### 4. Firm Workflow Tests (04-firm-workflow.cy.js)
- ✅ Firm admin dashboard
- ✅ Team overview
- ✅ View firm requests
- ✅ Filter by assignment status
- ✅ Team member management
- ✅ Assign request to member
- ✅ View auto-assigned requests
- ✅ Firm financials
- ✅ Payment distribution
- ✅ Firm settings
- ✅ Member activity monitoring

#### 5. Edge Cases & Error Handling (05-edge-cases.cy.js)
- ✅ Network errors
- ✅ Form validation
- ✅ Empty states
- ✅ Concurrent actions
- ✅ Session expiry
- ✅ Input sanitization
- ✅ Large data sets
- ✅ Mobile responsiveness
- ✅ Accessibility

---

## Custom Commands

### Authentication

```javascript
// Login via UI
cy.login('client1@demo.com', 'Demo@123', 'CLIENT');

// Login via API (faster for test setup)
cy.loginViaAPI('ca1@demo.com', 'Demo@123');

// Logout
cy.logout();
```

### Navigation

```javascript
// Navigate and wait for page load
cy.navigateTo('/dashboard');

// Click element safely
cy.clickElement('button[data-testid="submit"]');
```

### Form Operations

```javascript
// Fill form field
cy.fillField('input[name="email"]', 'test@example.com');

// Create service request
cy.createServiceRequest({
  serviceType: 'GST_FILING',
  description: 'Test request',
  estimatedHours: 5
});
```

### Messaging

```javascript
// Send message
cy.sendMessage('Hello, this is a test message');
```

### API Operations

```javascript
// Verify request status via API
cy.verifyRequestStatus(requestId, 'COMPLETED');

// Mock API response
cy.mockAPI('GET', '/api/cas', { data: mockCAs });
```

### Session Management

```javascript
// Save session between tests
cy.saveLocalStorage();

// Restore session
cy.restoreLocalStorage();
```

---

## Configuration

### Environment Variables

Configured in `cypress.config.js`:

```javascript
env: {
  apiUrl: 'http://localhost:8081/api',
  clientEmail: 'client1@demo.com',
  clientPassword: 'Demo@123',
  caEmail: 'ca1@demo.com',
  caPassword: 'Demo@123',
  firmAdminEmail: 'shahandassociates.1@demo.com',
  firmAdminPassword: 'Demo@123',
}
```

### Timeouts

```javascript
defaultCommandTimeout: 10000,    // 10 seconds
requestTimeout: 10000,
responseTimeout: 10000,
```

### Retry Configuration

```javascript
retries: {
  runMode: 2,      // Retry failed tests 2x in CI
  openMode: 0,     // No retry in interactive mode
}
```

---

## Running Specific Tests

### Run Single Test File

```bash
# Interactive
npx cypress open --spec "cypress/e2e/01-authentication.cy.js"

# Headless
npx cypress run --spec "cypress/e2e/01-authentication.cy.js"
```

### Run Specific Test Suite

```bash
# Using grep (requires cypress-grep plugin)
npx cypress run --env grep="Client Workflow"
```

### Run Only Failed Tests

```bash
# Requires Cypress Dashboard (paid feature)
npx cypress run --record --key YOUR_KEY
```

---

## Test Results

### Screenshots

Automatically captured:
- On test failure
- When `cy.screenshot('name')` is called

Location: `frontend/cypress/screenshots/`

### Videos

Automatically recorded in `cypress:run` mode.

Location: `frontend/cypress/videos/`

To disable:
```javascript
// cypress.config.js
video: false
```

### Reports

#### HTML Report (Mochawesome)

Install reporter:
```bash
npm install --save-dev mochawesome mochawesome-merge mochawesome-report-generator
```

Update config:
```javascript
reporter: 'mochawesome',
reporterOptions: {
  reportDir: 'cypress/reports',
  overwrite: false,
  html: true,
  json: true
}
```

Generate merged report:
```bash
npx mochawesome-merge cypress/reports/*.json > cypress/reports/report.json
npx marge cypress/reports/report.json --reportDir cypress/reports/html
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  cypress:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: docker-compose up -d

      - name: Wait for services
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:3001; do sleep 2; done'
          timeout 60 bash -c 'until curl -s http://localhost:8081/api/health; do sleep 2; done'

      - name: Run Cypress tests
        uses: cypress-io/github-action@v5
        with:
          working-directory: frontend
          browser: chrome
          headed: false

      - name: Upload screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots
          path: frontend/cypress/screenshots

      - name: Upload videos
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: cypress-videos
          path: frontend/cypress/videos
```

### GitLab CI

```yaml
cypress:
  image: cypress/browsers:latest
  stage: test
  script:
    - cd frontend
    - npm install
    - npm run cypress:run
  artifacts:
    when: always
    paths:
      - frontend/cypress/screenshots
      - frontend/cypress/videos
    expire_in: 7 days
```

---

## Debugging Tests

### Interactive Mode

```bash
npm run cypress:open
```

Benefits:
- See test execution in real-time
- Pause on specific commands
- Inspect DOM at any point
- View network requests
- Time-travel debugging

### Browser DevTools

While running tests:
1. Open Chrome DevTools (F12)
2. Network tab: Monitor API calls
3. Console: See logs
4. Application tab: Check localStorage/cookies

### Cypress Commands

```javascript
// Add debug points
cy.debug();

// Pause execution
cy.pause();

// Log to console
cy.log('Current state:', someVariable);

// Take screenshot
cy.screenshot('debug-point-1');
```

### Verbose Logging

```bash
DEBUG=cypress:* npm run cypress:run
```

---

## Best Practices

### 1. Use Data Attributes

Add `data-testid` attributes to elements:

```html
<button data-testid="submit-button">Submit</button>
```

```javascript
cy.get('[data-testid="submit-button"]').click();
```

### 2. Avoid Hardcoded Waits

❌ **Bad**:
```javascript
cy.wait(5000);  // Arbitrary wait
```

✅ **Good**:
```javascript
cy.get('[data-testid="result"]').should('be.visible');
```

### 3. Use Custom Commands

❌ **Bad**:
```javascript
// Repeat login in every test
cy.visit('/login');
cy.get('input[name="email"]').type('user@example.com');
cy.get('input[name="password"]').type('password');
cy.get('button').click();
```

✅ **Good**:
```javascript
cy.login('user@example.com', 'password');
```

### 4. Independent Tests

Each test should be independent:

```javascript
beforeEach(() => {
  // Reset state
  cy.loginViaAPI(email, password);
  cy.visit('/dashboard');
});
```

### 5. Use Fixtures

```javascript
cy.fixture('testData').then((data) => {
  cy.login(data.users.client.email, data.users.client.password);
});
```

---

## Troubleshooting

### Tests Fail with "element not found"

**Cause**: Elements not rendered yet or different UI structure

**Solution**:
```javascript
// Increase timeout
cy.get('[data-testid="element"]', { timeout: 15000 });

// Wait for element explicitly
cy.get('[data-testid="element"]').should('exist');

// Use contains for flexible matching
cy.contains('Submit').click();
```

### Tests Fail with "network error"

**Cause**: Backend not running or wrong URL

**Solution**:
1. Check backend is running: `curl http://localhost:8081/api/health`
2. Verify API URL in `cypress.config.js`
3. Check Docker network

### Session Lost Between Tests

**Cause**: localStorage cleared

**Solution**:
```javascript
beforeEach(() => {
  cy.restoreLocalStorage();
});

afterEach(() => {
  cy.saveLocalStorage();
});
```

### Flaky Tests

**Cause**: Timing issues, network variability

**Solution**:
1. Enable retries in config
2. Add explicit waits
3. Use `cy.intercept` to control API responses
4. Avoid animations (add CSS to disable)

---

## Performance Tips

### 1. Login via API

```javascript
// Faster than UI login
cy.loginViaAPI(email, password);
```

### 2. Parallel Execution

```bash
# Run tests in parallel (requires Cypress Dashboard)
npx cypress run --record --parallel
```

### 3. Skip Video Recording

```javascript
// cypress.config.js
video: false
```

### 4. Run Specific Tests

Don't run all tests during development:

```bash
npx cypress open --spec "cypress/e2e/02-client-workflow.cy.js"
```

---

## Test Maintenance

### When UI Changes

1. Update `data-testid` attributes if removed
2. Update selectors in tests
3. Update custom commands if behavior changes
4. Re-record videos/screenshots for documentation

### When API Changes

1. Update API mocks in fixtures
2. Update custom commands using API
3. Update environment variables if endpoints change

### Regular Maintenance

- Run tests weekly to catch regressions
- Update Cypress version quarterly
- Review and remove obsolete tests
- Add tests for new features immediately

---

## Additional Resources

### Official Documentation
- [Cypress Docs](https://docs.cypress.io)
- [Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [API Reference](https://docs.cypress.io/api/table-of-contents)

### Tutorials
- [Cypress Real World App](https://github.com/cypress-io/cypress-realworld-app)
- [Testing Workshop](https://github.com/cypress-io/testing-workshop-cypress)

### Plugins
- [cypress-axe](https://github.com/component-driven/cypress-axe) - Accessibility testing
- [cypress-grep](https://github.com/cypress-io/cypress-grep) - Run tests by tags
- [cypress-failed-log](https://github.com/bahmutov/cypress-failed-log) - Better error messages

---

## Summary

✅ **Installed**: Cypress with full E2E test suite
✅ **Configured**: Custom commands, fixtures, environment
✅ **Documented**: Comprehensive guide for running and maintaining tests
✅ **Covered**: All critical user workflows (Client, CA, Firm)

**Next Steps**:
1. Install Cypress: `cd frontend && npm install`
2. Start services: `docker-compose up -d`
3. Run tests: `npm run cypress:open`
4. Review results and screenshots

---

**Last Updated**: 2026-01-30
**Cypress Version**: 13.6.3
**Test Files**: 5 test suites, 50+ test cases
