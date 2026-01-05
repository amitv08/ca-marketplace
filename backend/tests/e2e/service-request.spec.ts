/**
 * E2E Tests - Service Request Flow
 */

import { test, expect } from '@playwright/test';

test.describe('Service Request Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as client
    await page.goto('/login');
    await page.fill('input[name="email"]', 'client1@test.com');
    await page.fill('input[name="password"]', 'Client@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new service request', async ({ page }) => {
    // Navigate to create service request
    await page.click('a[href="/service-requests/new"]');
    await page.waitForURL('/service-requests/new');

    // Fill service request form
    await page.fill('input[name="title"]', 'Tax Filing for FY 2024');
    await page.fill('textarea[name="description"]', 'Need help with annual tax filing for financial year 2023-24');
    await page.selectOption('select[name="serviceType"]', 'TAX_FILING');
    await page.fill('input[name="budget"]', '15000');
    await page.fill('input[name="deadline"]', '2024-04-30');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success and redirect
    await page.waitForURL(/\/service-requests\/[a-f0-9-]+/);

    // Verify service request details page
    await expect(page.locator('h1')).toContainText('Tax Filing for FY 2024');
    await expect(page.locator('.status')).toContainText('PENDING');
    await expect(page.locator('.budget')).toContainText('15000');
  });

  test('should show validation errors for incomplete form', async ({ page }) => {
    await page.click('a[href="/service-requests/new"]');
    await page.waitForURL('/service-requests/new');

    // Try to submit without filling
    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should validate title length', async ({ page }) => {
    await page.click('a[href="/service-requests/new"]');
    await page.waitForURL('/service-requests/new');

    await page.fill('input[name="title"]', 'Too');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('at least 5 characters');
  });

  test('should validate deadline is in future', async ({ page }) => {
    await page.click('a[href="/service-requests/new"]');
    await page.waitForURL('/service-requests/new');

    await page.fill('input[name="title"]', 'Test Service Request');
    await page.fill('textarea[name="description"]', 'Test description that meets minimum length requirements');
    await page.selectOption('select[name="serviceType"]', 'TAX_FILING');
    await page.fill('input[name="deadline"]', '2020-01-01');

    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('future');
  });

  test('should upload supporting documents', async ({ page }) => {
    await page.click('a[href="/service-requests/new"]');
    await page.waitForURL('/service-requests/new');

    await page.fill('input[name="title"]', 'Request with Documents');
    await page.fill('textarea[name="description"]', 'Service request with supporting documents attached');
    await page.selectOption('select[name="serviceType"]', 'AUDIT');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Test PDF content'),
    });

    // Verify file is uploaded
    await expect(page.locator('.uploaded-file')).toContainText('document.pdf');

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/service-requests\/[a-f0-9-]+/);
  });

  test('should allow editing pending service request', async ({ page }) => {
    // First create a request
    await page.click('a[href="/service-requests/new"]');
    await page.waitForURL('/service-requests/new');

    await page.fill('input[name="title"]', 'Editable Request');
    await page.fill('textarea[name="description"]', 'This request will be edited');
    await page.selectOption('select[name="serviceType"]', 'GST');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/service-requests\/[a-f0-9-]+/);

    // Edit the request
    await page.click('button.edit-request');

    await page.fill('input[name="title"]', 'Updated Request Title');
    await page.fill('input[name="budget"]', '20000');
    await page.click('button[type="submit"]');

    // Verify changes
    await expect(page.locator('h1')).toContainText('Updated Request Title');
    await expect(page.locator('.budget')).toContainText('20000');
  });

  test('should allow canceling service request', async ({ page }) => {
    // Navigate to service requests list
    await page.click('a[href="/service-requests"]');

    // Find a pending request
    const pendingRequest = page.locator('.request-card').filter({ hasText: 'PENDING' }).first();
    await pendingRequest.click();

    // Cancel the request
    await page.click('button.cancel-request');

    // Confirm cancellation
    await page.click('button.confirm-cancel');

    // Verify status changed
    await expect(page.locator('.status')).toContainText('CANCELLED');
  });

  test('should show list of service requests', async ({ page }) => {
    await page.click('a[href="/service-requests"]');

    // Verify list is displayed
    await expect(page.locator('.request-card')).toHaveCount(3); // Assuming 3+ requests

    // Verify pagination
    await expect(page.locator('.pagination')).toBeVisible();
  });

  test('should filter service requests by status', async ({ page }) => {
    await page.click('a[href="/service-requests"]');

    // Filter by status
    await page.selectOption('select[name="status"]', 'COMPLETED');
    await page.click('button.apply-filters');

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Verify all shown requests are completed
    const statuses = await page.locator('.request-card .status').allTextContents();
    statuses.forEach(status => {
      expect(status).toContain('COMPLETED');
    });
  });

  test('should search service requests', async ({ page }) => {
    await page.click('a[href="/service-requests"]');

    await page.fill('input[name="search"]', 'Tax Filing');
    await page.click('button.search');

    await page.waitForTimeout(500);

    // Verify search results
    const titles = await page.locator('.request-card .title').allTextContents();
    expect(titles.some(title => title.includes('Tax Filing'))).toBeTruthy();
  });
});

test.describe('CA Service Request Acceptance Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as CA
    await page.goto('/login');
    await page.fill('input[name="email"]', 'ca1@test.com');
    await page.fill('input[name="password"]', 'CA@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should browse pending service requests', async ({ page }) => {
    await page.click('a[href="/service-requests/browse"]');

    // Verify pending requests are shown
    await expect(page.locator('.request-card')).toHaveCount(3); // At least 1
    await expect(page.locator('.request-card .status')).toContainText('PENDING');
  });

  test('should accept a pending service request', async ({ page }) => {
    await page.click('a[href="/service-requests/browse"]');

    // Click on first pending request
    const firstRequest = page.locator('.request-card').first();
    await firstRequest.click();

    // Accept the request
    await page.click('button.accept-request');
    await page.click('button.confirm-accept');

    // Verify status changed
    await expect(page.locator('.status')).toContainText('ACCEPTED');

    // Verify CA is assigned
    await expect(page.locator('.assigned-ca')).toBeVisible();
  });

  test('should mark service request as in progress', async ({ page }) => {
    await page.click('a[href="/my-requests"]');

    // Click on an accepted request
    const acceptedRequest = page.locator('.request-card').filter({ hasText: 'ACCEPTED' }).first();
    await acceptedRequest.click();

    // Mark as in progress
    await page.click('button.mark-in-progress');

    // Verify status changed
    await expect(page.locator('.status')).toContainText('IN_PROGRESS');
  });

  test('should complete service request', async ({ page }) => {
    await page.click('a[href="/my-requests"]');

    // Click on an in-progress request
    const inProgressRequest = page.locator('.request-card').filter({ hasText: 'IN_PROGRESS' }).first();
    await inProgressRequest.click();

    // Complete the request
    await page.click('button.mark-completed');

    // Add completion notes
    await page.fill('textarea[name="completionNotes"]', 'Service completed successfully');
    await page.click('button.submit-completion');

    // Verify status changed
    await expect(page.locator('.status')).toContainText('COMPLETED');
  });
});
