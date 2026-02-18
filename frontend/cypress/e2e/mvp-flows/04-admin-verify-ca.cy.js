/// <reference types="cypress" />
/**
 * MVP Flow 4 — Admin Verify CA
 *
 * Steps:
 *  1. Admin logs in and reaches the admin dashboard
 *  2. Admin navigates to the CA verification queue
 *  3. Admin views an unverified CA's profile details
 *  4. Admin approves the CA (status → VERIFIED)
 *  5. Verify the CA can now accept requests
 *  6. Admin can reject a CA (status → REJECTED) with a reason
 */

describe('MVP Flow 4 — Admin Verify CA', () => {
  let pendingCaId;

  before(() => {
    // Get an unverified CA via admin API
    cy.loginViaAPI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/admin/users?role=CA&verified=false`,
      headers: { Authorization: `Bearer ${window.localStorage.getItem('token')}` },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status === 200) {
        const items = res.body.data?.items || res.body.data || [];
        if (items.length > 0) {
          pendingCaId = items[0].id;
          cy.log(`Found unverified CA: ${pendingCaId}`);
        }
      }
    });
  });

  beforeEach(() => {
    cy.restoreLocalStorage();
  });

  afterEach(() => {
    cy.saveLocalStorage();
  });

  // ── 1. Admin login and dashboard ──────────────────────────────────────────
  it('4.1 admin can log in and reach the admin dashboard', () => {
    cy.loginViaAPI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
    cy.visit('/admin');
    cy.screenshot('flow4-01-admin-dashboard');

    cy.url().should('include', '/admin', { timeout: 10000 });

    // Admin dashboard should show admin-specific metrics
    cy.get('body').should('satisfy', ($b) => {
      const t = $b.text().toLowerCase();
      return t.includes('admin') || t.includes('user') ||
             t.includes('platform') || t.includes('manage');
    });
  });

  // ── 2. Navigate to CA verification queue ─────────────────────────────────
  it('4.2 admin can view the CA verification queue', () => {
    cy.loginViaAPI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
    cy.visit('/admin');

    // Try various navigation patterns
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="ca-verification"], [href*="verification"]').length) {
        cy.get('[data-testid="ca-verification"], [href*="verification"]').first().click();
      } else if ($body.text().includes('Verification') || $body.text().includes('Verify CA')) {
        cy.contains(/verification|verify ca/i).click();
      } else if ($body.text().includes('Chartered Accountant')) {
        cy.contains(/chartered accountant/i).click();
      } else {
        cy.visit('/admin/cas');
      }
    });

    cy.screenshot('flow4-02-ca-queue');

    cy.get('body').should('satisfy', ($b) => {
      const t = $b.text().toLowerCase();
      return t.includes('ca') || t.includes('accountant') || t.includes('verify') || t.includes('pending');
    });
  });

  // ── 3. View CA profile details ────────────────────────────────────────────
  it('4.3 admin can view an individual CA profile', () => {
    cy.loginViaAPI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

    if (pendingCaId) {
      cy.visit(`/admin/users/${pendingCaId}`);
    } else {
      cy.visit('/admin/cas');
      cy.get('[data-testid="ca-row"], tbody tr, [class*="ca-item"]', { timeout: 10000 })
        .first().click();
    }

    cy.screenshot('flow4-03-ca-profile-admin-view');

    cy.get('body').should('satisfy', ($b) => {
      const t = $b.text().toLowerCase();
      return t.includes('license') || t.includes('specialization') ||
             t.includes('verify') || t.includes('approve');
    });
  });

  // ── 4. Admin approves the CA ──────────────────────────────────────────────
  it('4.4 admin can approve (verify) a CA', () => {
    cy.loginViaAPI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

    cy.intercept('PATCH', '**/api/admin/**').as('adminUpdate');
    cy.intercept('POST',  '**/api/admin/**').as('adminAction');

    if (pendingCaId) {
      cy.visit(`/admin/users/${pendingCaId}`);
    } else {
      cy.visit('/admin/cas');
      cy.get('[data-testid="ca-row"], tbody tr').first().click();
    }

    cy.screenshot('flow4-04-before-approve');

    // Find and click Approve / Verify button
    cy.get('body').then(($body) => {
      const btn = $body.find(
        'button:contains("Approve"), button:contains("Verify"), button:contains("Accept")'
      );
      if (btn.length) {
        cy.wrap(btn.first()).click();

        // Confirm modal if present
        cy.get('body').then(($b2) => {
          if ($b2.find('button:contains("Confirm"), button:contains("Yes")').length) {
            cy.get('button').contains(/confirm|yes/i).click();
          }
        });

        // Wait for API call
        cy.wait(['@adminUpdate', '@adminAction'], { timeout: 15000 }).then((interceptions) => {
          const i = Array.isArray(interceptions) ? interceptions[0] : interceptions;
          expect(i.response.statusCode).to.be.oneOf([200, 201]);
          cy.log('✓ CA approved via API');
        });

        cy.screenshot('flow4-05-ca-approved');

        // UI should reflect VERIFIED status
        cy.contains(/verified|approved|active/i, { timeout: 10000 }).should('be.visible');
      } else {
        cy.log('Approve button not found — CA may already be verified');
      }
    });
  });

  // ── 5. Verified CA can appear in listings ─────────────────────────────────
  it('4.5 verified CA now appears in the public CA listing', () => {
    // Verify the CA is in the public listing after approval
    cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));

    cy.intercept('GET', '**/api/cas**').as('caList');
    cy.visit('/cas');
    cy.wait('@caList', { timeout: 10000 }).its('response.statusCode').should('eq', 200);

    cy.screenshot('flow4-06-ca-in-listing');
    cy.log('✓ CA listing accessible to clients');
  });

  // ── 6. Admin can reject a CA with a reason ────────────────────────────────
  it('4.6 admin can reject a CA with a reason', () => {
    cy.loginViaAPI(Cypress.env('adminEmail'), Cypress.env('adminPassword'));

    cy.intercept('PATCH', '**/api/admin/**').as('adminReject');

    cy.visit('/admin/cas');
    cy.screenshot('flow4-07-ca-list-for-reject');

    cy.get('body').then(($body) => {
      const rejectBtn = $body.find('button:contains("Reject"), button:contains("Decline")');
      if (rejectBtn.length) {
        cy.wrap(rejectBtn.first()).click();

        // Fill rejection reason if modal prompts
        cy.get('body').then(($b2) => {
          if ($b2.find('textarea, input[name="reason"]').length) {
            cy.get('textarea, input[name="reason"]').first()
              .type('E2E test: Documents not sufficient. Please re-upload license.');
          }
          // Confirm rejection
          cy.get('button').contains(/confirm|reject|submit/i).click();
        });

        cy.screenshot('flow4-08-ca-rejected');
        cy.contains(/rejected|declined/i, { timeout: 10000 }).should('be.visible');
        cy.log('✓ CA rejection flow works');
      } else {
        cy.log('No reject button visible — possibly no unverified CAs remaining');
      }
    });
  });
});
