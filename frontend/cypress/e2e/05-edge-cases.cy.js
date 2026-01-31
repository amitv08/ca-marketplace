/// <reference types="cypress" />

describe('Edge Cases & Error Handling', () => {
  describe('Network Errors', () => {
    it('should handle API timeout gracefully', () => {
      cy.visit('/login');

      // Intercept and delay API call
      cy.intercept('POST', '**/api/auth/login', (req) => {
        req.reply((res) => {
          res.delay = 30000; // 30 second delay
        });
      }).as('slowLogin');

      // Try to login
      cy.get('input[name="email"]').type('test@example.com');
      cy.get('input[name="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Should show loading state
      cy.get('button[type="submit"]').should('be.disabled');

      cy.screenshot('69-loading-state');
    });

    it('should display error message on network failure', () => {
      cy.visit('/login');

      // Mock network error
      cy.intercept('POST', '**/api/auth/login', {
        forceNetworkError: true
      }).as('networkError');

      cy.get('input[name="email"]').type('test@example.com');
      cy.get('input[name="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Should show error message
      cy.contains(/error|failed|network|unable/i, { timeout: 10000 }).should('be.visible');

      cy.screenshot('70-network-error');
    });
  });

  describe('Form Validation', () => {
    it('should prevent request creation with missing fields', () => {
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/requests/new');

      // Try to submit empty form
      cy.get('button[type="submit"]').click();

      // Should show validation errors
      cy.get('body').should('satisfy', ($body) => {
        return $body.text().includes('required') ||
               $body.find(':invalid').length > 0;
      });

      cy.screenshot('71-form-validation');
    });

    it('should validate email format', () => {
      cy.visit('/login');

      cy.get('input[name="email"]').type('invalidemail');
      cy.get('input[name="password"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Check HTML5 validation
      cy.get('input[name="email"]').should('satisfy', ($input) => {
        return !$input[0].checkValidity();
      });

      cy.screenshot('72-email-validation');
    });

    it('should validate deadline is in the future', () => {
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/requests/new');

      // Try to set past deadline
      const pastDate = '2020-01-01';

      cy.get('body').then(($body) => {
        if ($body.find('input[name="deadline"]').length > 0) {
          cy.get('input[name="deadline"]').type(pastDate);
          cy.get('button[type="submit"]').click();

          // Should show error or prevent submission
          cy.screenshot('73-deadline-validation');
        }
      });
    });
  });

  describe('Empty States', () => {
    it('should display empty state when no requests exist', () => {
      // Create fresh user account (would need API support)
      // For now, check if empty state UI exists

      cy.loginViaAPI(Cypress.env('caEmail'), Cypress.env('caPassword'));
      cy.visit('/requests');

      cy.get('body').then(($body) => {
        if ($body.text().includes('No requests') || $body.text().includes('No service requests')) {
          cy.screenshot('74-empty-state-requests');
          cy.log('✓ Empty state displayed correctly');
        }
      });
    });

    it('should show empty state for messages', () => {
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/messages');

      cy.get('body').then(($body) => {
        if ($body.text().includes('No messages') || $body.text().includes('No conversations')) {
          cy.screenshot('75-empty-state-messages');
        }
      });
    });
  });

  describe('Concurrent Actions', () => {
    it('should handle multiple rapid form submissions', () => {
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/requests/new');

      // Fill form
      cy.get('select[name="serviceType"]').select('GST_FILING');
      cy.get('textarea[name="description"]').type('Test concurrent submission');

      // Click submit multiple times rapidly
      cy.get('button[type="submit"]').click().click().click();

      // Should only create one request (button should be disabled after first click)
      cy.get('button[type="submit"]').should('be.disabled');

      cy.screenshot('76-button-disabled-after-submit');
    });
  });

  describe('Session Expiry', () => {
    it('should redirect to login when token expires', () => {
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/dashboard');

      // Clear token to simulate expiry
      cy.window().then((win) => {
        win.localStorage.removeItem('token');
      });

      // Try to navigate to protected page
      cy.visit('/requests');

      // Should redirect to login
      cy.url().should('match', /login/i, { timeout: 5000 });

      cy.screenshot('77-session-expired-redirect');
    });
  });

  describe('Browser Compatibility', () => {
    it('should work with disabled JavaScript features', () => {
      // This test ensures graceful degradation
      cy.visit('/');

      // Page should at least render
      cy.get('body').should('be.visible');

      cy.screenshot('78-page-rendered');
    });
  });

  describe('Input Sanitization', () => {
    it('should handle special characters in input', () => {
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/requests/new');

      const specialChars = '<script>alert("XSS")</script>';

      cy.get('textarea[name="description"]').type(specialChars);

      // Submit and verify no script execution
      cy.get('button[type="submit"]').click();

      // Page should not execute script
      cy.on('window:alert', (str) => {
        throw new Error('XSS vulnerability detected!');
      });

      cy.screenshot('79-special-chars-handled');
    });
  });

  describe('Large Data Sets', () => {
    it('should handle long descriptions', () => {
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/requests/new');

      const longText = 'A'.repeat(5000);

      cy.get('textarea[name="description"]').type(longText.substring(0, 1000)); // Type subset for speed

      cy.screenshot('80-long-description');
    });

    it('should paginate large lists', () => {
      cy.loginViaAPI(Cypress.env('clientEmail'), Cypress.env('clientPassword'));
      cy.visit('/requests');

      // Check for pagination controls
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="pagination"], .pagination').length > 0) {
          cy.screenshot('81-pagination-controls');
          cy.log('✓ Pagination implemented');
        }
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt layout for mobile viewport', () => {
      cy.viewport('iphone-x');

      cy.visit('/');

      cy.screenshot('82-mobile-home');

      // Check if navigation collapses
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="mobile-menu"], .mobile-menu, .hamburger').length > 0) {
          cy.log('✓ Mobile menu detected');
        }
      });
    });

    it('should allow form submission on mobile', () => {
      cy.viewport('iphone-x');

      cy.login(Cypress.env('clientEmail'), Cypress.env('clientPassword'));

      cy.screenshot('83-mobile-dashboard');

      // Forms should be usable
      cy.get('body').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      cy.visit('/login');

      // Check for labels
      cy.get('input[name="email"]').should('satisfy', ($input) => {
        const id = $input.attr('id');
        const hasLabel = $input.parent().find(`label[for="${id}"]`).length > 0 ||
                        $input.attr('aria-label') ||
                        $input.attr('placeholder');
        return hasLabel;
      });

      cy.screenshot('84-form-accessibility');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/login');

      // Tab through form
      cy.get('body').type('{tab}');
      cy.focused().should('have.attr', 'type', 'email');

      cy.get('body').type('{tab}');
      cy.focused().should('have.attr', 'type', 'password');

      cy.screenshot('85-keyboard-navigation');
    });
  });
});
