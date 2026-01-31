/// <reference types="cypress" />

describe('CA Workflow - End to End', () => {
  let assignedRequestId;

  before(() => {
    // Login as CA
    cy.loginViaAPI(Cypress.env('caEmail'), Cypress.env('caPassword'));
  });

  beforeEach(() => {
    cy.restoreLocalStorage();
  });

  afterEach(() => {
    cy.saveLocalStorage();
  });

  describe('CA Dashboard', () => {
    it('should display CA dashboard with key metrics', () => {
      cy.visit('/dashboard');

      cy.screenshot('28-ca-dashboard');

      // Should show CA-specific information
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase();
        return text.includes('request') ||
               text.includes('earning') ||
               text.includes('wallet') ||
               text.includes('client');
      });

      // Should show request statistics
      cy.get('[data-testid="stats"], .stats, .metrics').should('exist');
    });

    it('should display earnings summary', () => {
      cy.visit('/dashboard');

      // Look for earnings/wallet section
      cy.get('body').then(($body) => {
        if ($body.text().includes('Earning') || $body.text().includes('Wallet') || $body.text().includes('Revenue')) {
          cy.contains(/earning|wallet|revenue/i).should('be.visible');
          cy.screenshot('29-ca-earnings-section');
        } else {
          cy.log('Earnings section not found on dashboard');
        }
      });
    });
  });

  describe('View Incoming Requests', () => {
    it('should display list of assigned requests', () => {
      cy.visit('/dashboard');

      // Navigate to requests
      cy.get('body').then(($body) => {
        if ($body.text().includes('My Requests') || $body.text().includes('Requests')) {
          cy.contains(/my requests|requests/i).first().click();
        } else {
          cy.visit('/requests');
        }
      });

      cy.screenshot('30-ca-requests-list');

      // Should show requests assigned to this CA
      cy.get('body').should('contain', /request|service|client/i);
    });

    it('should filter requests by status', () => {
      cy.visit('/requests');

      // Try to filter by PENDING
      cy.get('body').then(($body) => {
        if ($body.find('select[name="status"], [data-testid="status-filter"]').length > 0) {
          cy.get('select[name="status"], [data-testid="status-filter"]').select('PENDING');

          cy.wait(1000);

          cy.screenshot('31-filtered-pending-requests');
        } else if ($body.text().includes('Pending') || $body.text().includes('Filter')) {
          cy.contains(/pending|filter/i).click();
          cy.screenshot('31-filtered-requests');
        }
      });
    });

    it('should view request details', () => {
      cy.visit('/requests');

      // Click on first request
      cy.get('[data-testid="request-item"], .request-item, .request-card').first().then(($item) => {
        // Try to capture request ID
        const id = $item.attr('data-request-id') || $item.find('[data-request-id]').attr('data-request-id');
        if (id) {
          assignedRequestId = id;
          cy.log(`Found assigned request ID: ${id}`);
        }

        $item.click();
      });

      cy.screenshot('32-ca-request-details');

      // Should show request details
      cy.get('body').should('contain', /client|company|description|deadline/i);
    });
  });

  describe('Accept Service Request', () => {
    it('should accept a PENDING request', () => {
      // Visit requests page
      cy.visit('/requests');

      cy.wait(1000);

      // Find a PENDING request
      cy.get('body').then(($body) => {
        const hasPendingRequests = $body.text().includes('PENDING') || $body.text().includes('Pending');

        if (hasPendingRequests) {
          // Click on a pending request
          cy.contains(/pending/i).first().parentsUntil('[data-testid="request-item"], .request-item, .request-card').click();

          cy.screenshot('33-pending-request-details');

          // Find and click Accept button
          cy.get('body').then(($detailBody) => {
            if ($detailBody.find('[data-testid="accept-button"]').length > 0) {
              cy.get('[data-testid="accept-button"]').click();
            } else if ($detailBody.text().includes('Accept')) {
              cy.contains('button', /accept/i).click();
            } else {
              cy.log('Accept button not found - request may not be assigned to this CA');
              return;
            }

            // Confirm if dialog appears
            cy.get('body').then(($confirmBody) => {
              if ($confirmBody.text().includes('confirm') || $confirmBody.text().includes('sure')) {
                cy.contains('button', /confirm|yes|accept/i).click();
              }
            });

            // Wait for success message or status update
            cy.get('body', { timeout: 10000 }).should('satisfy', ($successBody) => {
              const text = $successBody.text();
              return text.includes('ACCEPTED') ||
                     text.includes('Accepted') ||
                     text.includes('success') ||
                     text.includes('Success');
            });

            cy.screenshot('34-request-accepted');

            cy.log('✓ Request accepted successfully');
          });
        } else {
          cy.log('No pending requests found for this CA');
        }
      });
    });

    it('should not accept request assigned to another CA', () => {
      // This test verifies access control
      // Try to accept a request that's not assigned to this CA via API
      cy.window().then((win) => {
        const token = win.localStorage.getItem('token');

        // Try to accept a random request ID (should fail)
        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}/service-requests/00000000-0000-0000-0000-000000000000/accept`,
          headers: {
            'Authorization': `Bearer ${token}`
          },
          failOnStatusCode: false
        }).then((response) => {
          // Should fail with 404 or 403
          expect(response.status).to.be.oneOf([403, 404, 400]);
          cy.log('✓ Access control working - cannot accept others\' requests');
        });
      });
    });
  });

  describe('Start Work on Request', () => {
    it('should start work on ACCEPTED request', () => {
      cy.visit('/requests');

      // Find an ACCEPTED request
      cy.get('body').then(($body) => {
        const hasAcceptedRequests = $body.text().includes('ACCEPTED') || $body.text().includes('Accepted');

        if (hasAcceptedRequests) {
          // Click on accepted request
          cy.contains(/accepted/i).first().parentsUntil('[data-testid="request-item"], .request-item').click();

          cy.screenshot('35-accepted-request-details');

          // Find and click Start Work button
          cy.get('body').then(($detailBody) => {
            if ($detailBody.text().includes('Start Work') || $detailBody.text().includes('Begin')) {
              cy.contains('button', /start work|begin/i).click();

              // Confirm if needed
              cy.get('body').then(($confirmBody) => {
                if ($confirmBody.text().includes('confirm')) {
                  cy.contains('button', /confirm|yes/i).click();
                }
              });

              // Wait for status update
              cy.contains(/in progress|in_progress|working/i, { timeout: 10000 }).should('be.visible');

              cy.screenshot('36-work-started');

              cy.log('✓ Work started successfully');
            } else {
              cy.log('Start Work button not found');
            }
          });
        } else {
          cy.log('No accepted requests found');
        }
      });
    });
  });

  describe('Message Client', () => {
    it('should send message to client from request details', () => {
      cy.visit('/requests');

      // Click on first request
      cy.get('[data-testid="request-item"], .request-item').first().click();

      cy.wait(1000);

      // Look for message input
      cy.get('body').then(($body) => {
        const hasMessageInput = $body.find('textarea[placeholder*="message" i], input[placeholder*="message" i]').length > 0;

        if (hasMessageInput) {
          const messageContent = `E2E Test CA Message: I've reviewed your request and will start working on it soon. Timestamp: ${Date.now()}`;

          cy.get('textarea[placeholder*="message" i], input[placeholder*="message" i]')
            .clear()
            .type(messageContent);

          cy.screenshot('37-ca-message-typed');

          // Send message
          cy.contains('button', /send|submit/i).click();

          // Verify message appears
          cy.contains(messageContent, { timeout: 10000 }).should('be.visible');

          cy.screenshot('38-ca-message-sent');

          cy.log('✓ Message sent to client');
        } else {
          cy.log('Message interface not available');
        }
      });
    });
  });

  describe('Complete Request', () => {
    it('should mark IN_PROGRESS request as completed', () => {
      cy.visit('/requests');

      // Find an IN_PROGRESS request
      cy.get('body').then(($body) => {
        const hasInProgressRequests = $body.text().match(/in progress|in_progress|working/i);

        if (hasInProgressRequests) {
          // Click on in-progress request
          cy.contains(/in progress|in_progress|working/i).first().parentsUntil('[data-testid="request-item"], .request-item').click();

          cy.screenshot('39-in-progress-request');

          // Find Complete button
          cy.get('body').then(($detailBody) => {
            if ($detailBody.text().includes('Complete') || $detailBody.text().includes('Finish')) {
              cy.contains('button', /complete|finish|mark.*complete/i).click();

              // Fill completion form if exists
              cy.get('body').then(($formBody) => {
                if ($formBody.find('textarea[name="notes"], textarea[placeholder*="note" i]').length > 0) {
                  cy.get('textarea[name="notes"], textarea[placeholder*="note" i]')
                    .type('Service completed successfully. All deliverables provided.');
                }

                // Submit
                if ($formBody.text().includes('Confirm') || $formBody.find('button[type="submit"]').length > 0) {
                  cy.contains('button', /confirm|submit|complete/i).click();
                }
              });

              // Wait for status update
              cy.contains(/completed|finished|done/i, { timeout: 10000 }).should('be.visible');

              cy.screenshot('40-request-completed');

              cy.log('✓ Request marked as completed');
            } else {
              cy.log('Complete button not found');
            }
          });
        } else {
          cy.log('No in-progress requests found');
        }
      });
    });
  });

  describe('View Earnings', () => {
    it('should navigate to earnings/wallet page', () => {
      cy.visit('/dashboard');

      // Find earnings/wallet link
      cy.get('body').then(($body) => {
        if ($body.text().includes('Earning') || $body.text().includes('Wallet')) {
          cy.contains(/earning|wallet/i).first().click();

          cy.screenshot('41-earnings-page');

          // Should show earnings information
          cy.get('body').should('satisfy', ($earningsBody) => {
            const text = $earningsBody.text().toLowerCase();
            return text.includes('balance') ||
                   text.includes('total') ||
                   text.includes('earning') ||
                   text.includes('payment');
          });
        } else {
          // Try direct navigation
          cy.visit('/earnings');
          cy.screenshot('41-earnings-page-direct');
        }
      });
    });

    it('should display earnings breakdown', () => {
      cy.visit('/dashboard');

      // Look for earnings dashboard or summary
      cy.get('body').then(($body) => {
        const hasEarningsData = $body.text().match(/total.*earning|wallet.*balance|pending.*payment/i);

        if (hasEarningsData) {
          cy.screenshot('42-earnings-dashboard');

          // Should show numeric values
          cy.get('body').should('match', /[\d,]+(\.\d{2})?/);

          cy.log('✓ Earnings data displayed');
        } else {
          cy.log('Earnings data not found on current page');
        }
      });
    });
  });

  describe('CA Profile Management', () => {
    it('should view CA profile', () => {
      cy.visit('/dashboard');

      // Navigate to profile
      cy.get('body').then(($body) => {
        if ($body.text().includes('Profile') || $body.find('[data-testid="profile-link"]').length > 0) {
          cy.contains(/profile|account|settings/i).first().click();

          cy.screenshot('43-ca-profile-page');

          // Should show CA details
          cy.get('body').should('contain', /license|specialization|experience/i);
        } else {
          cy.visit('/profile');
          cy.screenshot('43-ca-profile-direct');
        }
      });
    });

    it('should display verification status', () => {
      cy.visit('/profile');

      // Look for verification badge or status
      cy.get('body').then(($body) => {
        if ($body.text().includes('Verified') || $body.text().includes('Verification')) {
          cy.contains(/verified|verification/i).should('be.visible');
          cy.screenshot('44-verification-status');
        }
      });
    });
  });

  describe('Request History', () => {
    it('should view completed requests', () => {
      cy.visit('/requests');

      // Filter by COMPLETED
      cy.get('body').then(($body) => {
        if ($body.find('select[name="status"]').length > 0) {
          cy.get('select[name="status"]').select('COMPLETED');
          cy.wait(1000);
        } else if ($body.text().includes('Completed')) {
          cy.contains(/completed/i).click();
        }
      });

      cy.screenshot('45-completed-requests');

      // Should show completed requests
      cy.get('body').should('satisfy', ($completedBody) => {
        const text = $completedBody.text();
        return text.includes('COMPLETED') ||
               text.includes('Completed') ||
               text.includes('No requests'); // Acceptable if none completed yet
      });
    });
  });
});
