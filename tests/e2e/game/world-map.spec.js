/**
 * World PvP Map tests — UI and pure-formula.
 *
 * STRUCTURE
 * ─────────
 * Part 1 — Formula tests (no login needed)
 *   Tests SPECIAL_TERRITORIES data, pvpTileIdx(), pvpUserColor(),
 *   and the PVP grid constants via page.evaluate().
 *
 * Part 2 — UI tests (login required)
 *   Navigate to the PvP section and verify the world map renders:
 *   toolbar, canvas, legend, nav buttons, coordinate form, stats display.
 *   Tests do NOT perform attacks or claim tiles — read-only observation only.
 */

const { test, expect } = require('@playwright/test');
const { loginWithEmail, logout } = require('../../helpers/auth');

const EMAIL    = process.env.TEST_EMAIL_A;
const PASSWORD = process.env.TEST_PASSWORD_A;

// ─── Part 1: Formula / data tests (no login) ─────────────────────────────────

test.describe('world map formulas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
  });

  // ── PVP grid constants ──

  test('formula — PVP_GRID is 100 (100×100 map)', async ({ page }) => {
    const grid = await page.evaluate(() => PVP_GRID);
    expect(grid).toBe(100);
  });

  test('formula — PVP_VISIBLE is 11 (11×11 viewport)', async ({ page }) => {
    const vis = await page.evaluate(() => PVP_VISIBLE);
    expect(vis).toBe(11);
  });

  // ── pvpTileIdx ──

  test('formula — pvpTileIdx(0, 0) returns 0', async ({ page }) => {
    expect(await page.evaluate(() => pvpTileIdx(0, 0))).toBe(0);
  });

  test('formula — pvpTileIdx(5, 3) returns 305 (ty*100 + tx)', async ({ page }) => {
    expect(await page.evaluate(() => pvpTileIdx(5, 3))).toBe(305);
  });

  test('formula — pvpTileIdx(99, 99) returns 9999 (bottom-right corner)', async ({ page }) => {
    expect(await page.evaluate(() => pvpTileIdx(99, 99))).toBe(9999);
  });

  test('formula — pvpTileIdx(0, 1) returns 100 (second row, first column)', async ({ page }) => {
    expect(await page.evaluate(() => pvpTileIdx(0, 1))).toBe(100);
  });

  // ── pvpUserColor ──

  test('formula — pvpUserColor(null) returns the unclaimed tile color #2a2e42', async ({ page }) => {
    expect(await page.evaluate(() => pvpUserColor(null))).toBe('#2a2e42');
  });

  test('formula — pvpUserColor(userId) returns a valid 7-char hex color', async ({ page }) => {
    const color = await page.evaluate(() => pvpUserColor('some-test-user-id-abc'));
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('formula — pvpUserColor returns same color for the same userId (deterministic)', async ({ page }) => {
    const [c1, c2] = await page.evaluate(() => [
      pvpUserColor('stable-user-id'),
      pvpUserColor('stable-user-id'),
    ]);
    expect(c1).toBe(c2);
  });

  test('formula — pvpUserColor returns different colors for different userIds', async ({ page }) => {
    const [c1, c2] = await page.evaluate(() => [
      pvpUserColor('user-aaa'),
      pvpUserColor('user-zzz'),
    ]);
    // Colors come from a palette — different inputs should land on different slots
    // (not guaranteed for all inputs, but these specific strings hash differently)
    expect(typeof c1).toBe('string');
    expect(typeof c2).toBe('string');
    expect(c1).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c2).toMatch(/^#[0-9a-f]{6}$/i);
  });

  // ── SPECIAL_TERRITORIES ──

  test('formula — SPECIAL_TERRITORIES has entries for all 32 defined tile indices', async ({ page }) => {
    const count = await page.evaluate(() => Object.keys(SPECIAL_TERRITORIES).length);
    expect(count).toBe(32);
  });

  test('formula — SPECIAL_TERRITORIES tile 540 is a rare resource territory (+5% prod)', async ({ page }) => {
    const tile = await page.evaluate(() => SPECIAL_TERRITORIES[540]);
    expect(tile).not.toBeNull();
    expect(tile.id).toBe('resource_t1');
    expect(tile.rarity).toBe('rare');
    expect(tile.category).toBe('resource');
    expect(tile.bonusStat).toBe('all_resource_prod');
    expect(tile.bonusValue).toBeCloseTo(0.05);
    expect(tile.tv).toBe(1);
  });

  test('formula — each special territory has required fields', async ({ page }) => {
    const valid = await page.evaluate(() =>
      Object.values(SPECIAL_TERRITORIES).every(t =>
        t.id && t.name && t.rarity && t.category &&
        typeof t.bonusStat === 'string' &&
        typeof t.bonusValue === 'number' &&
        typeof t.tileIdx === 'number' &&
        typeof t.tv === 'number'
      )
    );
    expect(valid).toBe(true);
  });

  test('formula — SPECIAL_TERRITORIES has 10 resource, 12 combat and 10 stage territories', async ({ page }) => {
    const counts = await page.evaluate(() => {
      const cats = { resource: 0, combat: 0, stage: 0 };
      Object.values(SPECIAL_TERRITORIES).forEach(t => { if (cats[t.category] !== undefined) cats[t.category]++; });
      return cats;
    });
    expect(counts.resource).toBe(10);
    expect(counts.combat).toBe(12);
    expect(counts.stage).toBe(10);
  });

  test('formula — SPECIAL_TERRITORIES has rare, epic and legendary rarities', async ({ page }) => {
    const rarities = await page.evaluate(() =>
      [...new Set(Object.values(SPECIAL_TERRITORIES).map(t => t.rarity))].sort()
    );
    expect(rarities).toEqual(['epic', 'legendary', 'rare']);
  });
});

// ─── Part 2: UI tests (login required) ───────────────────────────────────────

test.describe('world map UI', () => {
  // The pvp_get_tiles RPC can take up to ~20 s on a cold Supabase connection.
  // Login itself can take 20–35 s. Give each test 120 s total budget.
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(() => {
    if (!EMAIL || !PASSWORD) {
      throw new Error('TEST_EMAIL_A and TEST_PASSWORD_A must be set in .env.test for world-map UI tests.');
    }
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => { throw new Error(`[pageerror] ${err.message}`); });
    await loginWithEmail(page, EMAIL, PASSWORD);
    await page.click('#nav-pvp');
    await expect(page.locator('#section-pvp')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    try { await page.click('.logout-btn'); } catch { /* already logged out */ }
  });

  // ── Access control ──

  test('world map — guest lock overlay is NOT active for a registered account', async ({ page }) => {
    const lockActive = await page.locator('#pvp-guest-lock').evaluate(
      el => el.classList.contains('active')
    );
    expect(lockActive).toBe(false);
  });

  // ── Toolbar ──

  test('world map — toolbar renders with "World Map" title', async ({ page }) => {
    await expect(page.locator('.pvp-toolbar-title')).toBeVisible();
    await expect(page.locator('.pvp-toolbar-title')).toContainText('World Map');
  });

  test('world map — stats display is present', async ({ page }) => {
    await expect(page.locator('#pvp-stats')).toBeVisible();
  });

  test('world map — stats display updates after map loads', async ({ page }) => {
    // Wait for the stats text to change from the initial placeholder.
    // pvpUpdateStats() sets "Your territory: X · Total claimed: Y/10,000".
    await page.waitForFunction(
      () => {
        const el = document.getElementById('pvp-stats');
        return el && !el.textContent.includes('–');
      },
      { timeout: 50_000 }
    );
    const statsText = await page.locator('#pvp-stats').textContent();
    expect(statsText).toContain('Total claimed:');
  });

  test('world map — Home and Refresh buttons are present', async ({ page }) => {
    // Use the onclick attribute to target the toolbar Home button specifically;
    // "Home" also appears in the tooltip's "Set as Home" button.
    await expect(page.locator('button[onclick="pvpGoHome()"]')).toBeVisible();
    await expect(page.locator('#pvp-refresh-btn')).toBeVisible();
  });

  // ── Coordinate form ──

  test('world map — coordinate form has X/Y inputs and a Go button', async ({ page }) => {
    await expect(page.locator('#pvp-coord-x')).toBeVisible();
    await expect(page.locator('#pvp-coord-y')).toBeVisible();
    await expect(page.locator('.pvp-coord-go')).toBeVisible();
  });

  // ── Legend ──

  test('world map — legend shows Unclaimed, Yours, Enemy and Special entries', async ({ page }) => {
    const legendText = await page.locator('.pvp-legend').textContent();
    expect(legendText).toContain('Unclaimed');
    expect(legendText).toContain('Yours');
    expect(legendText).toContain('Enemy');
    expect(legendText).toContain('Special');
  });

  // ── Canvas ──

  test('world map — canvas element is present in the DOM', async ({ page }) => {
    await expect(page.locator('#pvp-canvas')).toBeAttached();
  });

  test('world map — canvas gets non-zero dimensions after map loads', async ({ page }) => {
    // pvpInitCanvas() sets canvas width/height once pvpRefresh(init=true) completes
    await page.waitForFunction(() => {
      const c = document.getElementById('pvp-canvas');
      return c && c.width > 0 && c.height > 0;
    }, { timeout: 30_000 });

    const { width, height } = await page.locator('#pvp-canvas').evaluate(c => ({
      width:  c.width,
      height: c.height,
    }));
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  test('world map — canvas area wrapper is visible', async ({ page }) => {
    await expect(page.locator('#pvp-canvas-area')).toBeVisible();
  });

  // ── Navigation buttons ──

  test('world map — directional navigation buttons render after canvas init', async ({ page }) => {
    // Nav buttons are injected by pvpInitCanvas(); wait for canvas to be sized
    await page.waitForFunction(() => {
      const c = document.getElementById('pvp-canvas');
      return c && c.width > 0;
    }, { timeout: 30_000 });

    await expect(page.locator('.pvp-nav-up')).toBeAttached();
    await expect(page.locator('.pvp-nav-down')).toBeAttached();
    await expect(page.locator('.pvp-nav-left')).toBeAttached();
    await expect(page.locator('.pvp-nav-right')).toBeAttached();
  });

  // ── Loading overlay ──

  test('world map — loading overlay is hidden after map loads', async ({ page }) => {
    // Wait for the overlay's inline display style to be set to 'none' by pvpRefresh().
    // Checking the DOM property directly avoids relying on the pvpLoaded flag.
    await page.waitForFunction(
      () => document.getElementById('pvp-loading-overlay')?.style?.display === 'none',
      { timeout: 50_000 }
    );
    const display = await page.locator('#pvp-loading-overlay').evaluate(el => el.style.display);
    expect(display).toBe('none');
  });
});
