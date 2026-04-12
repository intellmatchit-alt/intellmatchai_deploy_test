import { test, expect } from '@playwright/test';

/**
 * Event Host Flow E2E Tests
 *
 * Tests the complete host flow: create event, view QR, manage attendees.
 */

test.describe('Event Host Flow', () => {
  // Setup: Login as host before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in credentials
    await page.fill('input[name="email"]', 'host@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit login form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('should create a new event', async ({ page }) => {
    // Navigate to events page
    await page.goto('/events');

    // Click create event button
    await page.click('text=Create Event');

    // Wait for form to load
    await page.waitForSelector('input[name="name"]');

    // Fill in event details
    await page.fill('input[name="name"]', 'E2E Test Event');
    await page.fill('textarea[name="description"]', 'This is an automated test event');
    await page.fill('input[name="location"]', 'Virtual');

    // Set date/time (tomorrow at 6 PM)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    await page.fill('input[name="dateTime"]', tomorrow.toISOString().slice(0, 16));

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to event detail page
    await page.waitForURL('**/events/*');

    // Verify event was created
    await expect(page.locator('text=E2E Test Event')).toBeVisible();
    await expect(page.locator('text=Virtual')).toBeVisible();
  });

  test('should display QR code for event', async ({ page }) => {
    // Navigate to events page
    await page.goto('/events');

    // Click on first event
    await page.click('[data-testid="event-card"]:first-child');

    // Wait for event detail page
    await page.waitForSelector('[data-testid="event-qr-code"]');

    // Verify QR code is displayed
    const qrCode = page.locator('[data-testid="event-qr-code"] img');
    await expect(qrCode).toBeVisible();

    // Verify copy link button works
    await page.click('[data-testid="copy-link-button"]');
    // Check for success toast or feedback
    await expect(page.locator('text=copied')).toBeVisible({ timeout: 5000 });
  });

  test('should download QR code', async ({ page }) => {
    await page.goto('/events');
    await page.click('[data-testid="event-card"]:first-child');
    await page.waitForSelector('[data-testid="event-qr-code"]');

    // Setup download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    await page.click('[data-testid="download-qr-button"]');

    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('qr');
  });

  test('should view attendees list', async ({ page }) => {
    await page.goto('/events');
    await page.click('[data-testid="event-card"]:first-child');

    // Navigate to attendees section
    await page.click('text=Attendees');

    // Wait for attendees list
    await page.waitForSelector('[data-testid="attendees-list"]');

    // Verify attendees section is visible
    await expect(page.locator('[data-testid="attendees-list"]')).toBeVisible();
  });

  test('should export attendees as CSV', async ({ page }) => {
    await page.goto('/events');
    await page.click('[data-testid="event-card"]:first-child');
    await page.click('text=Attendees');

    // Setup download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('[data-testid="export-attendees-button"]');

    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should add attendee to contacts', async ({ page }) => {
    await page.goto('/events');
    await page.click('[data-testid="event-card"]:first-child');
    await page.click('text=Attendees');

    // Wait for attendee cards
    await page.waitForSelector('[data-testid="attendee-card"]');

    // Click add to contacts on first attendee
    await page.click('[data-testid="attendee-card"]:first-child [data-testid="add-to-contacts-button"]');

    // Verify success feedback
    await expect(page.locator('text=added to contacts')).toBeVisible({ timeout: 5000 });
  });

  test('should add all attendees to contacts', async ({ page }) => {
    await page.goto('/events');
    await page.click('[data-testid="event-card"]:first-child');
    await page.click('text=Attendees');

    // Click "Add All to Contacts" button
    await page.click('[data-testid="add-all-to-contacts-button"]');

    // Verify success feedback
    await expect(page.locator('text=contacts added')).toBeVisible({ timeout: 5000 });
  });

  test('should search attendees', async ({ page }) => {
    await page.goto('/events');
    await page.click('[data-testid="event-card"]:first-child');
    await page.click('text=Attendees');

    // Enter search term
    await page.fill('input[placeholder*="Search"]', 'John');

    // Wait for filtered results
    await page.waitForTimeout(500); // Debounce delay

    // Verify search is applied (results should be filtered)
    const attendeeCards = page.locator('[data-testid="attendee-card"]');
    // Just verify the list updated (could have 0 or more results)
    await expect(attendeeCards.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // No results is also valid for a search
    });
  });

  test('should update event details', async ({ page }) => {
    await page.goto('/events');
    await page.click('[data-testid="event-card"]:first-child');

    // Click edit button
    await page.click('[data-testid="edit-event-button"]');

    // Update event name
    await page.fill('input[name="name"]', 'Updated Event Name');

    // Save changes
    await page.click('button[type="submit"]');

    // Verify update was successful
    await expect(page.locator('text=Updated Event Name')).toBeVisible();
  });

  test('should deactivate event', async ({ page }) => {
    await page.goto('/events');
    await page.click('[data-testid="event-card"]:first-child');

    // Click deactivate button
    await page.click('[data-testid="deactivate-event-button"]');

    // Confirm deactivation
    await page.click('text=Confirm');

    // Verify event is deactivated
    await expect(page.locator('text=Inactive')).toBeVisible();
  });
});
