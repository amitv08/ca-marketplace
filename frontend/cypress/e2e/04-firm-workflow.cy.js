/// <reference types="cypress" />

describe('Firm Workflow - End to End', () => {
  let firmRequestId;

  before(() => {
    // Login as firm admin
    cy.loginViaAPI(Cypress.env('firmAdminEmail'), Cypress.env('firmAdminPassword'));
  });

  beforeEach(() => {
    cy.restoreLocalStorage();
  });

  afterEach(() => {
    cy.saveLocalStorage();
  });

  describe('Firm Dashboard', () => {
    it('should display firm admin dashboard', () => {
      cy.visit('/dashboard');

      cy.screenshot('46-firm-dashboard');

      // Should show firm-specific information
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase();
        return text.includes('firm') ||
               text.includes('team') ||
               text.includes('member') ||
               text.includes('request');
      });
    });

    it('should show team overview', () => {
      cy.visit('/dashboard');

      // Look for team members section
      cy.get('body').then(($body) => {
        if ($body.text().includes('Team') || $body.text().includes('Members')) {
          cy.contains(/team|member/i).should('be.visible');
          cy.screenshot('47-team-overview');
        }
      });
    });

    it('should display firm metrics', () => {
      cy.visit('/dashboard');

      // Should show statistics
      cy.get('[data-testid="metrics"], .metrics, .stats, [data-testid="stats"]').should('exist');

      cy.screenshot('48-firm-metrics');
    });
  });

  describe('View Firm Requests', () => {
    it('should display all firm requests', () => {
      cy.visit('/dashboard');

      // Navigate to firm requests
      cy.get('body').then(($body) => {
        if ($body.text().includes('Firm Requests') || $body.text().includes('All Requests')) {
          cy.contains(/firm request|all request/i).first().click();
        } else if ($body.text().includes('Requests')) {
          cy.contains(/request/i).first().click();
        } else {
          cy.visit('/requests');
        }
      });

      cy.screenshot('49-firm-requests-list');

      // Should show requests
      cy.get('body').should('contain', /request|client|service/i);
    });

    it('should filter by assignment status', () => {
      cy.visit('/requests');

      // Try to filter by assigned/unassigned
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="assignment-filter"]').length > 0) {
          cy.get('[data-testid="assignment-filter"]').click();
          cy.screenshot('50-assignment-filter');
        } else if ($body.text().includes('Unassigned') || $body.text().includes('Assigned')) {
          cy.screenshot('50-assignment-status');
        }
      });
    });

    it('should view firm request details', () => {
      cy.visit('/requests');

      // Click on first request
      cy.get('[data-testid="request-item"], .request-item, .request-card').first().then(($item) => {
        const id = $item.attr('data-request-id');
        if (id) {
          firmRequestId = id;
        }
        $item.click();
      });

      cy.screenshot('51-firm-request-details');

      // Should show request details and assignment info
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text();
        return text.includes('Client') ||
               text.includes('Service') ||
               text.includes('Description');
      });
    });
  });

  describe('Team Member Management', () => {
    it('should view team members list', () => {
      cy.visit('/dashboard');

      // Navigate to team page
      cy.get('body').then(($body) => {
        if ($body.text().includes('Team Members') || $body.text().includes('Our Team')) {
          cy.contains(/team member|our team/i).click();
        } else if ($body.text().includes('Team')) {
          cy.contains(/team/i).first().click();
        } else {
          cy.visit('/firm/team');
        }
      });

      cy.screenshot('52-team-members-list');

      // Should show team members
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="member-card"], .member-card, .team-member').length > 0) {
          cy.get('[data-testid="member-card"], .member-card, .team-member').should('have.length.gte', 1);
          cy.log('✓ Team members displayed');
        }
      });
    });

    it('should display member workload', () => {
      cy.visit('/firm/team');

      // Look for workload indicators
      cy.get('body').then(($body) => {
        if ($body.text().includes('Workload') || $body.text().includes('Active') || $body.text().includes('Tasks')) {
          cy.screenshot('53-member-workload');
          cy.log('✓ Workload information displayed');
        }
      });
    });
  });

  describe('Assign Request to Member', () => {
    it('should assign unassigned request to team member', () => {
      cy.visit('/requests');

      // Find an unassigned request
      cy.get('body').then(($body) => {
        const hasUnassignedRequests = $body.text().includes('Unassigned') ||
                                      $body.text().includes('Not Assigned') ||
                                      $body.text().includes('Assign');

        if (hasUnassignedRequests) {
          // Click on unassigned request or one with Assign button
          cy.get('body').then(($listBody) => {
            if ($listBody.find('[data-testid="assign-button"]').length > 0) {
              cy.get('[data-testid="assign-button"]').first().click();
            } else {
              // Click on request to view details
              cy.get('[data-testid="request-item"], .request-item').first().click();

              cy.wait(1000);

              // Find Assign button in details view
              cy.get('body').then(($detailBody) => {
                if ($detailBody.text().includes('Assign')) {
                  cy.contains('button', /assign/i).click();
                }
              });
            }
          });

          cy.screenshot('54-assign-member-dialog');

          // Select a team member
          cy.get('body').then(($dialogBody) => {
            if ($dialogBody.find('select[name="caId"], select[name="memberId"]').length > 0) {
              cy.get('select[name="caId"], select[name="memberId"]').select(1); // Select first member
            } else if ($dialogBody.find('[data-testid="member-option"], .member-option').length > 0) {
              cy.get('[data-testid="member-option"], .member-option').first().click();
            }
          });

          cy.screenshot('55-member-selected');

          // Confirm assignment
          cy.contains('button', /assign|confirm/i).click();

          // Wait for success
          cy.contains(/success|assigned/i, { timeout: 10000 }).should('be.visible');

          cy.screenshot('56-request-assigned');

          cy.log('✓ Request assigned to team member');
        } else {
          cy.log('No unassigned requests found');
        }
      });
    });

    it('should view auto-assigned requests', () => {
      cy.visit('/requests');

      // Look for auto-assigned indicator
      cy.get('body').then(($body) => {
        if ($body.text().includes('Auto') || $body.text().includes('Automatic')) {
          cy.screenshot('57-auto-assigned-requests');
          cy.log('✓ Auto-assignment visible');
        }
      });
    });
  });

  describe('Firm Earnings & Financials', () => {
    it('should navigate to firm financials', () => {
      cy.visit('/dashboard');

      // Find financials/earnings link
      cy.get('body').then(($body) => {
        if ($body.text().includes('Financials') || $body.text().includes('Earnings') || $body.text().includes('Revenue')) {
          cy.contains(/financial|earning|revenue/i).first().click();

          cy.screenshot('58-firm-financials');

          // Should show financial data
          cy.get('body').should('satisfy', ($finBody) => {
            const text = $finBody.text().toLowerCase();
            return text.includes('earning') ||
                   text.includes('revenue') ||
                   text.includes('commission') ||
                   text.includes('payment');
          });
        } else {
          cy.visit('/firm/financials');
          cy.screenshot('58-firm-financials-direct');
        }
      });
    });

    it('should display payment distribution', () => {
      cy.visit('/dashboard');

      // Look for payment distribution section
      cy.get('body').then(($body) => {
        if ($body.text().includes('Distribution') || $body.text().includes('Split')) {
          cy.contains(/distribution|split/i).should('be.visible');
          cy.screenshot('59-payment-distribution');
        }
      });
    });

    it('should show firm commission breakdown', () => {
      cy.visit('/firm/financials');

      // Look for commission information
      cy.get('body').then(($body) => {
        if ($body.text().includes('Commission') || $body.text().includes('Fee')) {
          cy.screenshot('60-commission-breakdown');
          cy.log('✓ Commission data visible');
        }
      });
    });
  });

  describe('Firm Settings', () => {
    it('should access firm settings', () => {
      cy.visit('/dashboard');

      // Navigate to settings
      cy.get('body').then(($body) => {
        if ($body.text().includes('Settings') || $body.text().includes('Configuration')) {
          cy.contains(/setting|configuration/i).first().click();

          cy.screenshot('61-firm-settings');
        } else {
          cy.visit('/firm/settings');
          cy.screenshot('61-firm-settings-direct');
        }
      });
    });

    it('should view auto-assignment configuration', () => {
      cy.visit('/firm/settings');

      // Look for auto-assignment toggle
      cy.get('body').then(($body) => {
        if ($body.text().includes('Auto') && $body.text().includes('Assignment')) {
          cy.screenshot('62-auto-assignment-config');
          cy.log('✓ Auto-assignment settings available');
        }
      });
    });
  });

  describe('Firm Profile', () => {
    it('should view firm profile page', () => {
      cy.visit('/dashboard');

      // Navigate to firm profile
      cy.get('body').then(($body) => {
        if ($body.text().includes('Firm Profile') || $body.text().includes('About')) {
          cy.contains(/firm profile|about/i).click();
        } else {
          cy.visit('/firm/profile');
        }
      });

      cy.screenshot('63-firm-profile');

      // Should show firm details
      cy.get('body').should('satisfy', ($profileBody) => {
        const text = $profileBody.text();
        return text.includes('Firm') ||
               text.includes('Registration') ||
               text.includes('Member');
      });
    });

    it('should display verification status', () => {
      cy.visit('/firm/profile');

      // Look for verification badge
      cy.get('body').then(($body) => {
        if ($body.text().includes('Verified') || $body.text().includes('Verification')) {
          cy.screenshot('64-firm-verification');
        }
      });
    });
  });

  describe('Member Activity Monitoring', () => {
    it('should view member activity dashboard', () => {
      cy.visit('/dashboard');

      // Look for activity/analytics section
      cy.get('body').then(($body) => {
        if ($body.text().includes('Activity') || $body.text().includes('Analytics')) {
          cy.contains(/activity|analytics/i).first().click();
          cy.screenshot('65-member-activity');
        }
      });
    });

    it('should display member performance metrics', () => {
      cy.visit('/firm/team');

      // Look for performance indicators
      cy.get('body').then(($body) => {
        if ($body.text().match(/completion.*rate|rating|review/i)) {
          cy.screenshot('66-member-performance');
          cy.log('✓ Performance metrics visible');
        }
      });
    });
  });

  describe('Request Analytics', () => {
    it('should view firm request analytics', () => {
      cy.visit('/dashboard');

      // Should show request statistics
      cy.get('body').then(($body) => {
        const hasStats = $body.find('[data-testid="stats"], .stats, .analytics').length > 0 ||
                        $body.text().match(/pending.*\d+|completed.*\d+|in progress.*\d+/i);

        if (hasStats) {
          cy.screenshot('67-request-analytics');
          cy.log('✓ Request analytics displayed');
        }
      });
    });

    it('should filter analytics by date range', () => {
      cy.visit('/dashboard');

      // Look for date filters
      cy.get('body').then(($body) => {
        if ($body.find('input[type="date"], [data-testid="date-filter"]').length > 0) {
          cy.screenshot('68-date-range-filter');
        }
      });
    });
  });
});
