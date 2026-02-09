/**
 * E2E Tests - User Registration Flow
 */

import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should register a new client successfully', async ({ page }) => {
    // Fill registration form
    await page.fill('input[name="name"]', 'Test Client');
    await page.fill('input[name="email"]', `client${Date.now()}@test.com`);
    await page.fill('input[name="password"]', 'ValidPassword@24!');
    await page.fill('input[name="confirmPassword"]', 'ValidPassword@24!');
    await page.fill('input[name="phoneNumber"]', '9876543210');
    await page.selectOption('select[name="role"]', 'CLIENT');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success and redirect
    await page.waitForURL('/dashboard');

    // Verify dashboard is loaded
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('.user-role')).toContainText('CLIENT');
  });

  test('should register a new CA successfully', async ({ page }) => {
    // Fill registration form
    await page.fill('input[name="name"]', 'Test CA');
    await page.fill('input[name="email"]', `ca${Date.now()}@test.com`);
    await page.fill('input[name="password"]', 'ValidPassword@24!');
    await page.fill('input[name="confirmPassword"]', 'ValidPassword@24!');
    await page.fill('input[name="phoneNumber"]', '9876543211');
    await page.selectOption('select[name="role"]', 'CA');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success and redirect
    await page.waitForURL('/ca/profile-setup');

    // Verify profile setup page
    await expect(page.locator('h1')).toContainText('Complete Your Profile');
  });

  test('should show validation errors for invalid data', async ({ page }) => {
    // Try to submit without filling
    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('required');
  });

  test('should show error for weak password', async ({ page }) => {
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${Date.now()}@test.com`);
    await page.fill('input[name="password"]', '123');
    await page.fill('input[name="confirmPassword"]', '123');
    await page.selectOption('select[name="role"]', 'CLIENT');

    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('Password must be at least');
  });

  test('should show error for mismatched passwords', async ({ page }) => {
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${Date.now()}@test.com`);
    await page.fill('input[name="password"]', 'ValidPassword@24!');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword@97!');
    await page.selectOption('select[name="role"]', 'CLIENT');

    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('Passwords do not match');
  });

  test('should show error for duplicate email', async ({ page }) => {
    const email = `duplicate${Date.now()}@test.com`;

    // Register first time
    await page.fill('input[name="name"]', 'Test User 1');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'ValidPassword@24!');
    await page.fill('input[name="confirmPassword"]', 'ValidPassword@24!');
    await page.selectOption('select[name="role"]', 'CLIENT');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');

    // Logout and try to register again with same email
    await page.click('button.logout');
    await page.goto('/register');

    await page.fill('input[name="name"]', 'Test User 2');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'ValidPassword@24!');
    await page.fill('input[name="confirmPassword"]', 'ValidPassword@24!');
    await page.selectOption('select[name="role"]', 'CLIENT');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('already exists');
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]');
    const toggleButton = page.locator('button.toggle-password');

    // Initially should be type="password"
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle
    await toggleButton.click();

    // Should become type="text"
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again
    await toggleButton.click();

    // Should go back to password
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="name"]', 'Test User');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('valid email');
  });

  test('should validate phone number format', async ({ page }) => {
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${Date.now()}@test.com`);
    await page.fill('input[name="password"]', 'ValidPassword@24!');
    await page.fill('input[name="confirmPassword"]', 'ValidPassword@24!');
    await page.fill('input[name="phoneNumber"]', '123'); // Invalid
    await page.selectOption('select[name="role"]', 'CLIENT');

    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('valid phone number');
  });

  test('should have link to login page', async ({ page }) => {
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toContainText('Login');
  });

  test('should show terms and conditions', async ({ page }) => {
    const termsCheckbox = page.locator('input[name="agreeToTerms"]');
    await expect(termsCheckbox).toBeVisible();

    const termsLink = page.locator('a[href="/terms"]');
    await expect(termsLink).toBeVisible();
  });
});
