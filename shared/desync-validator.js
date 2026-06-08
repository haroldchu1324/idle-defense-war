/**
 * DESYNC VALIDATOR — browser-side anti-drift checks
 *
 * Load this AFTER game.js and shared/combat-config.js.
 * Call window.CombatDesyncValidator.runAll() during development
 * or in automated tests to detect config drift.
 *
 * In production the validator is a no-op unless explicitly called.
 */

(function () {
  'use strict';

  var issues = [];

  function warn(msg) {
    issues.push(msg);
    console.warn('[CombatDesync] ' + msg);
  }

  // ── Compare client TOWER_DEFS against shared snapshot ────────────────────

  function validateTowerDefs() {
    if (typeof TOWER_DEFS === 'undefined') { warn('TOWER_DEFS not found — game.js not loaded?'); return; }
    if (!window.COMBAT_SHARED_CONFIG) { warn('COMBAT_SHARED_CONFIG not found — shared/combat-config.js not loaded?'); return; }

    var shared = window.COMBAT_SHARED_CONFIG.TOWER_DEFS;

    // Check every tower in the shared snapshot exists in game.js
    Object.keys(shared).forEach(function (id) {
      var clientTd = TOWER_DEFS.find(function (t) { return t.id === id; });
      if (!clientTd) {
        warn('Tower "' + id + '" exists in shared config but NOT in game.js TOWER_DEFS');
        return;
      }
      var s = shared[id];
      var bs = clientTd.baseStats;

      if (Math.round(bs.dmg) !== Math.round(s.baseDmg))
        warn('Tower "' + id + '" baseDmg mismatch: game.js=' + bs.dmg + ' shared=' + s.baseDmg);
      if (Math.abs(bs.atkSpeed - s.baseAtkSpeed) > 0.001)
        warn('Tower "' + id + '" baseAtkSpeed mismatch: game.js=' + bs.atkSpeed + ' shared=' + s.baseAtkSpeed);
      if (Math.abs(bs.range - s.baseRange) > 0.001)
        warn('Tower "' + id + '" baseRange mismatch: game.js=' + bs.range + ' shared=' + s.baseRange);
      if (bs.projectiles !== s.baseProj)
        warn('Tower "' + id + '" baseProj mismatch: game.js=' + bs.projectiles + ' shared=' + s.baseProj);
      if (Math.abs((clientTd.upgPctPerLevel || 0) - s.upgPct) > 0.001)
        warn('Tower "' + id + '" upgPct mismatch: game.js=' + clientTd.upgPctPerLevel + ' shared=' + s.upgPct);
    });

    // Check every tower in game.js exists in shared snapshot
    TOWER_DEFS.forEach(function (td) {
      if (!shared[td.id]) {
        warn('Tower "' + td.id + '" exists in game.js TOWER_DEFS but NOT in shared config — add it to shared/combat-config.js and _shared/combat-config.ts');
      }
    });
  }

  // ── Compare client ENEMY_TYPES against shared snapshot ───────────────────

  function validateEnemyTypes() {
    if (typeof ENEMY_TYPES === 'undefined') { warn('ENEMY_TYPES not found — game.js not loaded?'); return; }
    if (!window.COMBAT_SHARED_CONFIG) return;

    var shared = window.COMBAT_SHARED_CONFIG.ENEMY_DATA;

    Object.keys(shared).forEach(function (id) {
      var clientE = ENEMY_TYPES[id];
      if (!clientE) { warn('Enemy "' + id + '" in shared config but NOT in game.js ENEMY_TYPES'); return; }
      if (clientE.hp !== shared[id].hp)
        warn('Enemy "' + id + '" hp mismatch: game.js=' + clientE.hp + ' shared=' + shared[id].hp);
      if (clientE.speed !== shared[id].speed)
        warn('Enemy "' + id + '" speed mismatch: game.js=' + clientE.speed + ' shared=' + shared[id].speed);
    });

    Object.keys(ENEMY_TYPES).forEach(function (id) {
      if (!shared[id]) warn('Enemy "' + id + '" in game.js but NOT in shared config — add it');
    });
  }

  // ── Compare shop gold costs ───────────────────────────────────────────────

  function validateShopCosts() {
    if (!window.COMBAT_SHARED_CONFIG) return;
    var shared = window.COMBAT_SHARED_CONFIG.SHOP_GOLD_COST;
    // game.js exposes towerShopGoldCost() — check if accessible
    if (typeof towerShopGoldCost !== 'function') return;  // not exposed; skip
    Object.keys(shared).forEach(function (id) {
      var clientCost = towerShopGoldCost(id);
      if (clientCost !== undefined && clientCost !== shared[id]) {
        warn('Shop cost "' + id + '" mismatch: game.js=' + clientCost + ' shared=' + shared[id]);
      }
    });
  }

  // ── Verify formula consistency at level 1 ────────────────────────────────
  // The server formula is: dmg = baseDmg * (1 + (level-1) * upgPct)
  // The client formula is: dmg = Math.round(td.baseStats.dmg * m) where m = 1 + (level-1) * upgPctPerLevel
  // They should produce identical values at level 1.

  function validateFormulas() {
    if (typeof TOWER_DEFS === 'undefined' || !window.COMBAT_SHARED_CONFIG) return;
    var sharedCalc = window.COMBAT_SHARED_CONFIG.towerStatsAtLevel;
    TOWER_DEFS.forEach(function (td) {
      var serverStats = sharedCalc(td.id, 1);
      if (!serverStats) return;
      var clientStats = typeof towerStatsAtLevel === 'function' ? towerStatsAtLevel(td, 1) : null;
      if (!clientStats) return;
      if (clientStats.dmg !== serverStats.dmg)
        warn('Formula desync: tower "' + td.id + '" level-1 dmg: client=' + clientStats.dmg + ' server=' + serverStats.dmg);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function runAll() {
    issues = [];
    validateTowerDefs();
    validateEnemyTypes();
    validateShopCosts();
    validateFormulas();

    if (issues.length === 0) {
      console.info('[CombatDesync] All checks passed — client/server configs are in sync.');
    } else {
      console.error('[CombatDesync] ' + issues.length + ' desync issue(s) found. See warnings above.');
    }
    return issues.slice();
  }

  window.CombatDesyncValidator = {
    runAll:              runAll,
    validateTowerDefs:   validateTowerDefs,
    validateEnemyTypes:  validateEnemyTypes,
    validateFormulas:    validateFormulas,
  };
}());
