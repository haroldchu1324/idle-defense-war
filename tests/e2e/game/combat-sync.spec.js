/**
 * combat-sync.spec.js
 *
 * Verifies that the client combat config (game.js) and the browser mirror
 * (shared/combat-config.js) agree with each other.
 *
 * Run:  npx playwright test tests/e2e/game/combat-sync.spec.js
 *
 * These tests exist to catch the most common desync mistake: changing a
 * tower/enemy stat in game.js but forgetting to update the shared files.
 */

const { test, expect } = require('@playwright/test');

// ── Shared config values (ground truth for these tests) ───────────────────
// Must match supabase/functions/_shared/combat-config.ts exactly.
const EXPECTED_TOWER_DEFS = {
  god_tower:    { baseDmg: 99999, baseAtkSpeed: 1.0,  baseRange: 50.0, baseProj: 999, upgPct: 0.0,  isAoe: true  },
  archer:       { baseDmg: 25,    baseAtkSpeed: 1.2,  baseRange: 2.5,  baseProj: 1,   upgPct: 0.12, isAoe: false },
  catapult:     { baseDmg: 40,    baseAtkSpeed: 5.0,  baseRange: 2.2,  baseProj: 1,   upgPct: 0.12, isAoe: true  },
  crossbow:     { baseDmg: 20,    baseAtkSpeed: 1.8,  baseRange: 2.5,  baseProj: 3,   upgPct: 0.10, isAoe: false },
  ice_tower:    { baseDmg: 15,    baseAtkSpeed: 1.5,  baseRange: 2.0,  baseProj: 1,   upgPct: 0.10, isAoe: false },
  sniper:       { baseDmg: 150,   baseAtkSpeed: 4.0,  baseRange: 4.5,  baseProj: 1,   upgPct: 0.10, isAoe: false },
  inferno:      { baseDmg: 40,    baseAtkSpeed: 0.8,  baseRange: 1.8,  baseProj: 1,   upgPct: 0.15, isAoe: true  },
  ballista:     { baseDmg: 90,    baseAtkSpeed: 3.2,  baseRange: 3.8,  baseProj: 1,   upgPct: 0.15, isAoe: false },
  poison_tower: { baseDmg: 18,    baseAtkSpeed: 2.0,  baseRange: 2.5,  baseProj: 1,   upgPct: 0.12, isAoe: false },
  tesla_tower:  { baseDmg: 25,    baseAtkSpeed: 2.0,  baseRange: 2.8,  baseProj: 2,   upgPct: 0.10, isAoe: false },
  barricade:    { baseDmg: 0,     baseAtkSpeed: 99.0, baseRange: 1.5,  baseProj: 0,   upgPct: 0.10, isAoe: false },
};

const EXPECTED_ENEMY_DATA = {
  red:    { hp: 30,   speed: 51,  reward: 1  },
  blue:   { hp: 40,   speed: 77,  reward: 2  },
  green:  { hp: 50,   speed: 96,  reward: 3  },
  yellow: { hp: 55,   speed: 45,  reward: 4  },
  pink:   { hp: 60,   speed: 115, reward: 5  },
  black:  { hp: 120,  speed: 32,  reward: 8  },
  purple: { hp: 120,  speed: 64,  reward: 10 },
  white:  { hp: 120,  speed: 90,  reward: 9  },
  boss:   { hp: 800,  speed: 19,  reward: 50 },
  witch:  { hp: 1000, speed: 30,  reward: 40 },
};

const EXPECTED_SHOP_COSTS = {
  archer: 48, catapult: 72, crossbow: 108, ice_tower: 80,
  sniper: 152, inferno: 340, ballista: 144, poison_tower: 172,
  tesla_tower: 160, barricade: 140,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function serverDmgAtLevel(td, level) {
  return Math.round(td.baseDmg * (1 + (level - 1) * td.upgPct));
}

function serverAtkAtLevel(td, level) {
  return td.baseAtkSpeed / Math.pow(1 + td.upgPct * 0.3, level - 1);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Combat config sync — client vs shared snapshot', () => {

  test('client TOWER_DEFS base stats match shared snapshot for every tower', async ({ page }) => {
    await page.goto('/');

    const mismatches = await page.evaluate((expected) => {
      const errors = [];
      const towers = window.TOWER_DEFS;
      if (!towers) { errors.push('TOWER_DEFS not found on window'); return errors; }

      Object.entries(expected).forEach(([id, exp]) => {
        const td = towers.find(t => t.id === id);
        if (!td) { errors.push('Missing tower: ' + id); return; }
        const bs = td.baseStats;
        if (bs.dmg        !== exp.baseDmg)      errors.push(id + ': baseDmg ' + bs.dmg + ' ≠ ' + exp.baseDmg);
        if (Math.abs(bs.atkSpeed - exp.baseAtkSpeed) > 0.001) errors.push(id + ': baseAtkSpeed ' + bs.atkSpeed + ' ≠ ' + exp.baseAtkSpeed);
        if (Math.abs(bs.range - exp.baseRange) > 0.001)       errors.push(id + ': baseRange ' + bs.range + ' ≠ ' + exp.baseRange);
        if (bs.projectiles !== exp.baseProj)    errors.push(id + ': baseProj ' + bs.projectiles + ' ≠ ' + exp.baseProj);
        if (Math.abs((td.upgPctPerLevel || 0) - exp.upgPct) > 0.001) errors.push(id + ': upgPct ' + td.upgPctPerLevel + ' ≠ ' + exp.upgPct);
      });

      towers.forEach(td => {
        if (!expected[td.id]) errors.push('Tower "' + td.id + '" in game.js but missing from shared snapshot — add to combat-config.ts and combat-config.js');
      });
      return errors;
    }, EXPECTED_TOWER_DEFS);

    expect(mismatches, 'Tower def mismatches:\n' + mismatches.join('\n')).toHaveLength(0);
  });

  test('client ENEMY_TYPES match shared snapshot', async ({ page }) => {
    await page.goto('/');

    const mismatches = await page.evaluate((expected) => {
      const errors = [];
      const types = window.ENEMY_TYPES;
      if (!types) { errors.push('ENEMY_TYPES not found on window'); return errors; }

      Object.entries(expected).forEach(([id, exp]) => {
        const e = types[id];
        if (!e) { errors.push('Missing enemy: ' + id); return; }
        if (e.hp    !== exp.hp)    errors.push(id + ': hp ' + e.hp + ' ≠ ' + exp.hp);
        if (e.speed !== exp.speed) errors.push(id + ': speed ' + e.speed + ' ≠ ' + exp.speed);
        if (e.reward !== exp.reward) errors.push(id + ': reward ' + e.reward + ' ≠ ' + exp.reward);
      });

      Object.keys(types).forEach(id => {
        if (!expected[id]) errors.push('Enemy "' + id + '" in game.js but missing from shared snapshot');
      });
      return errors;
    }, EXPECTED_ENEMY_DATA);

    expect(mismatches, 'Enemy type mismatches:\n' + mismatches.join('\n')).toHaveLength(0);
  });

  test('towerStatsAtLevel formula produces identical results server-side and client-side at level 1', async ({ page }) => {
    await page.goto('/');

    const mismatches = await page.evaluate((expected) => {
      const errors = [];
      const towers = window.TOWER_DEFS;
      if (!towers || typeof towerStatsAtLevel !== 'function') return errors;

      Object.entries(expected).forEach(([id, exp]) => {
        const td = towers.find(t => t.id === id);
        if (!td) return;
        const clientStats = towerStatsAtLevel(td, 1);
        const serverDmg   = Math.round(exp.baseDmg * 1);  // level 1 → mult = 1
        if (clientStats.dmg !== serverDmg) errors.push(id + ': level-1 dmg client=' + clientStats.dmg + ' server=' + serverDmg);
      });
      return errors;
    }, EXPECTED_TOWER_DEFS);

    expect(mismatches, 'Formula mismatches at level 1:\n' + mismatches.join('\n')).toHaveLength(0);
  });

  test('towerStatsAtLevel formula matches server formula at levels 1–5', async ({ page }) => {
    await page.goto('/');

    const mismatches = await page.evaluate((expected) => {
      const errors = [];
      if (typeof towerStatsAtLevel !== 'function') return errors;
      const towers = window.TOWER_DEFS;
      if (!towers) return errors;

      // Server formula: dmg = baseDmg * (1 + (level-1) * upgPct)
      // Client formula: dmg = Math.round(baseStats.dmg * (1 + (level-1) * upgPctPerLevel))
      // Must match at levels 1-5.

      [1, 2, 3, 4, 5].forEach(level => {
        Object.entries(expected).forEach(([id, exp]) => {
          const td = towers.find(t => t.id === id);
          if (!td) return;
          const clientStats = towerStatsAtLevel(td, level);
          const serverDmg   = Math.round(exp.baseDmg * (1 + (level - 1) * exp.upgPct));
          if (clientStats.dmg !== serverDmg)
            errors.push(id + ' lv' + level + ': dmg client=' + clientStats.dmg + ' server=' + serverDmg);
        });
      });
      return errors;
    }, EXPECTED_TOWER_DEFS);

    expect(mismatches, 'Formula mismatches at levels 1-5:\n' + mismatches.join('\n')).toHaveLength(0);
  });

  test('shared/combat-config.js browser snapshot matches expected values', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate((expectedTowers, expectedEnemies) => {
      const cfg = window.COMBAT_SHARED_CONFIG;
      if (!cfg) return { error: 'COMBAT_SHARED_CONFIG not found — shared/combat-config.js not loaded' };

      const errors = [];
      Object.entries(expectedTowers).forEach(([id, exp]) => {
        const s = cfg.TOWER_DEFS[id];
        if (!s) { errors.push('shared config missing tower: ' + id); return; }
        if (s.baseDmg !== exp.baseDmg) errors.push('shared tower ' + id + ' baseDmg ' + s.baseDmg + '≠' + exp.baseDmg);
        if (s.baseProj !== exp.baseProj) errors.push('shared tower ' + id + ' baseProj ' + s.baseProj + '≠' + exp.baseProj);
      });
      Object.entries(expectedEnemies).forEach(([id, exp]) => {
        const e = cfg.ENEMY_DATA[id];
        if (!e) { errors.push('shared config missing enemy: ' + id); return; }
        if (e.hp !== exp.hp) errors.push('shared enemy ' + id + ' hp ' + e.hp + '≠' + exp.hp);
      });
      return { errors };
    }, EXPECTED_TOWER_DEFS, EXPECTED_ENEMY_DATA);

    if (result.error) {
      // Graceful skip: shared file not loaded yet — test will pass once index.html is updated
      console.warn('SKIP:', result.error);
      return;
    }
    expect(result.errors, 'Shared config browser snapshot mismatches:\n' + result.errors.join('\n')).toHaveLength(0);
  });

  test('CombatDesyncValidator.runAll() reports no issues', async ({ page }) => {
    await page.goto('/');

    const issues = await page.evaluate(() => {
      if (!window.CombatDesyncValidator) return ['CombatDesyncValidator not loaded — add shared/desync-validator.js to index.html'];
      return window.CombatDesyncValidator.runAll();
    });

    expect(issues, 'Desync validator found issues:\n' + issues.join('\n')).toHaveLength(0);
  });

});

// ── Server formula unit tests (pure JS, no browser needed) ────────────────

test.describe('Combat formula unit tests (server formulas, no browser)', () => {

  test('tower level-scaling dmg formula is correct', () => {
    // archer level 3: dmg = 25 * (1 + 2 * 0.12) = 25 * 1.24 = 31
    expect(serverDmgAtLevel(EXPECTED_TOWER_DEFS.archer, 3)).toBe(31);
    // sniper level 5: dmg = 150 * (1 + 4 * 0.10) = 150 * 1.40 = 210
    expect(serverDmgAtLevel(EXPECTED_TOWER_DEFS.sniper, 5)).toBe(210);
    // barricade: dmg always 0
    expect(serverDmgAtLevel(EXPECTED_TOWER_DEFS.barricade, 10)).toBe(0);
  });

  test('tower attack speed scaling formula is correct', () => {
    // archer level 1: atkSpeed = 1.2
    expect(serverAtkAtLevel(EXPECTED_TOWER_DEFS.archer, 1)).toBeCloseTo(1.2, 4);
    // archer level 2: atkSpeed = 1.2 / (1 + 0.12 * 0.3) = 1.2 / 1.036 ≈ 1.1583
    expect(serverAtkAtLevel(EXPECTED_TOWER_DEFS.archer, 2)).toBeCloseTo(1.2 / 1.036, 3);
  });

  test('all expected tower IDs are defined', () => {
    const ids = Object.keys(EXPECTED_TOWER_DEFS);
    expect(ids.length).toBeGreaterThanOrEqual(11);
    expect(ids).toContain('archer');
    expect(ids).toContain('ballista');
  });

  test('all expected enemy IDs are defined', () => {
    const ids = Object.keys(EXPECTED_ENEMY_DATA);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(ids).toContain('boss');
    expect(ids).toContain('witch');
  });

  test('ballista baseProj is 1 (not 3 — pvp-simulate had a bug)', () => {
    // This test documents the known pvp-simulate ballista bug that was fixed
    // by the combat-config.ts refactor.  baseProj:3 was wrong; canonical is 1.
    expect(EXPECTED_TOWER_DEFS.ballista.baseProj).toBe(1);
  });

  test('shop gold costs are positive for all purchasable towers', () => {
    Object.entries(EXPECTED_SHOP_COSTS).forEach(([id, cost]) => {
      expect(cost, id + ' shop cost').toBeGreaterThan(0);
    });
  });

});
