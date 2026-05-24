const { test, expect } = require('@playwright/test');
const { gotoLogin, loginAsGuest, logout, getGuestCache, clearLocalStorage } = require('../../helpers/auth');
const { deleteSupabaseUser } = require('../../helpers/admin');

// Track guest userIds created in this file for cleanup
let guestUserId = null;

test.afterEach(async ({ page }) => {
  // Delete the guest account from Supabase so test data doesn't accumulate
  if (guestUserId) {
    await deleteSupabaseUser(guestUserId);
    guestUserId = null;
  }
  await clearLocalStorage(page);
});

// ─────────────────────────────────────────────────────────────────────────────
test('guest login — clicking Play as Guest launches the game', async ({ page }) => {
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;

  // Game wrapper must be visible
  await expect(page.locator('#game')).toBeVisible();

  // Username display must be populated (non-empty)
  const username = await page.locator('#username-display').textContent();
  expect(username.trim().length).toBeGreaterThan(0);

  // Guest banner must be showing (confirms isGuestUser flag is set)
  await expect(page.locator('#guest-banner')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('guest saved card — shows correct name and level after login', async ({ page }) => {
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;

  // The game should have written a guest cache entry with a username
  expect(cache.username).toBeTruthy();

  // Log out — the saved guest card should appear on the login screen
  await logout(page);

  // Guest saved panel must be visible
  await expect(page.locator('#guest-saved-panel')).toBeVisible();

  // Name shown in card must match what was stored in cache
  const displayedName = await page.locator('#guest-saved-name').textContent();
  expect(displayedName.trim()).toBe(cache.username);

  // Level must be "Level 1" (fresh account)
  const displayedLevel = await page.locator('#guest-saved-level').textContent();
  expect(displayedLevel).toContain('Level');
});

// ─────────────────────────────────────────────────────────────────────────────
test('guest logout — clicking Sign out returns to the login screen', async ({ page }) => {
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;

  await logout(page);

  // Auth layer must be visible
  await expect(page.locator('#auth-layer')).toBeVisible();

  // Login screen must be the active sub-screen
  await expect(page.locator('#screen-login')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('guest resume — clicking Continue on saved card loads the game', async ({ page }) => {
  // First login creates the saved card
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;

  await logout(page);

  // The saved guest panel should now be visible
  await expect(page.locator('#guest-saved-panel')).toBeVisible();

  // Click "Continue"
  await page.click('#guest-resume-btn');

  // Wait for the game to fully appear.
  // state:'attached' checks that #game has class 'visible' without an opacity
  // filter — the CSS transition (opacity 0→1 over 0.4s) would otherwise cause
  // a standard visibility check to flicker and time out.
  await page.waitForSelector('#game.visible', { state: 'attached', timeout: 35_000 });
  await expect(page.locator('#game')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('guest resume after logout — does not get stuck loading on second attempt', async ({ page }) => {
  // Login once, logout
  const cache = await loginAsGuest(page);
  guestUserId = cache.userId || null;
  await logout(page);

  // Resume — first resume
  await page.click('#guest-resume-btn');
  await page.waitForSelector('#game.visible', { state: 'attached', timeout: 35_000 });

  // Logout again
  await logout(page);

  // Resume a second time — must not hang
  await expect(page.locator('#guest-saved-panel')).toBeVisible();
  await page.click('#guest-resume-btn');
  await page.waitForSelector('#game.visible', { state: 'attached', timeout: 35_000 });

  await expect(page.locator('#game')).toBeVisible();
});
