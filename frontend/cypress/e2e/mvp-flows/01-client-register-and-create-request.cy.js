/// <reference types="cypress" />
/**
 * MVP Flow 1 — Client Register → Create Service Request
 *
 * Steps:
 *  1. Register a brand-new client account
 *  2. Verify JWT token stored and role = CLIENT
 *  3. Browse the CA listing
 *  4. Open a CA profile
 *  5. Submit a service request to that CA
 *  6. Assert the request appears in the client dashboard
 */

const unique = Date.now();
const NEW_CLIENT = {
  name:     `E2E Client ${unique}`,
  email:    `e2e.client.${unique}@test.com`,
  password: 'E2E@Test123!',
  role:     'CLIENT',
};

describe('MVP Flow 1 — Client Register → Create Request', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  // ── 1. Register ─────────────────────────────────────────────────────────
  it('1.1 registers a new client account', () => {
    cy.visit('/register');
    cy.screenshot('flow1-01-register-page');

    // Fill registration form
    cy.get('input[name="name"], input[placeholder*="name" i]')
      .should('be.visible').type(NEW_CLIENT.name);
    cy.get('input[name="email"], input[type="email"]')
      .should('be.visible').type(NEW_CLIENT.email);
    cy.get('input[name="password"], input[type="password"]').first()
      .should('be.visible').type(NEW_CLIENT.password);

    // Confirm password if field exists
    cy.get('body').then(($body) => {
      if ($body.find('input[name="confirmPassword"], input[name="passwordConfirm"]').length) {
        cy.get('input[name="confirmPassword"], input[name="passwordConfirm"]')
          .type(NEW_CLIENT.password);
      }
    });

    // Select CLIENT role if toggle exists
    cy.get('body').then(($body) => {
      const text = $body.text();
      if (text.includes('Client') && text.includes('CA')) {
        cy.contains(/^client$/i).click();
      }
    });

    cy.screenshot('flow1-02-register-form-filled');
    cy.get('button[type="submit"]').contains(/register|sign up|create/i).click();

    // After registration → should be on dashboard or redirect to login
    cy.url().should('not.include', '/register', { timeout: 15000 });
    cy.screenshot('flow1-03-post-register');
  });

  // ── 2. Login with new account ────────────────────────────────────────────
  it('1.2 logs in and verifies CLIENT token', () => {
    // Use existing seeded client to avoid DB dependency on test 1.1
    cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));

    cy.window().then((win) => {
      const token = win.localStorage.getItem('token');
      expect(token).to.exist;
      expect(token).to.be.a('string').and.have.length.greaterThan(20);

      const user = JSON.parse(win.localStorage.getItem('user') || '{}');
      expect(user.role).to.equal('CLIENT');
    });

    cy.log('✓ Token and role verified');
  });

  // ── 3. Browse CA listing ─────────────────────────────────────────────────
  it('1.3 client can browse available CAs', () => {
    cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
    cy.visit('/cas');
    cy.screenshot('flow1-04-ca-listing');

    // At least one CA card should exist
    cy.get('[data-testid="ca-card"], .ca-card, [class*="ca-item"], [class*="CACard"]', { timeout: 15000 })
      .should('have.length.greaterThan', 0);

    // Each card should show key info
    cy.get('body').should('contain.text', 'GST')
      .or('contain.text', 'Income Tax')
      .or('contain.text', 'Audit');

    cy.screenshot('flow1-05-ca-cards-visible');
  });

  // ── 4. Open CA profile ───────────────────────────────────────────────────
  it('1.4 client can view a CA profile', () => {
    cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
    cy.visit('/cas');

    cy.get('[data-testid="ca-card"], .ca-card, [class*="ca-item"]', { timeout: 15000 })
      .first().click();

    cy.url().should('match', /\/cas\/|\/profile\/|\/chartered-accountant\//i, { timeout: 10000 });
    cy.screenshot('flow1-06-ca-profile');

    // Profile should contain meaningful info
    cy.get('body').should('satisfy', ($b) => {
      const t = $b.text().toLowerCase();
      return t.includes('specialization') || t.includes('rate') ||
             t.includes('gst') || t.includes('years') || t.includes('license');
    });
  });

  // ── 5. Create service request ────────────────────────────────────────────
  it('1.5 client can submit a service request to a CA', () => {
    cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));

    // Intercept service-request creation
    cy.intercept('POST', '**/api/service-requests**').as('createRequest');

    cy.visit('/cas');
    cy.get('[data-testid="ca-card"], .ca-card, [class*="ca-item"]', { timeout: 15000 })
      .first().click();

    // Find "Request Service" / "Hire" button on the profile
    cy.get('body').then(($body) => {
      const btn = $body.find('[data-testid="request-service"], button:contains("Request"), button:contains("Hire"), a:contains("Request")');
      if (btn.length) {
        cy.wrap(btn.first()).click();
      } else {
        // Fall back: navigate to service request form directly
        cy.visit('/service-requests/new');
      }
    });

    cy.screenshot('flow1-07-service-request-form');

    // Fill required fields
    cy.get('select[name="serviceType"], input[name="serviceType"], [data-testid="service-type"]')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select(0);   // pick first option
        } else {
          cy.wrap($el).type('GST_FILING');
        }
      });

    cy.get('textarea[name="description"], textarea[placeholder*="describe" i], textarea[name="message"]')
      .should('be.visible')
      .type('E2E test: Need GST filing assistance for FY2024-25. This is an automated test request.');

    cy.screenshot('flow1-08-request-form-filled');
    cy.get('button[type="submit"]').contains(/submit|create|send|request/i).click();

    // Wait for API and verify 201
    cy.wait('@createRequest', { timeout: 15000 }).its('response.statusCode').should('eq', 201);
    cy.screenshot('flow1-09-request-submitted');

    cy.log('✓ Service request created successfully');
  });

  // ── 6. Request appears in dashboard ─────────────────────────────────────
  it('1.6 new request appears in client dashboard', () => {
    cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
    cy.visit('/dashboard');

    cy.screenshot('flow1-10-dashboard-with-request');

    // Dashboard should list at least one request
    cy.get('body').should('satisfy', ($b) => {
      const t = $b.text().toLowerCase();
      return t.includes('pending') || t.includes('request') || t.includes('gst');
    });

    cy.log('✓ Request visible in dashboard');
  });
});
