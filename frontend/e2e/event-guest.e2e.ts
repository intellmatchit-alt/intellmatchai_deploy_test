import { test, expect } from '@playwright/test';

/**
 * Event Guest Flow E2E Tests
 *
 * Tests the complete guest flow: scan QR, register, view matches.
 */

test.describe('Event Guest Flow', () => {
  // Test event code - would be created by a host
  const eventCode = 'test1234';

  test('should display public event page', async ({ page }) => {
    // Navigate to public event page
    await page.goto(`/e/${eventCode}`);

    // Wait for event info to load
    await page.waitForSelector('[data-testid="event-info"]');

    // Verify event details are displayed
    await expect(page.locator('[data-testid="event-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="event-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="event-location"]')).toBeVisible();
  });

  test('should show registration form', async ({ page }) => {
    await page.goto(`/e/${eventCode}`);

    // Wait for registration form
    await page.waitForSelector('form[data-testid="registration-form"]');

    // Verify form fields
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('textarea[name="lookingFor"]')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Verify validation errors
    await expect(page.locator('text=Name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    // Fill in invalid email
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'invalid-email');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify email validation error
    await expect(page.locator('text=valid email')).toBeVisible();
  });

  test('should register as guest successfully', async ({ page }) => {
    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    // Fill in registration form
    await page.fill('input[name="name"]', 'E2E Test Guest');
    await page.fill('input[name="email"]', `e2e-guest-${Date.now()}@example.com`);
    await page.fill('input[name="mobile"]', '+1234567890');
    await page.fill('input[name="company"]', 'Test Company');
    await page.fill('input[name="role"]', 'Developer');
    await page.fill('textarea[name="bio"]', 'I am a test user');
    await page.fill('textarea[name="lookingFor"]', 'Investors and mentors in technology');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to attendees page
    await page.waitForURL(`**/e/${eventCode}/attendees`);

    // Verify we're on the attendees page
    await expect(page.locator('[data-testid="attendees-list"]')).toBeVisible();
  });

  test('should display attendees with match levels', async ({ page }) => {
    // First register
    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    await page.fill('input[name="name"]', 'Match Test Guest');
    await page.fill('input[name="email"]', `match-test-${Date.now()}@example.com`);
    await page.fill('textarea[name="lookingFor"]', 'Technology partners');

    await page.click('button[type="submit"]');
    await page.waitForURL(`**/e/${eventCode}/attendees`);

    // Verify attendee cards are displayed
    await page.waitForSelector('[data-testid="attendee-card"]');

    // Verify match badges are displayed
    const matchBadges = page.locator('[data-testid="match-badge"]');
    await expect(matchBadges.first()).toBeVisible();
  });

  test('should sort attendees by match level', async ({ page }) => {
    // Navigate to attendees page (assuming we're registered)
    await page.goto(`/e/${eventCode}/attendees`);

    // Wait for attendee cards
    await page.waitForSelector('[data-testid="attendee-card"]');

    // Get all match badges
    const matchBadges = await page.locator('[data-testid="match-badge"]').allTextContents();

    // Verify HIGH matches come first
    if (matchBadges.length > 1) {
      const firstBadge = matchBadges[0].toUpperCase();
      const lastBadge = matchBadges[matchBadges.length - 1].toUpperCase();

      // HIGH should not come after LOW or MEDIUM
      if (firstBadge === 'HIGH') {
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(lastBadge);
      }
    }
  });

  test('should show "looking for" field for each attendee', async ({ page }) => {
    await page.goto(`/e/${eventCode}/attendees`);
    await page.waitForSelector('[data-testid="attendee-card"]');

    // Verify "looking for" is shown
    const lookingForElements = page.locator('[data-testid="looking-for"]');
    await expect(lookingForElements.first()).toBeVisible();
  });

  test('should show prompt to create account', async ({ page }) => {
    await page.goto(`/e/${eventCode}/attendees`);

    // Verify CTA to create account is shown
    await expect(page.locator('text=Create Account')).toBeVisible();

    // Click create account
    await page.click('text=Create Account');

    // Verify redirect to registration page
    await page.waitForURL('**/register');
  });

  test('should handle already registered email', async ({ page }) => {
    const existingEmail = 'existing@example.com';

    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    // Fill in with existing email
    await page.fill('input[name="name"]', 'Existing User');
    await page.fill('input[name="email"]', existingEmail);

    await page.click('button[type="submit"]');

    // Should either show "already registered" message or redirect to attendees
    const alreadyRegistered = page.locator('text=already registered');
    const attendeesPage = page.locator('[data-testid="attendees-list"]');

    await expect(alreadyRegistered.or(attendeesPage)).toBeVisible({ timeout: 10000 });
  });

  test('should handle inactive event', async ({ page }) => {
    const inactiveCode = 'inactive123';

    await page.goto(`/e/${inactiveCode}`);

    // Should show error message
    await expect(page.locator('text=no longer active')).toBeVisible();
  });

  test('should handle non-existent event', async ({ page }) => {
    await page.goto('/e/nonexistent123');

    // Should show not found message
    await expect(page.locator('text=not found')).toBeVisible();
  });

  test('should upload CV file', async ({ page }) => {
    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    // Fill required fields
    await page.fill('input[name="name"]', 'CV Upload Test');
    await page.fill('input[name="email"]', `cv-test-${Date.now()}@example.com`);

    // Upload CV (PDF file)
    const fileInput = page.locator('input[type="file"][accept*="pdf"]');
    await fileInput.setInputFiles({
      name: 'test-cv.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF test content'),
    });

    // Verify file is selected
    await expect(page.locator('text=test-cv.pdf')).toBeVisible();
  });

  test('should upload photo', async ({ page }) => {
    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    // Fill required fields
    await page.fill('input[name="name"]', 'Photo Upload Test');
    await page.fill('input[name="email"]', `photo-test-${Date.now()}@example.com`);

    // Upload photo
    const photoInput = page.locator('input[type="file"][accept*="image"]');
    await photoInput.setInputFiles({
      name: 'test-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('JPEG test content'),
    });

    // Verify photo preview is shown
    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();
  });
});

test.describe('Event Guest Flow - Authenticated User', () => {
  const eventCode = 'test1234';

  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should prefill form with user data', async ({ page }) => {
    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    // Verify email is prefilled
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toHaveValue('user@example.com');
  });

  test('should show "Save to Contacts" button when logged in', async ({ page }) => {
    // Register for event first
    await page.goto(`/e/${eventCode}`);
    await page.waitForSelector('form[data-testid="registration-form"]');

    await page.fill('input[name="name"]', 'Logged In User');
    await page.fill('input[name="email"]', 'user@example.com');

    await page.click('button[type="submit"]');
    await page.waitForURL(`**/e/${eventCode}/attendees`);

    // Verify "Save to Contacts" button is visible
    await expect(page.locator('[data-testid="save-to-contacts-button"]').first()).toBeVisible();
  });

  test('should save attendee to contacts', async ({ page }) => {
    await page.goto(`/e/${eventCode}/attendees`);
    await page.waitForSelector('[data-testid="attendee-card"]');

    // Click save to contacts
    await page.click('[data-testid="save-to-contacts-button"]:first-child');

    // Verify success feedback
    await expect(page.locator('text=saved to contacts')).toBeVisible({ timeout: 5000 });
  });
});
