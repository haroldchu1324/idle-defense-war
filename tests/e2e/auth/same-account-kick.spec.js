/**
 * Same-account double-login / kick test.
 *
 * When Account A is already logged in on Tab 1 and then logs into Tab 2,
 * the game's expected behaviour is:
 *   - Tab 2 succeeds and loads the game.
 *   - Tab 1 is kicked via a Supabase Realtime broadcast and returns to the
 *     login screen with the message:
 *     "⚠️ You were logged out because this account was opened in another tab."
 *
 * The kick mechanism uses Supabase Realtime (WebSocket through the server),
 * which works across separate browser contexts, making it testable here.
 *
 * Timing note: Realtime subscription + broadcast latency typically takes
 * 3–10 seconds. The test allows up to 40 seconds.
 */

const { test, expect } = require('@playwright/test');

const EMAIL    = process.env.TEST_EMAIL_A;
const PASSWORD = process.env.TEST_PASSWORD_A;

const KICKED_MSG = 'You were logged out because this account was opened in another tab';

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'TEST_EMAIL_A and TEST_PASSWORD_A must be set in .env.test for the kick test.'
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
test('same-account kick — Tab 2 loads the game and Tab 1 is kicked', async ({ browser }) => {
  // ── Tab 1: login as Account A ──────────────────────────────────────────────
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();

  await page1.goto('/');
  await page1.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
  await page1.fill('#login-email', EMAIL);
  await page1.fill('#login-password', PASSWORD);
  await page1.click('#login-btn');
  await page1.waitForSelector('#game.visible', { timeout: 35_000 });

  // Give Tab 1's Supabase Realtime subscription time to fully establish
  // before Tab 2 connects and sends the kick broadcast.
  await page1.waitForTimeout(3_000);

  // ── Tab 2: login as the SAME Account A ────────────────────────────────────
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();

  await page2.goto('/');
  await page2.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
  await page2.fill('#login-email', EMAIL);
  await page2.fill('#login-password', PASSWORD);
  await page2.click('#login-btn');

  // Tab 2 must successfully load the game
  await page2.waitForSelector('#game.visible', { timeout: 35_000 });
  await expect(page2.locator('#game')).toBeVisible();

  // ── Tab 1 must be kicked ───────────────────────────────────────────────────
  // Wait for the auth layer to reappear on Tab 1
  await page1.waitForSelector('#auth-layer.visible', { timeout: 40_000 });
  await expect(page1.locator('#auth-layer')).toBeVisible();

  // The kicked message must be present
  const msg = await page1.locator('#login-msg').textContent();
  expect(msg).toContain(KICKED_MSG);

  // Clean up
  try { await page2.click('.logout-btn'); } catch { /* ignore */ }
  await ctx1.close();
  await ctx2.close();
});
