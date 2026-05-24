const { test, expect } = require('@playwright/test');
const { loginWithEmail, logout, gotoLogin } = require('../../helpers/auth');

const EMAIL    = process.env.TEST_EMAIL_A;
const PASSWORD = process.env.TEST_PASSWORD_A;

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'TEST_EMAIL_A and TEST_PASSWORD_A must be set in .env.test before running email-login tests.'
    );
  }
});

// Always sign out after each test so the next test starts clean
test.afterEach(async ({ page }) => {
  // Best-effort logout — ignore errors if already on auth screen
  try {
    const gameVisible = await page.locator('#game.visible').isVisible();
    if (gameVisible) await page.click('.logout-btn');
  } catch { /* already logged out */ }
});

// ─────────────────────────────────────────────────────────────────────────────
test('email login — correct credentials load the game', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await expect(page.locator('#game')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('email login — username display is populated after login', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const username = await page.locator('#username-display').textContent();
  expect(username.trim().length).toBeGreaterThan(0);

  // Guest banner must NOT be visible for a real account
  const guestBanner = page.locator('#guest-banner');
  const bannerDisplay = await guestBanner.evaluate(el => el.style.display);
  expect(bannerDisplay).toBe('none');
});

// ─────────────────────────────────────────────────────────────────────────────
test('email login — wrong password shows an error, does not load game', async ({ page }) => {
  await gotoLogin(page);
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', 'WRONG_PASSWORD_FOR_QA_TEST');
  await page.click('#login-btn');

  // Error message must appear
  await expect(page.locator('#login-msg')).toBeVisible();
  const msg = await page.locator('#login-msg').textContent();
  expect(msg.trim().length).toBeGreaterThan(0);

  // Game must NOT appear
  await expect(page.locator('#game.visible')).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('email logout — Sign out returns to the login screen', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  await logout(page);

  await expect(page.locator('#auth-layer')).toBeVisible();
  await expect(page.locator('#screen-login')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('email logout then re-login — can log back in after signing out', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await logout(page);

  // Login a second time in the same tab
  await loginWithEmail(page, EMAIL, PASSWORD);
  await expect(page.locator('#game')).toBeVisible();
});
