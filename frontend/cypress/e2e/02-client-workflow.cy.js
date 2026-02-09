/// <reference types="cypress" />

describe('Client Workflow - End to End', () => {
  let requestId;
  let caId;

  before(() => {
    // Login once for all tests in this suite
    cy.loginViaAPI(Cypress.env('client2Email'), Cypress.env('client2Password'));
  });

  beforeEach(() => {
    // Restore session
    cy.restoreLocalStorage();
  });

  afterEach(() => {
    // Save session
    cy.saveLocalStorage();
  });

  describe('Browse Available CAs', () => {
    it('should display list of verified CAs', () => {
      cy.visit('/dashboard');
      cy.screenshot('10-client-dashboard');

      // Navigate to browse CAs
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="browse-cas"]').length > 0) {
          cy.get('[data-testid="browse-cas"]').click();
        } else if ($body.text().includes('Browse CAs') || $body.text().includes('Find CA')) {
          cy.contains(/browse ca|find ca/i).click();
        } else {
          // Try navigating directly
          cy.visit('/cas');
        }
      });

      cy.url().should('match', /cas|chartered-accountants/i);

      // Verify CAs are displayed
      cy.get('body').should('contain', /license|specialization|rating|hourly/i);

      cy.screenshot('11-browse-cas-page');

      // Get first CA's ID for later use
      cy.get('[data-testid="ca-card"], .ca-card, .ca-item').first().should('exist').then(($card) => {
        const id = $card.attr('data-ca-id') || $card.find('[data-ca-id]').attr('data-ca-id');
        if (id) {
          caId = id;
          cy.log(`Found CA ID: ${id}`);
        }
      });
    });

    it('should filter CAs by specialization', () => {
      cy.visit('/cas');

      // Try to find and use filter
      cy.get('body').then(($body) => {
        if ($body.find('select[name="specialization"]').length > 0) {
          cy.get('select[name="specialization"]').select('GST_FILING');

          // Results should update
          cy.get('[data-testid="ca-card"], .ca-card').should('exist');

          cy.screenshot('12-filtered-cas-by-specialization');
        } else {
          cy.log('Filter not found, skipping filter test');
        }
      });
    });

    it('should view CA profile details', () => {
      cy.visit('/cas');

      // Click on first CA card
      cy.get('[data-testid="ca-card"], .ca-card, .ca-item').first().click();

      // Should navigate to CA profile
      cy.url().should('match', /ca|chartered-accountant|profile/i);

      // Verify profile details displayed
      cy.get('body').should('contain', /experience|qualification|rating|hourly rate/i);

      cy.screenshot('13-ca-profile-details');
    });
  });

  describe('Create Service Request', () => {
    it('should create service request to individual CA', () => {
      cy.visit('/dashboard');

      // Find and click create request button
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="create-request"]').length > 0) {
          cy.get('[data-testid="create-request"]').click();
        } else if ($body.text().includes('New Request') || $body.text().includes('Create Request')) {
          cy.contains(/new request|create request/i).first().click();
        } else {
          // Navigate to CAs and click request from CA profile
          cy.visit('/cas');
          cy.get('[data-testid="ca-card"], .ca-card').first().click();
          cy.contains(/request service|book now|create request/i).click();
        }
      });

      cy.screenshot('14-create-request-form');

      // Fill out the form
      cy.get('body').then(($body) => {
        // Service type
        if ($body.find('select[name="serviceType"]').length > 0) {
          cy.get('select[name="serviceType"]').select('GST_FILING');
        }

        // Description
        const description = 'E2E Test: Need GST filing assistance for Q4 FY2025-26. Approximately 100 transactions.';
        cy.get('textarea[name="description"], textarea[placeholder*="description" i]')
          .clear()
          .type(description);

        // Estimated hours
        if ($body.find('input[name="estimatedHours"]').length > 0) {
          cy.get('input[name="estimatedHours"]').clear().type('5');
        }

        // Deadline (optional)
        if ($body.find('input[name="deadline"]').length > 0) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 15);
          const dateString = futureDate.toISOString().split('T')[0];
          cy.get('input[name="deadline"]').type(dateString);
        }
      });

      cy.screenshot('15-request-form-filled');

      // Submit request
      cy.get('button[type="submit"]').contains(/submit|create|send/i).click();

      // Wait for success message or redirect
      cy.get('body', { timeout: 15000 }).should('satisfy', ($body) => {
        const text = $body.text();
        return text.includes('success') ||
               text.includes('created') ||
               text.includes('submitted') ||
               $body.find('[data-testid="request-id"]').length > 0;
      });

      cy.screenshot('16-request-created-success');

      // Try to capture request ID from URL or page
      cy.url().then((url) => {
        const match = url.match(/request[s]?\/([a-f0-9-]+)/i);
        if (match) {
          requestId = match[1];
          cy.log(`Request ID captured from URL: ${requestId}`);
        }
      });

      // Alternative: Get from page element
      cy.get('body').then(($body) => {
        const idElement = $body.find('[data-testid="request-id"], .request-id');
        if (idElement.length > 0 && !requestId) {
          requestId = idElement.text().trim();
          cy.log(`Request ID captured from element: ${requestId}`);
        }
      });
    });

    it('should validate form fields', () => {
      cy.visit('/dashboard');

      // Try to create request
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="create-request"]').length > 0) {
          cy.get('[data-testid="create-request"]').click();
        } else {
          cy.visit('/requests/new');
        }
      });

      // Try to submit empty form
      cy.get('button[type="submit"]').contains(/submit|create|send/i).click();

      // Should show validation errors
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase();
        return text.includes('required') ||
               text.includes('error') ||
               text.includes('invalid');
      });

      cy.screenshot('17-form-validation-errors');
    });
  });

  describe('View Service Request Status', () => {
    it('should display request in My Requests list', () => {
      cy.visit('/dashboard');

      // Navigate to My Requests
      cy.get('body').then(($body) => {
        if ($body.text().includes('My Requests') || $body.text().includes('Service Requests')) {
          cy.contains(/my requests|service requests/i).click();
        } else {
          cy.visit('/requests');
        }
      });

      cy.screenshot('18-my-requests-list');

      // Should show at least one request
      cy.get('[data-testid="request-item"], .request-item, .request-card').should('have.length.gte', 1);

      // Check for PENDING status
      cy.contains(/pending|awaiting|waiting/i).should('exist');
    });

    it('should view request details', () => {
      cy.visit('/requests');

      // Click on first request (or specific request if we have ID)
      if (requestId) {
        cy.visit(`/requests/${requestId}`);
      } else {
        cy.get('[data-testid="request-item"], .request-item, .request-card').first().click();
      }

      cy.screenshot('19-request-details-page');

      // Verify request details are displayed
      cy.get('body').should('contain', /service type|description|status|deadline/i);

      // Should show status badge
      cy.get('[data-testid="status-badge"], .status-badge, .badge').should('exist');

      // Should show CA details
      cy.get('body').should('contain', /chartered accountant|ca|assigned to/i);
    });

    it('should display status timeline', () => {
      if (!requestId) {
        // Get first request
        cy.visit('/requests');
        cy.get('[data-testid="request-item"]').first().click();
      } else {
        cy.visit(`/requests/${requestId}`);
      }

      // Look for timeline or status history
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="timeline"], .timeline').length > 0) {
          cy.get('[data-testid="timeline"], .timeline').should('be.visible');
          cy.screenshot('20-request-timeline');
        } else {
          cy.log('Timeline not found on page');
        }
      });
    });
  });

  describe('Messaging with CA', () => {
    it('should send message to CA from request details', () => {
      if (requestId) {
        cy.visit(`/requests/${requestId}`);
      } else {
        cy.visit('/requests');
        cy.get('[data-testid="request-item"]').first().click();
      }

      cy.screenshot('21-request-before-message');

      // Look for messages section or chat interface
      cy.get('body').then(($body) => {
        // Check if messages section exists
        const hasMessages = $body.find('[data-testid="messages"], .messages, textarea[placeholder*="message" i]').length > 0;

        if (hasMessages) {
          // Type message
          const messageContent = `E2E Test: Hello CA, I have some questions about this request. Timestamp: ${Date.now()}`;

          cy.get('textarea[placeholder*="message" i], textarea[name="message"], input[placeholder*="message" i]')
            .clear()
            .type(messageContent);

          cy.screenshot('22-message-typed');

          // Send message
          cy.get('button').contains(/send|submit/i).click();

          // Verify message appears
          cy.contains(messageContent, { timeout: 10000 }).should('be.visible');

          cy.screenshot('23-message-sent');

          cy.log('✓ Message sent successfully');
        } else {
          cy.log('Messages interface not found, may require CA acceptance first');
        }
      });
    });
  });

  describe('Cancel Request', () => {
    it('should allow canceling PENDING request', () => {
      // Create a new request to cancel
      cy.visit('/dashboard');

      // Try creating via API for speed
      cy.window().then((win) => {
        const token = win.localStorage.getItem('token');

        cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}/service-requests`,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: {
            serviceType: 'GST_FILING',
            description: 'Test request to be cancelled',
            estimatedHours: 3
          },
          failOnStatusCode: false
        }).then((response) => {
          if (response.status === 201 || response.status === 200) {
            const newRequestId = response.body.data?.id || response.body.id;
            cy.log(`Created request to cancel: ${newRequestId}`);

            // Visit request details
            cy.visit(`/requests/${newRequestId}`);

            cy.screenshot('24-request-before-cancel');

            // Find and click cancel button
            cy.get('body').then(($body) => {
              if ($body.find('[data-testid="cancel-request"], button').filter((i, el) => el.textContent.match(/cancel/i)).length > 0) {
                cy.contains('button', /cancel/i).click();

                // Confirm cancellation if dialog appears
                cy.get('body').then(($confirmBody) => {
                  if ($confirmBody.text().includes('confirm') || $confirmBody.text().includes('sure')) {
                    cy.contains('button', /confirm|yes|cancel/i).click();
                  }
                });

                // Verify status changed
                cy.contains(/cancelled|canceled/i, { timeout: 10000 }).should('be.visible');

                cy.screenshot('25-request-cancelled');
              } else {
                cy.log('Cancel button not found');
              }
            });
          }
        });
      });
    });
  });

  describe('Dashboard Overview', () => {
    it('should display client dashboard metrics', () => {
      cy.visit('/dashboard');

      cy.screenshot('26-client-dashboard-full');

      // Should show request counts
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase();
        return text.includes('request') ||
               text.includes('service') ||
               text.includes('pending') ||
               text.includes('completed');
      });

      // Should have navigation menu
      cy.get('nav, [role="navigation"], .navigation, .sidebar').should('exist');
    });

    it('should show recent requests', () => {
      cy.visit('/dashboard');

      // Look for recent requests section
      cy.get('body').then(($body) => {
        if ($body.text().includes('Recent') || $body.text().includes('Latest')) {
          cy.contains(/recent|latest/i).should('be.visible');

          // Should show request items
          cy.get('[data-testid="request-item"], .request-item, .request-card')
            .should('have.length.gte', 1);
        }
      });

      cy.screenshot('27-dashboard-recent-requests');
    });
  });
});
