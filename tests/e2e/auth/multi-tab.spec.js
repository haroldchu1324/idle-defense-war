/**
 * Multi-tab / multi-account isolation tests.
 *
 * Each browser context = a fully isolated "tab" with its own sessionStorage,
 * cookies, and localStorage. This mirrors the real browser behaviour where
 * each browser tab has its own sessionStorage (the game uses this for auth).
 *
 * BroadcastChannel LIMITATION:
 * BroadcastChannel only crosses contexts within the same browsing-context-group.
 * Playwright creates separate contexts with no shared message bus, so the
 * BroadcastChannel-based logout filter (which prevents Account A's logout from
 * affecting Account B) cannot be exercised here. These tests instead verify
 * that the sessions are architecturally independent.
 * The BroadcastChannel filter is covered by manual QA (see QA_TESTING.md).
 */

const { test, expect } = require('@playwright/test');

const EMAIL_A    = process.env.TEST_EMAIL_A;
const PASSWORD_A = process.env.TEST_PASSWORD_A;
const EMAIL_B    = process.env.TEST_EMAIL_B;
const PASSWORD_B = process.env.TEST_PASSWORD_B;

test.beforeAll(() => {
  if (!EMAIL_A || !PASSWORD_A || !EMAIL_B || !PASSWORD_B) {
    throw new Error(
      'TEST_EMAIL_A/B and TEST_PASSWORD_A/B must be set in .env.test for multi-tab tests.'
    );
  }
});

// Helper: login in a given page using email credentials
async function loginInPage(page, email, password) {
  await page.goto('/');
  await page.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  await page.waitForSelector('#game.visible', { timeout: 35_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
test('multi-tab — Account A and Account B remain independent across contexts', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    // Log both accounts in concurrently
    await Promise.all([
      loginInPage(pageA, EMAIL_A, PASSWORD_A),
      loginInPage(pageB, EMAIL_B, PASSWORD_B),
    ]);

    // Both games must be visible
    await expect(pageA.locator('#game')).toBeVisible();
    await expect(pageB.locator('#game')).toBeVisible();

    // Each tab must show a different username — confirms sessions are independent
    const usernameA = await pageA.locator('#username-display').textContent();
    const usernameB = await pageB.locator('#username-display').textContent();
    expect(usernameA.trim().length).toBeGreaterThan(0);
    expect(usernameB.trim().length).toBeGreaterThan(0);
    // They should be different accounts
    expect(usernameA.trim()).not.toBe(usernameB.trim());
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
test('multi-tab — logging out of Account A does not affect Account B', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    await Promise.all([
      loginInPage(pageA, EMAIL_A, PASSWORD_A),
      loginInPage(pageB, EMAIL_B, PASSWORD_B),
    ]);

    // Sign out of Account A
    await pageA.click('.logout-btn');
    await pageA.waitForSelector('#auth-layer.visible', { timeout: 15_000 });

    // Confirm Account A is on the login screen
    await expect(pageA.locator('#screen-login')).toBeVisible();

    // Account B must still be in the game — unaffected
    await expect(pageB.locator('#game')).toBeVisible();
    await expect(pageB.locator('#auth-layer')).not.toBeVisible();
  } finally {
    // Clean up: logout B
    try { await pageB.click('.logout-btn'); } catch { /* ignore */ }
    await ctxA.close();
    await ctxB.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
test('multi-tab — logging out of Account B does not affect Account A', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    await Promise.all([
      loginInPage(pageA, EMAIL_A, PASSWORD_A),
      loginInPage(pageB, EMAIL_B, PASSWORD_B),
    ]);

    // Sign out of Account B
    await pageB.click('.logout-btn');
    await pageB.waitForSelector('#auth-layer.visible', { timeout: 15_000 });

    // Account A must still be in the game
    await expect(pageA.locator('#game')).toBeVisible();
    await expect(pageA.locator('#auth-layer')).not.toBeVisible();
  } finally {
    try { await pageA.click('.logout-btn'); } catch { /* ignore */ }
    await ctxA.close();
    await ctxB.close();
  }
});
