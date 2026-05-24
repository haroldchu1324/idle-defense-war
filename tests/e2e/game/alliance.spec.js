/**
 * Alliance tests — UI and pure-formula.
 *
 * STRUCTURE
 * ─────────
 * Part 1 — Formula tests (no login needed)
 *   Run via page.evaluate() against the real game.js globals.
 *   Tests ALLIANCE_TERRITORY_MILESTONES, getAllianceBuffs(),
 *   getAllianceProdBonus(), and alliance buff math.
 *
 * Part 2 — UI tests (login required)
 *   Navigate to the Alliance section and verify the UI renders
 *   correctly for the live account state.
 *   A mock in-alliance state is injected where needed so tab-level
 *   tests are deterministic regardless of whether TEST_EMAIL_A
 *   is currently in an alliance.
 */

const { test, expect } = require('@playwright/test');
const { loginWithEmail, logout } = require('../../helpers/auth');

const EMAIL    = process.env.TEST_EMAIL_A;
const PASSWORD = process.env.TEST_PASSWORD_A;

// ─── Part 1: Formula tests (no login) ────────────────────────────────────────

test.describe('alliance formulas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
  });

  // ── ALLIANCE_TERRITORY_MILESTONES ──

  test('formula — ALLIANCE_TERRITORY_MILESTONES has exactly 10 entries', async ({ page }) => {
    const count = await page.evaluate(() => ALLIANCE_TERRITORY_MILESTONES.length);
    expect(count).toBe(10);
  });

  test('formula — every milestone has required fields', async ({ page }) => {
    const valid = await page.evaluate(() =>
      ALLIANCE_TERRITORY_MILESTONES.every(m =>
        typeof m.territories === 'number' &&
        typeof m.icon       === 'string'  &&
        typeof m.name       === 'string'  &&
        typeof m.desc       === 'string'  &&
        typeof m.type       === 'string'
      )
    );
    expect(valid).toBe(true);
  });

  test('formula — milestones are in ascending territory order', async ({ page }) => {
    const values = await page.evaluate(() =>
      ALLIANCE_TERRITORY_MILESTONES.map(m => m.territories)
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  test('formula — first milestone unlocks at 1 territory (+5% resource prod)', async ({ page }) => {
    const first = await page.evaluate(() => ({
      territories: ALLIANCE_TERRITORY_MILESTONES[0].territories,
      type:        ALLIANCE_TERRITORY_MILESTONES[0].type,
      pct:         ALLIANCE_TERRITORY_MILESTONES[0].pct,
    }));
    expect(first.territories).toBe(1);
    expect(first.type).toBe('all_resource_prod');
    expect(first.pct).toBeCloseTo(0.05);
  });

  test('formula — last milestone unlocks at 150 TV (boss_dmg — Giant Slayer)', async ({ page }) => {
    const last = await page.evaluate(() => {
      const m = ALLIANCE_TERRITORY_MILESTONES[ALLIANCE_TERRITORY_MILESTONES.length - 1];
      return { territories: m.territories, type: m.type, name: m.name };
    });
    expect(last.territories).toBe(150);
    expect(last.type).toBe('boss_dmg');
    expect(last.name).toBe('Giant Slayer');
  });

  // ── getAllianceBuffs ──

  test('formula — getAllianceBuffs returns zeros when not in alliance', async ({ page }) => {
    const ab = await page.evaluate(() => {
      const prev = allianceState;
      allianceState = null;
      const result = getAllianceBuffs();
      allianceState = prev;
      return result;
    });
    expect(ab.tower_dmg).toBe(0);
    expect(ab.tower_spd).toBe(0);
    expect(ab.extra_slot).toBe(0);
    expect(ab.all_resource_prod).toBe(0);
    expect(ab.mob_hp_reduce).toBe(0);
  });

  test('formula — getAllianceBuffs at TV=1 grants +5% all_resource_prod', async ({ page }) => {
    const ab = await page.evaluate(() => {
      const prev = allianceState;
      allianceState = { in_alliance: true, territory_value: 1, territory_production_bonus: 0, territory_defense_bonus: 0, owned_special_tiles: [] };
      const result = getAllianceBuffs();
      allianceState = prev;
      return result;
    });
    expect(ab.all_resource_prod).toBeCloseTo(0.05);
    expect(ab.tower_dmg).toBe(0);  // 15 TV threshold not reached
  });

  test('formula — getAllianceBuffs at TV=15 grants tower_dmg buff', async ({ page }) => {
    const ab = await page.evaluate(() => {
      const prev = allianceState;
      allianceState = { in_alliance: true, territory_value: 15, territory_production_bonus: 0, territory_defense_bonus: 0, owned_special_tiles: [] };
      const result = getAllianceBuffs();
      allianceState = prev;
      return result;
    });
    // TV≥1 → +5% prod, TV≥5 → +10% prod, TV≥15 → +15% tower_dmg
    expect(ab.all_resource_prod).toBeCloseTo(0.05 + 0.10);
    expect(ab.tower_dmg).toBeCloseTo(0.15);
  });

  test('formula — getAllianceBuffs stacks special territory bonus on top of milestones', async ({ page }) => {
    const ab = await page.evaluate(() => {
      const prev = allianceState;
      // TV=1 (first milestone unlocked) + special tile 540 (+5% all_resource_prod)
      allianceState = {
        in_alliance: true,
        territory_value: 1,
        territory_production_bonus: 0,
        territory_defense_bonus: 0,
        owned_special_tiles: [{ tile_idx: 540 }],  // resource_t1 → +0.05
      };
      const result = getAllianceBuffs();
      allianceState = prev;
      return result;
    });
    // milestone +0.05 + special +0.05 = 0.10
    expect(ab.all_resource_prod).toBeCloseTo(0.10);
  });

  // ── getAllianceProdBonus ──

  test('formula — getAllianceProdBonus returns 0 when not in alliance', async ({ page }) => {
    const bonus = await page.evaluate(() => {
      const prev = allianceState;
      allianceState = null;
      const result = getAllianceProdBonus();
      allianceState = prev;
      return result;
    });
    expect(bonus).toBe(0);
  });

  test('formula — getAllianceProdBonus includes territory_production_bonus from server', async ({ page }) => {
    const bonus = await page.evaluate(() => {
      const prev = allianceState;
      allianceState = { in_alliance: true, territory_value: 0, territory_production_bonus: 0.08, territory_defense_bonus: 0 };
      const result = getAllianceProdBonus();
      allianceState = prev;
      return result;
    });
    // TV=0 → no milestone; server bonus 0.08 passes straight through
    expect(bonus).toBeCloseTo(0.08);
  });
});

// ─── Part 2: UI tests (login required) ───────────────────────────────────────

test.describe('alliance UI', () => {
  test.beforeAll(() => {
    if (!EMAIL || !PASSWORD) {
      throw new Error('TEST_EMAIL_A and TEST_PASSWORD_A must be set in .env.test for alliance UI tests.');
    }
  });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => { throw new Error(`[pageerror] ${err.message}`); });
    await loginWithEmail(page, EMAIL, PASSWORD);
    // Navigate to the Alliance section and wait for async init to finish
    await page.click('#nav-alliance');
    await expect(page.locator('#section-alliance')).toBeVisible();
    // Wait until the "Loading…" placeholder is replaced by real content
    await page.waitForFunction(
      () => {
        const el = document.getElementById('al-content');
        return el && el.children.length > 0 &&
               !el.textContent.includes('Loading…');
      },
      { timeout: 20_000 }
    );
  });

  test.afterEach(async ({ page }) => {
    try { await page.click('.logout-btn'); } catch { /* already logged out */ }
  });

  // ── Section structure ──

  test('alliance — section renders with children after navigation', async ({ page }) => {
    const childCount = await page.locator('#al-content > *').count();
    expect(childCount).toBeGreaterThan(0);
  });

  test('alliance — no uncaught JS errors on load', async ({ page }) => {
    // pageerror listener attached in beforeEach — reaching here means no crash
    await expect(page.locator('#al-content')).toBeVisible();
  });

  // ── Account-state-aware checks ──

  test('alliance — shows alliance browser OR alliance home (no broken state)', async ({ page }) => {
    const inAlliance = await page.evaluate(() => !!allianceState?.in_alliance);

    if (inAlliance) {
      // Home view: tab bar must be present with at least 3 tabs
      const tabCount = await page.locator('.al-tab').count();
      expect(tabCount).toBeGreaterThanOrEqual(3);
    } else {
      // Browser view: search input must be present
      await expect(page.locator('.al-search')).toBeVisible();
    }
  });

  test('alliance browser — search input and filters render when not in alliance', async ({ page }) => {
    const inAlliance = await page.evaluate(() => !!allianceState?.in_alliance);
    if (inAlliance) { test.skip(); return; }

    await expect(page.locator('.al-search')).toBeVisible();
    // Filter panel must be present
    await expect(page.locator('.al-filters')).toBeVisible();
  });

  // ── Injected mock state tests (deterministic regardless of account state) ──

  test('alliance home — tab bar has members, chat, territory and research tabs', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('al-content');
      const mockState = {
        in_alliance: true, my_rank: 'member', my_user_id: 'qa-user',
        alliance: { tag: 'QA', name: 'QA Alliance', member_count: 2, max_members: 30, total_power: 100000 },
        members: [
          { user_id: 'qa-user', username: 'QAUser', rank: 'member', power: 50000, level: 5, last_online: new Date().toISOString() },
        ],
        chats: [],
        territory_value: 0, territory_production_bonus: 0, territory_defense_bonus: 0,
        owned_special_tiles: [],
      };
      allianceState = mockState;
      renderAllianceHome(el, mockState);
    });

    const tabs = page.locator('.al-tab');
    const labels = await tabs.allTextContents();
    expect(labels.some(t => t.includes('Members'))).toBe(true);
    expect(labels.some(t => t.includes('Chat'))).toBe(true);
    expect(labels.some(t => t.includes('Territory'))).toBe(true);
    expect(labels.some(t => t.includes('Research'))).toBe(true);
  });

  test('alliance home — members panel shows table with rank/username/power columns', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('al-content');
      const mockState = {
        in_alliance: true, my_rank: 'member', my_user_id: 'qa-user',
        alliance: { tag: 'QA', name: 'QA Alliance', member_count: 1, max_members: 30, total_power: 50000 },
        members: [
          { user_id: 'qa-user', username: 'QATestUser', rank: 'member', power: 50000, level: 8, last_online: new Date().toISOString() },
        ],
        chats: [],
        territory_value: 0, territory_production_bonus: 0, territory_defense_bonus: 0,
        owned_special_tiles: [],
      };
      allianceState = mockState;
      renderAllianceHome(el, mockState);
    });

    // Members tab is active by default — table must be present
    await expect(page.locator('#al-panel-members')).toBeVisible();
    await expect(page.locator('.al-members-table')).toBeVisible();
    // The mock member username must appear in the table
    await expect(page.locator('.al-members-table')).toContainText('QATestUser');
  });

  test('alliance home — switching to Territory tab shows TV stats and milestone cards', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('al-content');
      const mockState = {
        in_alliance: true, my_rank: 'member', my_user_id: 'qa-user',
        alliance: { tag: 'QA', name: 'QA Alliance', member_count: 1, max_members: 30, total_power: 50000 },
        members: [],
        chats: [],
        territory_value: 5,
        territory_production_bonus: 0.01,
        territory_defense_bonus: 0,
        owned_special_tiles: [],
      };
      allianceState = mockState;
      renderAllianceHome(el, mockState);
      switchAllianceTab('territory');
    });

    await expect(page.locator('#al-panel-territory')).toBeVisible();
    // Milestone buff cards must be rendered (10 milestones total)
    const cardCount = await page.locator('#al-panel-territory .al-buff-card').count();
    expect(cardCount).toBe(10);
  });

  test('alliance home — territory tab shows unlocked and locked milestones correctly', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('al-content');
      const mockState = {
        in_alliance: true, my_rank: 'member', my_user_id: 'qa-user',
        alliance: { tag: 'QA', name: 'QA Alliance', member_count: 1, max_members: 30, total_power: 0 },
        members: [],
        chats: [],
        territory_value: 5,   // unlocks TV≥1 and TV≥5 milestones
        territory_production_bonus: 0,
        territory_defense_bonus: 0,
        owned_special_tiles: [],
      };
      allianceState = mockState;
      renderAllianceHome(el, mockState);
      switchAllianceTab('territory');
    });

    // TV=5 → milestones 1 (TV≥1) and 2 (TV≥5) are unlocked
    const unlockedCards = await page.locator('#al-panel-territory .al-buff-card.unlocked').count();
    expect(unlockedCards).toBe(2);

    // Remaining 8 should be locked
    const lockedCards = await page.locator('#al-panel-territory .al-buff-card.locked').count();
    expect(lockedCards).toBe(8);
  });

  test('alliance home — switching to Chat tab shows message area and input field', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('al-content');
      const mockState = {
        in_alliance: true, my_rank: 'member', my_user_id: 'qa-user',
        alliance: { tag: 'QA', name: 'QA Alliance', member_count: 1, max_members: 30, total_power: 0 },
        members: [],
        chats: [],
        territory_value: 0, territory_production_bonus: 0, territory_defense_bonus: 0,
        owned_special_tiles: [],
      };
      allianceState = mockState;
      renderAllianceHome(el, mockState);
      switchAllianceTab('chat');
    });

    await expect(page.locator('#al-panel-chat')).toBeVisible();
    await expect(page.locator('#al-chat-input')).toBeVisible();
    await expect(page.locator('.al-chat-send')).toBeVisible();
  });

  test('alliance home — switching to Research tab shows coming soon placeholder', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('al-content');
      const mockState = {
        in_alliance: true, my_rank: 'member', my_user_id: 'qa-user',
        alliance: { tag: 'QA', name: 'QA Alliance', member_count: 1, max_members: 30, total_power: 0 },
        members: [],
        chats: [],
        territory_value: 0, territory_production_bonus: 0, territory_defense_bonus: 0,
        owned_special_tiles: [],
      };
      allianceState = mockState;
      renderAllianceHome(el, mockState);
      switchAllianceTab('research');
    });

    await expect(page.locator('#al-panel-research')).toBeVisible();
    await expect(page.locator('#al-panel-research')).toContainText('Coming soon');
  });

  test('alliance home — settings tab visible for commander rank', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('al-content');
      const mockState = {
        in_alliance: true, my_rank: 'commander', my_user_id: 'qa-user',
        alliance: { tag: 'QA', name: 'QA Alliance', member_count: 1, max_members: 30, total_power: 0, description: '', join_type: 'open', language: 'en', min_power: 0 },
        members: [],
        chats: [],
        territory_value: 0, territory_production_bonus: 0, territory_defense_bonus: 0,
        owned_special_tiles: [],
      };
      allianceState = mockState;
      renderAllianceHome(el, mockState);
    });

    // Commander gets an extra Settings tab
    const tabs = await page.locator('.al-tab').allTextContents();
    expect(tabs.some(t => t.includes('Settings'))).toBe(true);
  });

  test('alliance home — settings tab NOT visible for regular member', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('al-content');
      const mockState = {
        in_alliance: true, my_rank: 'member', my_user_id: 'qa-user',
        alliance: { tag: 'QA', name: 'QA Alliance', member_count: 1, max_members: 30, total_power: 0 },
        members: [],
        chats: [],
        territory_value: 0, territory_production_bonus: 0, territory_defense_bonus: 0,
        owned_special_tiles: [],
      };
      allianceState = mockState;
      renderAllianceHome(el, mockState);
    });

    const tabs = await page.locator('.al-tab').allTextContents();
    expect(tabs.some(t => t.includes('Settings'))).toBe(false);
  });
});
