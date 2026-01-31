// ***********************************************
// Custom Cypress Commands
// ***********************************************

/**
 * Login command
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} role - Expected user role (CLIENT, CA, ADMIN)
 */
Cypress.Commands.add('login', (email, password, role = null) => {
  cy.log(`Logging in as ${email}`);

  cy.visit('/login');

  // Wait for page to load
  cy.get('input[name="email"], input[type="email"]', { timeout: 10000 }).should('be.visible');

  // Fill in credentials
  cy.get('input[name="email"], input[type="email"]').clear().type(email);
  cy.get('input[name="password"], input[type="password"]').clear().type(password);

  // Submit form
  cy.get('button[type="submit"]').contains(/sign in|login/i).click();

  // Wait for redirect (dashboard or home)
  cy.url().should('not.include', '/login', { timeout: 10000 });

  // Verify token stored
  cy.window().then((win) => {
    const token = win.localStorage.getItem('token') || win.sessionStorage.getItem('token');
    expect(token).to.exist;
    cy.log('✓ Token stored successfully');
  });

  // Verify role if specified
  if (role) {
    cy.window().then((win) => {
      const user = JSON.parse(win.localStorage.getItem('user') || win.sessionStorage.getItem('user') || '{}');
      expect(user.role).to.equal(role);
      cy.log(`✓ User role verified: ${role}`);
    });
  }

  cy.log('✓ Login successful');
});

/**
 * Login via API (faster for setup)
 */
Cypress.Commands.add('loginViaAPI', (email, password) => {
  cy.log(`API Login as ${email}`);

  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login`,
    body: { email, password },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.success).to.be.true;
    expect(response.body.data.token).to.exist;

    const { token, user } = response.body.data;

    // Store in localStorage
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('user', JSON.stringify(user));

    cy.log(`✓ API login successful - Role: ${user.role}`);
  });
});

/**
 * Logout command
 */
Cypress.Commands.add('logout', () => {
  cy.log('Logging out');

  // Try clicking logout button
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="logout-button"]').length > 0) {
      cy.get('[data-testid="logout-button"]').click();
    } else if ($body.text().includes('Logout') || $body.text().includes('Sign Out')) {
      cy.contains(/logout|sign out/i).click();
    } else {
      // Manual logout - clear storage
      cy.clearLocalStorage();
      cy.clearCookies();
    }
  });

  cy.url().should('match', /login|home|\/$/, { timeout: 5000 });
  cy.log('✓ Logout successful');
});

/**
 * Create service request
 */
Cypress.Commands.add('createServiceRequest', (requestData) => {
  const {
    caId,
    firmId,
    serviceType = 'GST_FILING',
    description = 'Test service request description for E2E testing',
    deadline = null,
    estimatedHours = 5,
  } = requestData;

  cy.log('Creating service request');

  // Navigate to create request page
  cy.visit('/dashboard');

  // Click create request button (try multiple selectors)
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="create-request-button"]').length > 0) {
      cy.get('[data-testid="create-request-button"]').click();
    } else {
      cy.contains(/create request|new request|request service/i).click();
    }
  });

  // Fill form
  if (serviceType) {
    cy.get('select[name="serviceType"]').select(serviceType);
  }

  cy.get('textarea[name="description"]').clear().type(description);

  if (estimatedHours) {
    cy.get('input[name="estimatedHours"]').clear().type(estimatedHours.toString());
  }

  if (deadline) {
    cy.get('input[name="deadline"]').type(deadline);
  }

  // Submit
  cy.get('button[type="submit"]').contains(/submit|create|send/i).click();

  // Wait for success
  cy.contains(/success|created|submitted/i, { timeout: 10000 }).should('be.visible');

  cy.log('✓ Service request created');
});

/**
 * Wait for element and click
 */
Cypress.Commands.add('clickElement', (selector, text = null) => {
  if (text) {
    cy.contains(selector, text).should('be.visible').click();
  } else {
    cy.get(selector).should('be.visible').click();
  }
});

/**
 * Check if element contains text
 */
Cypress.Commands.add('shouldContainText', (selector, text) => {
  cy.get(selector).should('contain', text);
});

/**
 * Wait for API call and check response
 */
Cypress.Commands.add('waitForAPI', (url, alias = 'apiCall') => {
  cy.intercept('GET', `**/api/${url}*`).as(alias);
  cy.wait(`@${alias}`).its('response.statusCode').should('eq', 200);
});

/**
 * Navigate to page and wait for load
 */
Cypress.Commands.add('navigateTo', (path) => {
  cy.visit(path);
  cy.get('body').should('be.visible');
  cy.wait(500); // Wait for any animations
});

/**
 * Fill form field
 */
Cypress.Commands.add('fillField', (selector, value) => {
  cy.get(selector).should('be.visible').clear().type(value);
});

/**
 * Check request status
 */
Cypress.Commands.add('verifyRequestStatus', (requestId, expectedStatus) => {
  cy.log(`Verifying request ${requestId} has status ${expectedStatus}`);

  cy.request({
    method: 'GET',
    url: `${Cypress.env('apiUrl')}/service-requests/${requestId}`,
    headers: {
      Authorization: `Bearer ${window.localStorage.getItem('token')}`,
    },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.data.status).to.eq(expectedStatus);
    cy.log(`✓ Request status verified: ${expectedStatus}`);
  });
});

/**
 * Send message
 */
Cypress.Commands.add('sendMessage', (content, requestId = null) => {
  cy.log('Sending message');

  // Find message input
  cy.get('textarea[placeholder*="message" i], textarea[name="message"], input[type="text"][placeholder*="message" i]')
    .should('be.visible')
    .clear()
    .type(content);

  // Click send button
  cy.get('button').contains(/send|submit/i).click();

  // Verify message appears
  cy.contains(content).should('be.visible');

  cy.log('✓ Message sent');
});

/**
 * Clean up test data via API
 */
Cypress.Commands.add('cleanupTestData', () => {
  cy.log('Cleaning up test data');
  // This would call cleanup endpoints if they exist
  // For now, just log
  cy.task('log', 'Test data cleanup requested');
});

/**
 * Take screenshot with custom name
 */
Cypress.Commands.add('screenshot', (name) => {
  const testName = Cypress.currentTest.title.replace(/\s+/g, '-');
  cy.screenshot(`${testName}-${name}`);
});

/**
 * Mock API response
 */
Cypress.Commands.add('mockAPI', (method, url, response, statusCode = 200) => {
  cy.intercept(method, url, {
    statusCode,
    body: response,
  }).as('mockedAPI');
});

// Preserve local storage between tests
let LOCAL_STORAGE_MEMORY = {};

Cypress.Commands.add('saveLocalStorage', () => {
  Object.keys(localStorage).forEach((key) => {
    LOCAL_STORAGE_MEMORY[key] = localStorage[key];
  });
});

Cypress.Commands.add('restoreLocalStorage', () => {
  Object.keys(LOCAL_STORAGE_MEMORY).forEach((key) => {
    localStorage.setItem(key, LOCAL_STORAGE_MEMORY[key]);
  });
});

// Example of adding TypeScript support for custom commands
// Uncomment if using TypeScript
/*
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string, role?: string): Chainable<void>
      loginViaAPI(email: string, password: string): Chainable<void>
      logout(): Chainable<void>
      createServiceRequest(requestData: any): Chainable<void>
      clickElement(selector: string, text?: string): Chainable<void>
      shouldContainText(selector: string, text: string): Chainable<void>
      waitForAPI(url: string, alias?: string): Chainable<void>
      navigateTo(path: string): Chainable<void>
      fillField(selector: string, value: string): Chainable<void>
      verifyRequestStatus(requestId: string, expectedStatus: string): Chainable<void>
      sendMessage(content: string, requestId?: string): Chainable<void>
      cleanupTestData(): Chainable<void>
      mockAPI(method: string, url: string, response: any, statusCode?: number): Chainable<void>
      saveLocalStorage(): Chainable<void>
      restoreLocalStorage(): Chainable<void>
    }
  }
}
*/
