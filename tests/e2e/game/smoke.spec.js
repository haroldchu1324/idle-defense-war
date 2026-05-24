/**
 * In-game smoke tests.
 *
 * These verify that core game panels render and navigation works after login.
 * They do NOT test game logic — only that the UI builds without crashing
 * and the expected DOM structure is present.
 *
 * All tests in this file use the email account (TEST_EMAIL_A) so no guest
 * cleanup is needed.
 */

const { test, expect } = require('@playwright/test');
const { loginWithEmail, logout } = require('../../helpers/auth');

const EMAIL    = process.env.TEST_EMAIL_A;
const PASSWORD = process.env.TEST_PASSWORD_A;

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error('TEST_EMAIL_A and TEST_PASSWORD_A must be set in .env.test for smoke tests.');
  }
});

// Capture uncaught JS exceptions so any test can detect page crashes
test.beforeEach(async ({ page }) => {
  page.on('pageerror', err => {
    // Re-throw as a test failure — a real JS error means something broke
    throw new Error(`[pageerror] ${err.message}`);
  });
});

test.afterEach(async ({ page }) => {
  try {
    if (await page.locator('#game.visible').isVisible()) {
      await page.click('.logout-btn');
    }
  } catch { /* already logged out */ }
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — no uncaught JS errors during login and game load', async ({ page }) => {
  // pageerror listener is already attached in beforeEach
  // If any uncaught error fires, the listener throws and fails the test
  await loginWithEmail(page, EMAIL, PASSWORD);
  await expect(page.locator('#game')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — resources panel renders with node cards', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  // Resources is the default tab after login
  const panel = page.locator('#resources-panel');
  await expect(panel).toBeVisible();

  // buildResourcesPanel() populates the panel — there must be at least 1 child
  const childCount = await panel.locator('> *').count();
  expect(childCount).toBeGreaterThan(0);
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — resource pills in the top bar show values', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  for (const res of ['wood', 'stone', 'fiber', 'leather', 'ore']) {
    const pill = page.locator(`#pill-${res}`);
    await expect(pill).toBeVisible();
    const text = await pill.textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — research panel renders after switching to Research tab', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  // Click the Research tab
  await page.click('button:has-text("Research")');

  const panel = page.locator('#research-panel');
  await expect(panel).toBeVisible();

  // buildResearchPanel() populates it
  const childCount = await panel.locator('> *').count();
  expect(childCount).toBeGreaterThan(0);
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — inventory/armory panel renders after switching to Inventory tab', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  await page.click('button:has-text("Inventory")');

  // Armory grid must be present (may be empty for a fresh account)
  const armoryGrid = page.locator('#armory-grid');
  await expect(armoryGrid).toBeVisible();

  // Slot count display must be visible
  await expect(page.locator('#armory-slot-count')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — crafting panel renders after switching to Crafting tab', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  await page.click('button:has-text("Crafting")');

  // Tower grid must be present
  const towerGrid = page.locator('#tower-grid');
  await expect(towerGrid).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — campaign map renders after clicking the Campaign nav button', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  await page.click('#nav-campaign');

  // section-campaign must become visible
  await expect(page.locator('#section-campaign')).toBeVisible();

  // buildCampaignMap() populates #campaign-map
  const map = page.locator('#campaign-map');
  await expect(map).toBeVisible();
  const childCount = await map.locator('> *').count();
  expect(childCount).toBeGreaterThan(0);
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — alliance section opens without crashing', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  await page.click('#nav-alliance');

  // section-alliance must become visible
  await expect(page.locator('#section-alliance')).toBeVisible();

  // al-content is populated by initAlliance() — wait briefly for async init
  await page.waitForTimeout(2_000);
  const alContent = page.locator('#al-content');
  await expect(alContent).toBeVisible();
  const childCount = await alContent.locator('> *').count();
  expect(childCount).toBeGreaterThan(0);
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — PvP section opens and shows the world map (or lock overlay for guest)', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  await page.click('#nav-pvp');

  await expect(page.locator('#section-pvp')).toBeVisible();

  // For a registered (non-guest) account, the guest lock must NOT be shown
  const lockEl = page.locator('#pvp-guest-lock');
  const lockActive = await lockEl.evaluate(el => el.classList.contains('active'));
  expect(lockActive).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
test('smoke — navigation between Base, Campaign, and Alliance does not crash', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  // Base → Campaign
  await page.click('#nav-campaign');
  await expect(page.locator('#section-campaign')).toBeVisible();

  // Campaign → Alliance
  await page.click('#nav-alliance');
  await expect(page.locator('#section-alliance')).toBeVisible();

  // Alliance → Base
  await page.click('#nav-base');
  await expect(page.locator('#section-base')).toBeVisible();

  // Still in game — no crash
  await expect(page.locator('#game')).toBeVisible();
});
