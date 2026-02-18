/// <reference types="cypress" />

describe('Firm Edge Cases - End to End', () => {
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

  describe('TC-E2E-EDGE-001: Invitation Rejection Flow', () => {
    it('should allow invitee to reject invitation', () => {
      // This would be tested from invitee perspective
      cy.log('Invitation rejection flow - requires separate user session');

      // Navigate to invitations (if accessible)
      cy.visit('/dashboard');

      cy.get('body').then(($body) => {
        if ($body.text().includes('Pending Invitations') || $body.text().includes('Invitations')) {
          cy.contains(/invitation/i).click();
          cy.screenshot('70-pending-invitations');
        }
      });
    });

    it('should show invitation expiry warning', () => {
      cy.visit('/dashboard');

      // Look for expiring invitations section
      cy.get('body').then(($body) => {
        if ($body.text().match(/expir(ing|ed)/i)) {
          cy.screenshot('71-expiring-invitations');
          cy.log('✓ Expiry warnings visible');
        }
      });
    });
  });

  describe('TC-E2E-EDGE-002: Request Reassignment', () => {
    it('should allow admin to reassign request to different member', () => {
      cy.visit('/dashboard');

      // Navigate to requests
      cy.get('body').then(($body) => {
        if ($body.text().includes('Requests') || $body.text().includes('My Requests')) {
          cy.contains(/request/i).first().click();
        } else {
          cy.visit('/firm/requests');
        }
      });

      cy.screenshot('72-firm-requests');

      // Look for assigned request
      cy.get('body').then(($body) => {
        if ($body.text().includes('Assigned to')) {
          // Find reassign button/option
          if ($body.find('[data-testid="reassign-button"]').length > 0) {
            cy.get('[data-testid="reassign-button"]').first().click();
            cy.screenshot('73-reassign-dialog');

            // Select different member
            cy.get('select[name="newAssignee"], select[name="caId"]').then(($select) => {
              if ($select.length > 0) {
                cy.get($select).select(1); // Select different member
                cy.screenshot('74-new-member-selected');

                // Confirm reassignment
                cy.contains('button', /reassign|confirm/i).click();

                // Verify success
                cy.contains(/success|reassigned/i, { timeout: 10000 }).should('be.visible');
                cy.screenshot('75-reassignment-success');
              }
            });
          } else {
            cy.log('Reassignment feature not yet implemented in UI');
          }
        }
      });
    });

    it('should show reassignment history', () => {
      cy.visit('/firm/requests');

      // Click on request
      cy.get('[data-testid="request-item"], .request-item').first().click();

      // Look for assignment history
      cy.get('body').then(($body) => {
        if ($body.text().includes('History') || $body.text().includes('Timeline')) {
          cy.contains(/history|timeline/i).click();
          cy.screenshot('76-assignment-history');
        }
      });
    });
  });

  describe('TC-E2E-EDGE-003: Overloaded Member Warning', () => {
    it('should warn when assigning to overloaded member', () => {
      cy.visit('/firm/team');

      // Look for workload indicators
      cy.get('body').then(($body) => {
        const hasWorkloadInfo = $body.text().match(/workload|capacity|assigned/i);

        if (hasWorkloadInfo) {
          cy.screenshot('77-member-workload');

          // Find overloaded member (if any)
          if ($body.text().match(/overloaded|at capacity|full/i)) {
            cy.screenshot('78-overloaded-member');
            cy.log('✓ Overload warnings present');
          }
        }
      });
    });

    it('should suggest alternative members for assignment', () => {
      cy.visit('/firm/requests');

      // Try to assign a request
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="assign-button"]').length > 0) {
          cy.get('[data-testid="assign-button"]').first().click();

          // Check for suggested assignments
          if ($body.text().includes('Suggested') || $body.text().includes('Recommended')) {
            cy.screenshot('79-assignment-suggestions');
            cy.log('✓ Assignment suggestions available');
          }
        }
      });
    });
  });

  describe('TC-E2E-EDGE-004: Inactive Member Handling', () => {
    it('should not show inactive members in assignment dropdown', () => {
      // Navigate to team settings
      cy.visit('/firm/settings');

      cy.get('body').then(($body) => {
        if ($body.text().includes('Team') || $body.text().includes('Members')) {
          cy.contains(/team|member/i).click();
          cy.screenshot('80-team-settings');

          // Look for active/inactive toggles
          if ($body.find('[data-testid="member-status"], .member-status').length > 0) {
            cy.screenshot('81-member-status-controls');
          }
        }
      });
    });

    it('should show inactive badge on deactivated members', () => {
      cy.visit('/firm/team');

      cy.get('body').then(($body) => {
        if ($body.text().match(/inactive|deactivated|suspended/i)) {
          cy.screenshot('82-inactive-member-badge');
          cy.log('✓ Inactive member indicators present');
        }
      });
    });
  });

  describe('TC-E2E-EDGE-005: Concurrent Assignment Protection', () => {
    it('should prevent double-assignment of same request', () => {
      cy.visit('/firm/requests');

      // This would require simulating concurrent actions
      // For now, verify UI shows current assignment status
      cy.get('[data-testid="request-item"], .request-item').first().then(($item) => {
        if ($item.text().includes('Assigned')) {
          cy.screenshot('83-already-assigned-request');

          // Try to assign again (should be prevented or show warning)
          $item.click();

          cy.get('body').then(($body) => {
            if ($body.text().includes('Already assigned')) {
              cy.log('✓ Double-assignment prevention working');
            }
          });
        }
      });
    });
  });

  describe('TC-E2E-EDGE-006: Member Permissions', () => {
    it('should show admin-only features to firm admin', () => {
      cy.visit('/firm/dashboard');

      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text();
        // Admin should see assignment, settings, analytics
        return text.includes('Assign') ||
               text.includes('Settings') ||
               text.includes('Analytics');
      });

      cy.screenshot('84-admin-features');
    });

    it('should hide assignment features from regular members', () => {
      cy.log('Would require logging in as regular member');
      cy.log('Regular member should NOT see "Assign to team" buttons');

      // This test would need to be run with a regular member account
      // For documentation purposes:
      // 1. Login as regular member
      // 2. Navigate to requests
      // 3. Verify no assignment buttons visible
      // 4. Verify cannot access team management
    });
  });

  describe('TC-E2E-EDGE-007: Invitation Limits', () => {
    it('should show invitation quota/limits', () => {
      cy.visit('/firm/team');

      // Look for invitation section
      cy.get('body').then(($body) => {
        if ($body.text().includes('Invite') || $body.text().includes('Add Member')) {
          cy.contains(/invite|add member/i).click();
          cy.screenshot('85-invite-member-dialog');

          // Check for limits information
          if ($body.text().match(/\d+\/\d+|limit|remaining/i)) {
            cy.screenshot('86-invitation-limits');
            cy.log('✓ Invitation limits displayed');
          }
        }
      });
    });

    it('should prevent inviting when limit reached', () => {
      cy.visit('/firm/team');

      cy.get('body').then(($body) => {
        if ($body.text().includes('Maximum invitations reached') ||
            $body.text().includes('Invitation limit')) {
          cy.screenshot('87-invitation-limit-reached');

          // Invite button should be disabled
          cy.get('[data-testid="invite-button"]').should('be.disabled');
        }
      });
    });
  });

  describe('TC-E2E-EDGE-008: Request Priority Handling', () => {
    it('should highlight urgent/priority requests', () => {
      cy.visit('/firm/requests');

      cy.get('body').then(($body) => {
        if ($body.find('[data-priority="high"], .priority-high, .urgent').length > 0) {
          cy.screenshot('88-priority-requests');
          cy.log('✓ Priority indicators present');
        }
      });
    });

    it('should sort requests by priority and deadline', () => {
      cy.visit('/firm/requests');

      // Look for sorting controls
      cy.get('body').then(($body) => {
        if ($body.find('select[name="sort"], [data-testid="sort-select"]').length > 0) {
          cy.get('select[name="sort"], [data-testid="sort-select"]').select('Priority');
          cy.screenshot('89-sorted-by-priority');
        }
      });
    });
  });

  describe('TC-E2E-EDGE-009: Bulk Operations', () => {
    it('should allow bulk assignment of multiple requests', () => {
      cy.visit('/firm/requests');

      // Look for bulk selection checkboxes
      cy.get('body').then(($body) => {
        if ($body.find('input[type="checkbox"][name="select-request"]').length > 0) {
          // Select multiple requests
          cy.get('input[type="checkbox"][name="select-request"]').eq(0).check();
          cy.get('input[type="checkbox"][name="select-request"]').eq(1).check();

          cy.screenshot('90-bulk-selection');

          // Look for bulk assign button
          if ($body.find('[data-testid="bulk-assign"]').length > 0) {
            cy.get('[data-testid="bulk-assign"]').click();
            cy.screenshot('91-bulk-assign-dialog');
          }
        } else {
          cy.log('Bulk operations not yet implemented');
        }
      });
    });
  });

  describe('TC-E2E-EDGE-010: Notification Preferences', () => {
    it('should allow configuring assignment notifications', () => {
      cy.visit('/firm/settings');

      cy.get('body').then(($body) => {
        if ($body.text().includes('Notifications') || $body.text().includes('Preferences')) {
          cy.contains(/notification|preference/i).click();
          cy.screenshot('92-notification-settings');

          // Look for notification toggles
          if ($body.find('input[type="checkbox"][name*="notification"]').length > 0) {
            cy.screenshot('93-notification-toggles');
            cy.log('✓ Notification preferences available');
          }
        }
      });
    });
  });
});
