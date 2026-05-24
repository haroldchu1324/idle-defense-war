/**
 * Guest-to-email account linking tests.
 *
 * These tests verify the "Link Account" flow where a guest player
 * converts their temporary account into a permanent email account.
 *
 * LIMITATIONS:
 * - We cannot verify actual email delivery (the confirmation email).
 * - We cannot test logging back in with the new email because the
 *   account requires email confirmation first.
 * - A real-looking but disposable email is used for linking. The test
 *   account created by linking is deleted via the admin API in afterEach.
 *
 * CLEANUP:
 * The guest userId is captured before linking. After the test, that user
 * is deleted from Supabase regardless of whether linking succeeded.
 */

const { test, expect } = require('@playwright/test');
const { loginAsGuest, getGuestCache, clearLocalStorage } = require('../../helpers/auth');
const { deleteSupabaseUser } = require('../../helpers/admin');

let guestUserId = null;

test.afterEach(async ({ page }) => {
  if (guestUserId) {
    await deleteSupabaseUser(guestUserId);
    guestUserId = null;
  }
  await clearLocalStorage(page);
});

// Helper: generate a unique test email for each run
function makeTestLinkEmail() {
  return `idw-qa-link-${Date.now()}@example.com`;
}

// ─────────────────────────────────────────────────────────────────────────────
test('guest link — "Link account" button opens the link modal', async ({ page }) => {
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;

  // The guest banner has a "Link account to save progress" link
  await expect(page.locator('#guest-banner')).toBeVisible();
  await page.click('#guest-banner a');

  // The link account modal must open
  await expect(page.locator('#link-account-modal')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('guest link — modal contains all required form fields', async ({ page }) => {
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;

  await page.evaluate(() => openLinkAccountModal());
  await expect(page.locator('#link-account-modal')).toBeVisible();

  await expect(page.locator('#link-username')).toBeVisible();
  await expect(page.locator('#link-email')).toBeVisible();
  await expect(page.locator('#link-email-confirm')).toBeVisible();
  await expect(page.locator('#link-password')).toBeVisible();
  await expect(page.locator('#link-password-confirm')).toBeVisible();
  await expect(page.locator('#link-btn')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('guest link — submitting valid details shows a success message', async ({ page }) => {
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;

  const testEmail    = makeTestLinkEmail();
  const testPassword = 'QaTest123!';
  const testUsername = 'QA_Link_Test';

  await page.evaluate(() => openLinkAccountModal());
  await expect(page.locator('#link-account-modal')).toBeVisible();

  await page.fill('#link-username',       testUsername);
  await page.fill('#link-email',          testEmail);
  await page.fill('#link-email-confirm',  testEmail);
  await page.fill('#link-password',       testPassword);
  await page.fill('#link-password-confirm', testPassword);
  await page.click('#link-btn');

  // Wait until the success message contains the email address.
  // toContainText retries until the RPC completes — the intermediate
  // "Linking account…" text is skipped automatically.
  await expect(page.locator('#link-msg')).toContainText(testEmail, { timeout: 15_000 });
  // Must not be an error class
  const msgClass = await page.locator('#link-msg').getAttribute('class');
  expect(msgClass).not.toContain('error');
});

// ─────────────────────────────────────────────────────────────────────────────
test('guest link — after linking, guest cache is cleared and user returns to login screen', async ({ page }) => {
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;

  const testEmail    = makeTestLinkEmail();
  const testPassword = 'QaTest123!';

  await page.evaluate(() => openLinkAccountModal());
  await page.fill('#link-username',         'QA_Link_Cleanup');
  await page.fill('#link-email',             testEmail);
  await page.fill('#link-email-confirm',     testEmail);
  await page.fill('#link-password',          testPassword);
  await page.fill('#link-password-confirm',  testPassword);
  await page.click('#link-btn');

  // Wait for the success message
  await expect(page.locator('#link-msg')).toBeVisible({ timeout: 15_000 });

  // doLinkAccount() calls doLogout() after 2 seconds — wait for auth layer
  await page.waitForSelector('#auth-layer.visible', { timeout: 15_000 });

  // Login screen must be shown
  await expect(page.locator('#screen-login')).toBeVisible();

  // Guest cache must be cleared (linking removes it)
  const leftoverCache = await page.evaluate(() => localStorage.getItem('idw_guest_cache'));
  expect(leftoverCache).toBeNull();

  // The login email field must be pre-filled with the linked email.
  // toHaveValue retries — the pre-fill happens after doLogout() resolves,
  // which is slightly after #auth-layer.visible first appears.
  await expect(page.locator('#login-email')).toHaveValue(testEmail, { timeout: 10_000 });
});
