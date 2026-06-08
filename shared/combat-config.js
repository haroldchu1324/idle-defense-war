/**
 * COMBAT CONFIG — browser mirror
 *
 * MIRROR OF: supabase/functions/_shared/combat-config.ts
 *
 * ⚠  SYNC WARNING ⚠
 * This file mirrors the server's canonical config.
 * When you change any value here, make the IDENTICAL change in:
 *   supabase/functions/_shared/combat-config.ts
 * When you change a value there, update this file too.
 * Then bump BALANCE_VERSION or COMBAT_CONFIG_VERSION in:
 *   supabase/functions/_shared/combat-version.ts
 *
 * This file is loaded in index.html BEFORE game.js.
 * It sets window.COMBAT_SHARED_CONFIG so both game.js and
 * the desync-validator can verify consistency at runtime.
 *
 * The TOWER_DEFS and ENEMY_TYPES objects in game.js remain the live
 * client data structures.  This file provides a parallel snapshot
 * that validation tools compare against to detect accidental drift.
 */

(function () {
  'use strict';

  // ── Versions (must match combat-version.ts) ──────────────────────────────
  var COMBAT_CONFIG_VERSION  = 1;
  var BALANCE_VERSION        = 1;
  var SIMULATION_VERSION     = 1;

  // ── Tower definitions ────────────────────────────────────────────────────
  // Field names match game.js TOWER_DEFS (id, baseStats, upgPctPerLevel).
  // Source of truth: game.js TOWER_DEFS array.
  var TOWER_DEFS_SHARED = {
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

  // ── Enemy definitions ────────────────────────────────────────────────────
  // Source of truth: game.js ENEMY_TYPES object.
  var ENEMY_DATA_SHARED = {
    red:    { hp: 30,   speed: 51,  reward: 1,  spawnOnDeath: null },
    blue:   { hp: 40,   speed: 77,  reward: 2,  spawnOnDeath: { type: 'red',    count: 1 } },
    green:  { hp: 50,   speed: 96,  reward: 3,  spawnOnDeath: { type: 'blue',   count: 1 } },
    yellow: { hp: 55,   speed: 45,  reward: 4,  spawnOnDeath: { type: 'green',  count: 2 } },
    pink:   { hp: 60,   speed: 115, reward: 5,  spawnOnDeath: { type: 'red',    count: 3 } },
    black:  { hp: 120,  speed: 32,  reward: 8,  spawnOnDeath: { type: 'yellow', count: 2 } },
    purple: { hp: 120,  speed: 64,  reward: 10, spawnOnDeath: { type: 'pink',   count: 2 } },
    white:  { hp: 120,  speed: 90,  reward: 9,  spawnOnDeath: { type: 'blue',   count: 4 } },
    boss:   { hp: 800,  speed: 19,  reward: 50, isBoss: true, spawnOnDeath: { type: 'black', count: 3 } },
    witch:  { hp: 1000, speed: 30,  reward: 40, spawnOnDeath: null },
  };

  // ── Shop costs ────────────────────────────────────────────────────────────
  var SHOP_GOLD_COST_SHARED = {
    archer: 48, catapult: 72, crossbow: 108, ice_tower: 80,
    sniper: 152, inferno: 340, ballista: 144, poison_tower: 172,
    tesla_tower: 160, barricade: 140,
  };

  // ── Simulation constants ──────────────────────────────────────────────────
  var COMBAT_CONSTANTS = {
    TILE_W:             30,
    COLS:               22,
    ROWS:               10,
    TICK_MS:            50,
    ICE_SLOW_FACTOR:    0.80,
    ICE_SLOW_DURATION:  2000,
    CATAPULT_STAGGER:   1200,
    MAX_ENCHANT_MULT:   3.0,
    START_LIVES:        20,
    START_GOLD:         200,
  };

  // ── Tower stat formula ────────────────────────────────────────────────────
  // Mirror of towerStatsAtLevel() in game.js AND buildTowerStats() in combat-formulas.ts.
  function towerStatsAtLevelShared(towerId, level) {
    var td = TOWER_DEFS_SHARED[towerId];
    if (!td) return null;
    var m = 1 + (level - 1) * td.upgPct;
    return {
      dmg:      Math.round(td.baseDmg * m),
      atkSpeed: td.baseAtkSpeed / Math.pow(1 + td.upgPct * 0.3, level - 1),
      range:    td.baseRange,
      proj:     td.baseProj,
    };
  }

  // ── Expose to window ──────────────────────────────────────────────────────
  window.COMBAT_SHARED_CONFIG = {
    version: {
      configV:  COMBAT_CONFIG_VERSION,
      balanceV: BALANCE_VERSION,
      simV:     SIMULATION_VERSION,
    },
    TOWER_DEFS:           TOWER_DEFS_SHARED,
    ENEMY_DATA:           ENEMY_DATA_SHARED,
    SHOP_GOLD_COST:       SHOP_GOLD_COST_SHARED,
    COMBAT_CONSTANTS:     COMBAT_CONSTANTS,
    towerStatsAtLevel:    towerStatsAtLevelShared,
  };
}());
