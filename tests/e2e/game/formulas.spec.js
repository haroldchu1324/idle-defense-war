/**
 * Formula / pure-function sanity tests.
 *
 * These tests run in a real browser via Playwright's page.evaluate().
 * The game page is loaded but NOT logged in — the functions are available
 * globally as soon as game.js executes (before DOMContentLoaded).
 *
 * WHY browser evaluate and not Node unit tests:
 * All formula functions live as browser globals in game.js. Running them
 * through page.evaluate() tests the ACTUAL production code, not a copy.
 * If a formula is changed in game.js, these tests will detect it immediately.
 *
 * The tests use default game state (level 1, no research, no alliance)
 * to produce deterministic, predictable results.
 */

const { test, expect } = require('@playwright/test');

// Navigate once and reuse for all formula tests (no login needed)
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for DOMContentLoaded + game.js globals to be ready
  await page.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
});

// ─── xpForLevel ──────────────────────────────────────────────────────────────
test('formula — xpForLevel(1) returns 100', async ({ page }) => {
  const result = await page.evaluate(() => xpForLevel(1));
  expect(result).toBe(100);
});

test('formula — xpForLevel(2) returns 135', async ({ page }) => {
  const result = await page.evaluate(() => xpForLevel(2));
  expect(result).toBe(135);
});

test('formula — xpForLevel(5) returns 332', async ({ page }) => {
  // Math.floor(100 * 1.35^4) = Math.floor(332.15) = 332
  const result = await page.evaluate(() => xpForLevel(5));
  expect(result).toBe(332);
});

test('formula — xpForLevel grows with each level (monotonically increasing)', async ({ page }) => {
  const values = await page.evaluate(() =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => xpForLevel(n))
  );
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeGreaterThan(values[i - 1]);
  }
});

// ─── upgradeTimeSecs ─────────────────────────────────────────────────────────
test('formula — upgradeTimeSecs(1) returns 5 (minimum)', async ({ page }) => {
  const result = await page.evaluate(() => upgradeTimeSecs(1));
  expect(result).toBe(5);
});

test('formula — upgradeTimeSecs(2) returns 7', async ({ page }) => {
  // Math.max(5, Math.floor(5 * 1.4^1)) = Math.max(5, 7) = 7
  const result = await page.evaluate(() => upgradeTimeSecs(2));
  expect(result).toBe(7);
});

test('formula — upgradeTimeSecs(3) returns 9', async ({ page }) => {
  // Math.max(5, Math.floor(5 * 1.4^2)) = Math.max(5, Math.floor(9.8)) = 9
  const result = await page.evaluate(() => upgradeTimeSecs(3));
  expect(result).toBe(9);
});

test('formula — upgradeTimeSecs grows with each level', async ({ page }) => {
  const values = await page.evaluate(() =>
    [1, 2, 3, 4, 5, 6].map(n => upgradeTimeSecs(n))
  );
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  }
});

// ─── fmtTime ─────────────────────────────────────────────────────────────────
test('formula — fmtTime(0) returns "0s"', async ({ page }) => {
  expect(await page.evaluate(() => fmtTime(0))).toBe('0s');
});

test('formula — fmtTime(59) returns "59s"', async ({ page }) => {
  expect(await page.evaluate(() => fmtTime(59))).toBe('59s');
});

test('formula — fmtTime(60) returns "1m 0s"', async ({ page }) => {
  expect(await page.evaluate(() => fmtTime(60))).toBe('1m 0s');
});

test('formula — fmtTime(90) returns "1m 30s"', async ({ page }) => {
  expect(await page.evaluate(() => fmtTime(90))).toBe('1m 30s');
});

test('formula — fmtTime(3600) returns "1h 0m"', async ({ page }) => {
  expect(await page.evaluate(() => fmtTime(3600))).toBe('1h 0m');
});

test('formula — fmtTime(3661) returns "1h 1m"', async ({ page }) => {
  expect(await page.evaluate(() => fmtTime(3661))).toBe('1h 1m');
});

// ─── fmtCompact ──────────────────────────────────────────────────────────────
test('formula — fmtCompact(500) returns "500"', async ({ page }) => {
  expect(await page.evaluate(() => fmtCompact(500))).toBe('500');
});

test('formula — fmtCompact(1500) returns "1.5K"', async ({ page }) => {
  expect(await page.evaluate(() => fmtCompact(1500))).toBe('1.5K');
});

test('formula — fmtCompact(1000000) returns "1M"', async ({ page }) => {
  expect(await page.evaluate(() => fmtCompact(1_000_000))).toBe('1M');
});

test('formula — fmtCompact(1500000000) returns "1.5B"', async ({ page }) => {
  expect(await page.evaluate(() => fmtCompact(1_500_000_000))).toBe('1.5B');
});

// ─── nodeProdPerHour (default state: level 1, no research, no alliance) ───────
test('formula — nodeProdPerHour wood tier-0 level-1 returns 300', async ({ page }) => {
  // RESOURCE_DEFS[0] = wood; tier 0 baseProd = 300; all multipliers = 1 at defaults
  const result = await page.evaluate(() => nodeProdPerHour(RESOURCE_DEFS[0], 0, 1));
  expect(result).toBe(300);
});

test('formula — nodeProdPerHour wood tier-0 level-2 returns 450', async ({ page }) => {
  // base = Math.round(300 * (1 + 1 * 0.50)) = 450
  const result = await page.evaluate(() => nodeProdPerHour(RESOURCE_DEFS[0], 0, 2));
  expect(result).toBe(450);
});

// ─── nodeUpgradeCost ─────────────────────────────────────────────────────────
test('formula — nodeUpgradeCost wood tier-0 level-1 returns 80', async ({ page }) => {
  // upgCostBase for tier 0 = 80; Math.round(80 * 1.6^0) = 80
  const result = await page.evaluate(() => nodeUpgradeCost(RESOURCE_DEFS[0], 0, 1));
  expect(result).toBe(80);
});

test('formula — nodeUpgradeCost wood tier-0 level-2 returns 128', async ({ page }) => {
  // Math.round(80 * 1.6^1) = Math.round(128) = 128
  const result = await page.evaluate(() => nodeUpgradeCost(RESOURCE_DEFS[0], 0, 2));
  expect(result).toBe(128);
});

test('formula — nodeUpgradeCost grows with upgrade level', async ({ page }) => {
  const values = await page.evaluate(() =>
    [1, 2, 3, 4, 5].map(ul => nodeUpgradeCost(RESOURCE_DEFS[0], 0, ul))
  );
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeGreaterThan(values[i - 1]);
  }
});

// ─── nodeStorageCap ───────────────────────────────────────────────────────────
test('formula — nodeStorageCap wood tier-0 level-1 returns 900', async ({ page }) => {
  // cap for tier 0 = 900; Math.round(900 * (1 + 0)) = 900
  const result = await page.evaluate(() => nodeStorageCap(RESOURCE_DEFS[0], 0, 1));
  expect(result).toBe(900);
});

test('formula — nodeStorageCap wood tier-0 level-2 returns 1710', async ({ page }) => {
  // Math.round(900 * (1 + 1 * 0.90)) = Math.round(1710) = 1710
  const result = await page.evaluate(() => nodeStorageCap(RESOURCE_DEFS[0], 0, 2));
  expect(result).toBe(1710);
});

// ─── bonusProd / level bonuses ────────────────────────────────────────────────
test('formula — bonusProd(1) returns 0 (no bonus at level 1)', async ({ page }) => {
  expect(await page.evaluate(() => bonusProd(1))).toBe(0);
});

test('formula — bonusProd(2) returns 0.001', async ({ page }) => {
  expect(await page.evaluate(() => bonusProd(2))).toBeCloseTo(0.001);
});

test('formula — bonusProd increases by 0.001 per level', async ({ page }) => {
  const result = await page.evaluate(() => ({
    l1: bonusProd(1),
    l2: bonusProd(2),
    l10: bonusProd(10),
  }));
  expect(result.l1).toBe(0);
  expect(result.l2).toBeCloseTo(0.001);
  expect(result.l10).toBeCloseTo(0.009);
});

// ─── RESOURCE_DEFS sanity ─────────────────────────────────────────────────────
test('formula — RESOURCE_DEFS contains exactly 5 resources', async ({ page }) => {
  const count = await page.evaluate(() => RESOURCE_DEFS.length);
  expect(count).toBe(5);
});

test('formula — each resource in RESOURCE_DEFS has exactly 5 tiers', async ({ page }) => {
  const tierCounts = await page.evaluate(() => RESOURCE_DEFS.map(r => r.tiers.length));
  for (const count of tierCounts) {
    expect(count).toBe(5);
  }
});

// ─── RESEARCH_DEFS sanity ────────────────────────────────────────────────────
test('formula — RESEARCH_DEFS is non-empty and each entry has required fields', async ({ page }) => {
  const result = await page.evaluate(() => {
    return RESEARCH_DEFS.every(rd =>
      rd.id && rd.name && rd.tier && rd.category &&
      rd.cost && rd.durationMs > 0 && Array.isArray(rd.requires)
    );
  });
  expect(result).toBe(true);
});
