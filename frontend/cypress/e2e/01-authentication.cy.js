/// <reference types="cypress" />

describe('Authentication Flows', () => {
  beforeEach(() => {
    // Clear storage before each test
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Client Login', () => {
    it('should successfully login as client and redirect to dashboard', () => {
      cy.visit('/');

      // Navigate to login page
      cy.contains(/login|sign in/i).click();

      // Fill login form
      cy.get('input[name="email"], input[type="email"]').type(Cypress.env('clientEmail'));
      cy.get('input[name="password"], input[type="password"]').type(Cypress.env('clientPassword'));

      // Take screenshot before submission
      cy.screenshot('01-client-login-form-filled');

      // Submit
      cy.get('button[type="submit"]').contains(/sign in|login/i).click();

      // Verify redirect
      cy.url().should('include', '/dashboard', { timeout: 10000 });

      // Verify token stored
      cy.window().its('localStorage.token').should('exist');

      // Verify user role
      cy.window().then((win) => {
        const user = JSON.parse(win.localStorage.getItem('user') || '{}');
        expect(user.role).to.equal('CLIENT');
        expect(user.email).to.equal(Cypress.env('clientEmail'));
      });

      // Take screenshot of dashboard
      cy.screenshot('02-client-dashboard-loaded');
    });

    it('should show error message for invalid credentials', () => {
      cy.visit('/login');

      cy.get('input[name="email"], input[type="email"]').type('invalid@example.com');
      cy.get('input[name="password"], input[type="password"]').type('wrongpassword');

      cy.get('button[type="submit"]').contains(/sign in|login/i).click();

      // Should stay on login page
      cy.url().should('include', '/login');

      // Should show error message
      cy.contains(/invalid|incorrect|failed|error/i, { timeout: 5000 }).should('be.visible');

      cy.screenshot('03-login-error-invalid-credentials');
    });

    it('should validate required fields', () => {
      cy.visit('/login');

      // Try to submit without filling fields
      cy.get('button[type="submit"]').contains(/sign in|login/i).click();

      // Check for HTML5 validation or custom error messages
      cy.get('input[name="email"], input[type="email"]').then(($input) => {
        // HTML5 validation
        const isInvalid = $input[0].checkValidity() === false;
        expect(isInvalid).to.be.true;
      });

      cy.screenshot('04-login-validation-empty-fields');
    });
  });

  describe('CA Login', () => {
    it('should successfully login as CA', () => {
      cy.login(Cypress.env('caEmail'), Cypress.env('caPassword'), 'CA');

      // Should redirect to CA dashboard
      cy.url().should('match', /dashboard|ca/i);

      // Verify CA-specific UI elements
      cy.get('body').should('contain', /requests|earnings|profile/i);

      cy.screenshot('05-ca-dashboard-loaded');
    });
  });

  describe('Firm Admin Login', () => {
    it('should successfully login as firm admin', () => {
      cy.login(Cypress.env('firmAdminEmail'), Cypress.env('firmAdminPassword'), 'CA');

      cy.url().should('match', /dashboard|firm/i);

      cy.screenshot('06-firm-admin-dashboard-loaded');
    });
  });

  describe('Logout', () => {
    it('should successfully logout and clear session', () => {
      // Login first
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/dashboard');

      // Logout
      cy.logout();

      // Verify token cleared
      cy.window().then((win) => {
        const token = win.localStorage.getItem('token');
        expect(token).to.be.null;
      });

      // Should redirect to home or login
      cy.url().should('match', /login|home|\/$/, { timeout: 5000 });

      cy.screenshot('07-logout-successful');
    });
  });

  describe('Session Persistence', () => {
    it('should maintain session after page reload', () => {
      // Login
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/dashboard');

      // Reload page
      cy.reload();

      // Should still be on dashboard (not redirected to login)
      cy.url().should('include', '/dashboard');

      // Token should still exist
      cy.window().its('localStorage.token').should('exist');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect to login when accessing protected route without auth', () => {
      // Try to access dashboard without login
      cy.visit('/dashboard');

      // Should redirect to login
      cy.url().should('match', /login/i, { timeout: 5000 });

      cy.screenshot('08-protected-route-redirect');
    });

    it('should prevent client from accessing CA-only routes', () => {
      // Login as client
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));

      // Try to access CA route
      cy.visit('/ca/dashboard', { failOnStatusCode: false });

      // Should redirect or show error
      cy.url().should('not.include', '/ca/dashboard');

      cy.screenshot('09-role-based-access-control');
    });
  });
});
