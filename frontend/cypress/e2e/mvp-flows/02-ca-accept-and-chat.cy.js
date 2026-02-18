/// <reference types="cypress" />
/**
 * MVP Flow 2 — CA Accept Request → Chat with Client
 *
 * Steps:
 *  1. CA logs in and views incoming requests
 *  2. CA accepts a PENDING request
 *  3. CA sends a message in the request thread
 *  4. Client logs in, sees the request is ACCEPTED
 *  5. Client replies with a message
 *  6. Both sides verify messages are visible
 */

describe('MVP Flow 2 — CA Accept Request → Chat', () => {
  let requestId;

  before(() => {
    // Get a pending request ID via API as the CA
    cy.loginViaAPI(Cypress.env('caEmail'), Cypress.env('caPassword'));

    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/ca/requests?status=PENDING`,
      headers: { Authorization: `Bearer ${window.localStorage.getItem('token')}` },
    }).then((res) => {
      expect(res.status).to.eq(200);
      const items = res.body.data?.items || res.body.data || [];
      if (items.length > 0) {
        requestId = items[0].id;
        cy.log(`Using request ID: ${requestId}`);
      } else {
        cy.log('No pending requests found — test will skip accept step');
      }
    });
  });

  beforeEach(() => {
    cy.restoreLocalStorage();
  });

  afterEach(() => {
    cy.saveLocalStorage();
  });

  // ── 1. CA dashboard shows incoming requests ──────────────────────────────
  it('2.1 CA dashboard displays pending requests', () => {
    cy.loginViaAPI(Cypress.env('caEmail'), Cypress.env('caPassword'));
    cy.visit('/dashboard');
    cy.screenshot('flow2-01-ca-dashboard');

    cy.get('body').should('satisfy', ($b) => {
      const t = $b.text().toLowerCase();
      return t.includes('request') || t.includes('pending') || t.includes('client');
    });
  });

  // ── 2. CA accepts a request ──────────────────────────────────────────────
  it('2.2 CA can accept a pending request', () => {
    cy.loginViaAPI(Cypress.env('caEmail'), Cypress.env('caPassword'));

    cy.intercept('PATCH', '**/api/service-requests/**').as('updateRequest');

    // Navigate to the request (via UI)
    cy.visit('/dashboard');

    cy.get('body').then(($body) => {
      // Try data-testid first, then text-based selectors
      if ($body.find('[data-testid="requests-list"]').length) {
        cy.get('[data-testid="requests-list"] [data-testid="request-item"]').first().click();
      } else if ($body.text().includes('Pending')) {
        cy.contains(/pending/i).first().closest('[class*="card"], [class*="item"], tr').click();
      } else {
        // Fall back to direct API-driven navigation
        if (requestId) {
          cy.visit(`/service-requests/${requestId}`);
        } else {
          cy.visit('/dashboard');
          cy.contains(/view|details/i).first().click();
        }
      }
    });

    cy.screenshot('flow2-02-request-detail-view');

    // Click Accept button
    cy.get('button').contains(/^accept$/i, { timeout: 10000 }).should('be.visible').click();
    cy.screenshot('flow2-03-after-accept-click');

    // Wait for API update
    cy.wait('@updateRequest', { timeout: 15000 }).then((interception) => {
      expect(interception.response.statusCode).to.be.oneOf([200, 201]);
      const body = interception.response.body;
      const status = body?.data?.status || body?.status;
      if (status) expect(status).to.eq('ACCEPTED');
      cy.log('✓ Request accepted via API');
    });

    // UI should reflect the change
    cy.contains(/accepted|in progress/i, { timeout: 10000 }).should('be.visible');
    cy.screenshot('flow2-04-request-accepted');
  });

  // ── 3. CA sends a message ────────────────────────────────────────────────
  it('2.3 CA can send a message to the client', () => {
    cy.loginViaAPI(Cypress.env('caEmail'), Cypress.env('caPassword'));

    const caMessage = `CA E2E message ${Date.now()}: I have reviewed your request and will begin shortly.`;

    // Navigate to the request thread
    if (requestId) {
      cy.visit(`/service-requests/${requestId}`);
    } else {
      cy.visit('/dashboard');
      cy.contains(/accepted|in progress/i).first()
        .closest('[class*="card"], [class*="item"], tr').click();
    }

    cy.screenshot('flow2-05-message-thread');

    cy.intercept('POST', '**/api/messages**').as('sendMessage');

    // Type in message box
    cy.get(
      'textarea[placeholder*="message" i], textarea[name="message"], input[placeholder*="type" i]',
      { timeout: 10000 }
    ).should('be.visible').clear().type(caMessage);

    cy.get('button').contains(/send|post/i).click();

    cy.wait('@sendMessage', { timeout: 10000 })
      .its('response.statusCode').should('eq', 201);

    cy.contains(caMessage, { timeout: 10000 }).should('be.visible');
    cy.screenshot('flow2-06-ca-message-sent');
    cy.log('✓ CA message sent');
  });

  // ── 4. Client sees request is ACCEPTED ───────────────────────────────────
  it('2.4 client sees the request status as ACCEPTED', () => {
    cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
    cy.visit('/dashboard');
    cy.screenshot('flow2-07-client-dashboard');

    cy.get('body').should('satisfy', ($b) => {
      const t = $b.text().toLowerCase();
      return t.includes('accepted') || t.includes('in progress') || t.includes('active');
    });

    cy.log('✓ Client sees accepted request');
  });

  // ── 5. Client replies ────────────────────────────────────────────────────
  it('2.5 client can reply in the message thread', () => {
    cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));

    const clientReply = `Client E2E reply ${Date.now()}: Thank you! Please proceed.`;

    if (requestId) {
      cy.visit(`/service-requests/${requestId}`);
    } else {
      cy.visit('/dashboard');
      cy.contains(/accepted|in progress/i).first()
        .closest('[class*="card"], [class*="item"], tr').click();
    }

    cy.screenshot('flow2-08-client-message-thread');

    cy.intercept('POST', '**/api/messages**').as('clientMessage');

    cy.get(
      'textarea[placeholder*="message" i], textarea[name="message"], input[placeholder*="type" i]',
      { timeout: 10000 }
    ).should('be.visible').clear().type(clientReply);

    cy.get('button').contains(/send|post/i).click();

    cy.wait('@clientMessage', { timeout: 10000 })
      .its('response.statusCode').should('eq', 201);

    cy.contains(clientReply, { timeout: 10000 }).should('be.visible');
    cy.screenshot('flow2-09-client-reply-sent');
    cy.log('✓ Client reply sent and visible');
  });

  // ── 6. Both messages visible in thread ───────────────────────────────────
  it('2.6 message thread shows both CA and client messages', () => {
    cy.loginViaAPI(Cypress.env('caEmail'), Cypress.env('caPassword'));

    if (requestId) {
      cy.visit(`/service-requests/${requestId}`);
    } else {
      cy.visit('/dashboard');
      cy.contains(/accepted|in progress/i).first()
        .closest('[class*="card"], [class*="item"], tr').click();
    }

    cy.screenshot('flow2-10-full-thread');

    // Thread should contain messages from both parties
    cy.get('[class*="message"], [data-testid*="message"], .chat-message', { timeout: 10000 })
      .should('have.length.greaterThan', 1);

    cy.log('✓ Multi-user message thread verified');
  });
});
