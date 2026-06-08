// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMBAT CONFIGURATION  —  single source of truth for all server sims
//
// This file is the canonical definition of every balance-relevant constant.
// Both campaign-simulate and pvp-simulate MUST import from here.
// The client mirror lives at: /shared/combat-config.js
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  NEW CONTENT CHECKLIST  (complete EVERY item when adding content)       │
// │                                                                         │
// │  Tower:                                                                 │
// │  [ ] Add entry to TOWER_DEFS below                                      │
// │  [ ] Add ascension multipliers to ASCEND_MULTS                          │
// │  [ ] Add to SHOP_GOLD_COST and UPGRADE_GOLD_COST                        │
// │  [ ] Add to SQL idw_tower_cost() and idw_tower_unlock_level()           │
// │  [ ] Mirror new entry in /shared/combat-config.js                       │
// │  [ ] Add to PURCHASABLE_TOWER_IDS set in campaign-simulate              │
// │  [ ] Add simulation handling in runTickSimulation if special mechanics  │
// │  [ ] Add tests in tests/e2e/game/combat-sync.spec.js                    │
// │  [ ] Bump COMBAT_CONFIG_VERSION in combat-version.ts                    │
// │                                                                         │
// │  Enemy:                                                                 │
// │  [ ] Add entry to ENEMY_DATA below                                      │
// │  [ ] Update getWaveConfig / getPvpWaveConfig if used in waves           │
// │  [ ] Mirror new entry in /shared/combat-config.js                       │
// │  [ ] Add simulation handling if special mechanics                       │
// │  [ ] Add tests                                                          │
// │  [ ] Bump BALANCE_VERSION in combat-version.ts                          │
// │                                                                         │
// │  Relic / Hero / Skill (passive):                                        │
// │  [ ] Add entry to RELIC_PASSIVES / HERO_PASSIVES / SKILL_PASSIVES       │
// │  [ ] If disenchant-scaling, add to RELIC_DISENCHANT                     │
// │  [ ] Mirror in /shared/combat-config.js                                 │
// │  [ ] Bump BALANCE_VERSION                                               │
// │                                                                         │
// │  Gear item:                                                             │
// │  [ ] Add entry to GEAR_ITEM_STATS                                       │
// │  [ ] If it has a special effect, add to GEAR_EFFECT_MAP                 │
// │  [ ] Add to VALID_SLOT_ITEMS for the correct slot                       │
// │  [ ] Mirror in /shared/combat-config.js                                 │
// │  [ ] Bump COMBAT_CONFIG_VERSION                                         │
// │                                                                         │
// │  Research:                                                              │
// │  [ ] Add bonus in computeResearchBonuses() in combat-formulas.ts        │
// │  [ ] Mirror in /shared/combat-config.js  computeResearchBonuses()       │
// │  [ ] Bump BALANCE_VERSION                                               │
// │                                                                         │
// │  Balance change (numeric tweak only, no new entries):                   │
// │  [ ] Edit value here AND in /shared/combat-config.js                    │
// │  [ ] Bump BALANCE_VERSION                                               │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Simulation constants ───────────────────────────────────────────────────

export const TILE_W    = 30;    // canonical px per tile — matches client TILE_W_PX
export const COLS      = 22;
export const ROWS      = 10;
export const TICK_MS   = 50;
export const TICK_S    = TICK_MS / 1000;

export const ICE_SLOW_FACTOR   = 0.80;   // enemies move at 80% speed when slowed (20% slow)
export const ICE_SLOW_DURATION = 2000;   // ms
export const CATAPULT_STAGGER  = 1200;   // ms
export const MAX_ENCHANT_MULT  = 3.0;    // stored enchanted stat may not exceed 3× computed base
export const START_LIVES       = 20;
export const START_GOLD        = 200;
export const GACHA_LV_THRESH   = [0, 3, 8, 16, 30, 50, 80, 120, 180, 250];

// ── Tower definitions ──────────────────────────────────────────────────────
// Source of truth: game.js TOWER_DEFS array.
// Field names use the server convention (baseDmg, baseAtkSpeed, etc.).

export interface TowerDef {
  baseDmg:       number;
  baseAtkSpeed:  number;   // seconds between shots (cooldown)
  baseRange:     number;   // tiles
  baseProj:      number;
  upgPct:        number;   // upgPctPerLevel in client
  isAoe:         boolean;
}

export const TOWER_DEFS: Record<string, TowerDef> = {
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

// ── Enemy definitions ──────────────────────────────────────────────────────
// Source of truth: game.js ENEMY_TYPES object.

export interface EnemyDef {
  hp:           number;
  speed:        number;   // px/s on client; convert to tiles/s via / TILE_W
  reward:       number;
  isBoss?:      boolean;
  spawnOnDeath: { type: string; count: number } | null;
}

export const ENEMY_DATA: Record<string, EnemyDef> = {
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

// ── Ascension multipliers ──────────────────────────────────────────────────
// Source of truth: game.js ASCEND_DEFS (apply() callbacks).

export interface AscendMult {
  atkSpeedMult: number;
  dmgMult:      number;
  projDelta:    number;
  becomesAoe:   boolean;
}

export const ASCEND_MULTS: Record<string, Record<number, AscendMult>> = {
  archer:   {
    0: { atkSpeedMult: 1.2,   dmgMult: 1.0, projDelta: 0, becomesAoe: true  },
    1: { atkSpeedMult: 1/3,   dmgMult: 0.5, projDelta: 0, becomesAoe: false },
    2: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
  },
  catapult: {
    0: { atkSpeedMult: 0.5,   dmgMult: 1.0, projDelta: 0, becomesAoe: true  },
    1: { atkSpeedMult: 0.45,  dmgMult: 1.0, projDelta: 0, becomesAoe: true  },
    2: { atkSpeedMult: 1.0,   dmgMult: 2.0, projDelta: 0, becomesAoe: true  },
  },
  crossbow: {
    0: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    1: { atkSpeedMult: 1/3,   dmgMult: 0.5, projDelta: 1, becomesAoe: false },
    2: { atkSpeedMult: 0.6,   dmgMult: 2.0, projDelta: 0, becomesAoe: true  },
  },
  ice_tower: {
    0: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    1: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    2: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
  },
  sniper: {
    0: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    1: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    2: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
  },
  inferno: {
    0: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    1: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    2: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
  },
  ballista: {
    0: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    1: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
    2: { atkSpeedMult: 1.0,   dmgMult: 1.0, projDelta: 0, becomesAoe: false },
  },
};

// ── Shop costs (gold) ──────────────────────────────────────────────────────
// Source of truth: SQL idw_tower_shop_cost() = resource_cost × 0.4 (rounded).

export const SHOP_GOLD_COST: Record<string, number> = {
  archer: 48, catapult: 72, crossbow: 108, ice_tower: 80,
  sniper: 152, inferno: 340, ballista: 144, poison_tower: 172,
  tesla_tower: 160, barricade: 140,
};

// [level1_cost, level2_cost, level3_cost]
export const UPGRADE_GOLD_COST: Record<string, number[]> = {
  range:  [60, 120, 220],
  speed:  [80, 160, 280],
  damage: [70, 150, 260],
};

export const ASCENSION_GOLD_COST = 100;

// ── Map waypoints ──────────────────────────────────────────────────────────
// Source of truth: game.js MAP_WAYPOINTS. Tile [col, row] coords.

export const MAP_WAYPOINTS: Record<string, [number, number][]> = {
  forest:   [[0,2],[2,2],[2,4],[4,4],[4,1],[6,1],[6,5],[8,5],[8,7],[10,7],[10,4],[12,4],[12,8],[14,8],[14,5],[16,5],[16,2],[18,2],[18,6],[20,6],[20,3],[19,3]],
  canyon:   [[0,1],[2,1],[2,3],[4,3],[4,6],[2,6],[2,8],[5,8],[5,5],[7,5],[7,2],[9,2],[9,6],[11,6],[11,3],[14,3],[14,7],[16,7],[16,4],[18,4],[18,1],[20,1],[20,5],[19,5]],
  swamp:    [[0,5],[2,5],[2,2],[4,2],[4,7],[6,7],[6,4],[8,4],[8,8],[10,8],[10,5],[12,5],[12,1],[14,1],[14,4],[16,4],[16,8],[18,8],[18,5],[20,5],[20,2],[19,2]],
  volcano:  [[0,4],[3,4],[3,1],[5,1],[5,6],[7,6],[7,3],[9,3],[9,8],[11,8],[11,5],[13,5],[13,2],[15,2],[15,7],[17,7],[17,4],[19,4],[19,1],[20,1]],
  tundra:   [[0,3],[2,3],[2,7],[4,7],[4,2],[7,2],[7,5],[9,5],[9,1],[11,1],[11,6],[13,6],[13,3],[15,3],[15,8],[17,8],[17,5],[19,5],[19,2],[20,2]],
  desert:   [[0,6],[2,6],[2,2],[4,2],[4,8],[6,8],[6,4],[9,4],[9,7],[11,7],[11,2],[13,2],[13,6],[15,6],[15,3],[17,3],[17,7],[19,7],[19,4],[20,4]],
  ruins:    [[0,1],[2,1],[2,5],[4,5],[4,2],[6,2],[6,7],[8,7],[8,4],[10,4],[10,8],[12,8],[12,3],[14,3],[14,6],[16,6],[16,2],[18,2],[18,5],[20,5],[20,3],[19,3]],
  ocean:    [[0,2],[3,2],[3,5],[1,5],[1,8],[4,8],[4,6],[6,6],[6,1],[8,1],[8,4],[10,4],[10,8],[12,8],[12,5],[14,5],[14,2],[16,2],[16,6],[18,6],[18,3],[20,3]],
  citadel:  [[0,5],[2,5],[2,2],[5,2],[5,4],[3,4],[3,7],[6,7],[6,5],[8,5],[8,1],[10,1],[10,4],[12,4],[12,8],[14,8],[14,5],[16,5],[16,2],[18,2],[18,6],[19,6]],
  hellgate: [[0,4],[2,4],[2,1],[4,1],[4,6],[6,6],[6,3],[8,3],[8,7],[10,7],[10,2],[12,2],[12,5],[14,5],[14,8],[16,8],[16,4],[18,4],[18,1],[20,1],[20,5],[19,5]],
};
export const WORLD_MAPS = ['forest','canyon','swamp','volcano','tundra','desert','ruins','ocean','citadel','hellgate'];

// ── Territory / alliance milestones ───────────────────────────────────────
// Source of truth: game.js ALLIANCE_TERRITORY_MILESTONES.

export const TERRITORY_MILESTONES: { tv: number; type: string; pct?: number; count?: number }[] = [
  { tv: 15,  type: 'tower_dmg',        pct: 0.15  },
  { tv: 25,  type: 'tower_spd',        pct: 0.15  },
  { tv: 40,  type: 'slow',             pct: 0.25  },
  { tv: 60,  type: 'extra_projectile', count: 1   },
  { tv: 80,  type: 'mob_hp_reduce',    pct: 0.20  },
  { tv: 120, type: 'crit_bonus',       pct: 0.50  },
  { tv: 150, type: 'boss_dmg',         pct: 0.15  },
];

export const SPECIAL_TERRITORY_DEFS: Record<string, { bonusStat: string; bonusValue: number }> = {
  combat_t1:  { bonusStat: 'tower_dmg',        bonusValue: 0.05 },
  combat_t2:  { bonusStat: 'tower_dmg',        bonusValue: 0.10 },
  combat_t3:  { bonusStat: 'tower_dmg',        bonusValue: 0.05 },
  combat_t4:  { bonusStat: 'tower_dmg',        bonusValue: 0.10 },
  combat_t5:  { bonusStat: 'tower_spd',        bonusValue: 0.05 },
  combat_t6:  { bonusStat: 'tower_spd',        bonusValue: 0.05 },
  combat_t7:  { bonusStat: 'tower_spd',        bonusValue: 0.10 },
  combat_t8:  { bonusStat: 'extra_projectile', bonusValue: 1    },
  combat_t9:  { bonusStat: 'slow',             bonusValue: 0.10 },
  combat_t10: { bonusStat: 'crit_bonus',       bonusValue: 0.50 },
  combat_t11: { bonusStat: 'mob_hp_reduce',    bonusValue: 0.05 },
  combat_t12: { bonusStat: 'mob_hp_reduce',    bonusValue: 0.10 },
};

// ── Gear item stats ────────────────────────────────────────────────────────
// Source of truth: game.js GEAR_WEAPON_DEFS / GEAR_ITEM_DEFS.

export interface GearStats {
  atk?:        number;
  atkSpeed?:   number;   // % bonus
  range?:      number;   // tiles
  critChance?: number;   // %
  critDmg?:    number;   // %
}

export const GEAR_ITEM_STATS: Record<string, GearStats> = {
  // Weapons (mainHand / offhand)
  iron_sword:        { atk: 15,  atkSpeed: 5,   range: 0.2 },
  shadow_dagger:     { atk: 12,  atkSpeed: 20,  range: 0.1, critChance: 8 },
  war_axe:           { atk: 35,  atkSpeed: -10, range: 0.4, critDmg: 40 },
  elven_bow:         { atk: 28,  atkSpeed: 15,  range: 1,   critChance: 5 },
  enchanted_staff:   { atk: 50,  atkSpeed: 8,   range: 2,   critChance: 5,  critDmg: 30 },
  stormcaller_blade: { atk: 80,  atkSpeed: 15,  range: 1,   critChance: 10, critDmg: 50 },
  mythic_staff:      { atk: 120, atkSpeed: 20,  range: 3,   critChance: 15, critDmg: 100 },
  // Off-hand only
  wooden_shield:     {},
  magic_orb:         { atk: 15, range: 1, critChance: 6,  critDmg: 20 },
  phoenix_shield:    { atk: 20,           critChance: 12, critDmg: 60 },
  // Helmets
  iron_helmet:       {},
  leather_cap:       { atkSpeed: 5 },
  celestial_helm:    { atkSpeed: 10, critChance: 8 },
  // Armor
  chain_armor:       {},
  iron_plate:        { critChance: 3 },
  divine_plate:      { critDmg: 30 },
  // Pants
  linen_pants:              {},
  reinforced_leggings:      {},
  dragonhide_leggings:      { critChance: 4 },
  shadow_leggings:          { critDmg: 40 },
  // Boots
  iron_boots:        {},
  swiftwalkers:      { atkSpeed: 5,  critChance: 5 },
  void_walker_boots: { atkSpeed: 10, critChance: 8 },
};

// Items that trigger a named special effect when equipped
export const GEAR_EFFECT_MAP: Record<string, string> = {
  stormcaller_blade: 'chain_lightning',
  mythic_staff:      'soul_drain',
  celestial_helm:    'radiant',
  divine_plate:      'thorns',
  void_walker_boots: 'void_aura',
  phoenix_shield:    'phoenix',
};

// Which item IDs are valid for each gear slot (anti-cheat: reject unknown items)
export const VALID_SLOT_ITEMS: Record<string, Set<string>> = {
  mainHand: new Set(['iron_sword','shadow_dagger','war_axe','elven_bow','enchanted_staff','stormcaller_blade','mythic_staff']),
  offhand:  new Set(['iron_sword','shadow_dagger','war_axe','elven_bow','enchanted_staff','stormcaller_blade','mythic_staff','wooden_shield','magic_orb','phoenix_shield']),
  helmet:   new Set(['iron_helmet','leather_cap','celestial_helm']),
  armor:    new Set(['chain_armor','iron_plate','divine_plate']),
  pants:    new Set(['linen_pants','reinforced_leggings','dragonhide_leggings','shadow_leggings']),
  boots:    new Set(['iron_boots','swiftwalkers','void_walker_boots']),
};

export const COMMANDER_BASE = { atk: 25, atkSpeedMs: 1200, range: 2.2 };

// ── Gacha level thresholds ─────────────────────────────────────────────────
// Source of truth: game.js _gachaHeroLevel / gachaLevel.

// ── Market passives: heroes, relics, skills ────────────────────────────────
// [id, stat1, bonusPerLevel1, stat2|null, bonusPerLevel2]
// bonusPerLevel is divided by 100 when applied (stored as whole numbers here for readability).
// wave_gold values are included; PvP formulas simply ignore that stat.
// Source of truth: game.js HERO_DEFS / RELIC_DEFS / MARKET_SKILL_DEFS.

export type ItemPassive = [string, string, number, string | null, number];

export const HERO_PASSIVES: ItemPassive[] = [
  ['iron_paladin',     'tower_dmg',   0.4,  null,          0  ],
  ['storm_archer',     'tower_dmg',   0.7,  null,          0  ],
  ['shadow_rogue',     'tower_spd',   0.6,  null,          0  ],
  ['frost_golem',      'tower_range', 1.0,  null,          0  ],
  ['arcane_fox',       'tower_dmg',   1.2,  null,          0  ],
  ['void_panther',     'tower_spd',   1.5,  null,          0  ],
  ['storm_phoenix',    'tower_dmg',   1.8,  null,          0  ],
  ['celestial_dragon', 'tower_dmg',   2.5,  'tower_spd',   1.0],
  ['titan_wolf',       'tower_dmg',   1.0,  'wave_gold',   3.0],
  ['cosmos_serpent',   'tower_dmg',   4.0,  'tower_spd',   2.0],
  ['ember_witch',      'wave_gold',   0.5,  null,          0  ],
];

export const RELIC_PASSIVES: ItemPassive[] = [
  ['iron_crest',           'tower_dmg',   0.30, null,          0   ],
  ['stone_tablet',         'tower_dmg',   0.25, null,          0   ],
  ['wooden_totem',         'tower_spd',   0.30, null,          0   ],
  ['rusted_arrowhead',     'tower_range', 0.25, null,          0   ],
  ['cracked_crystal',      'tower_dmg',   0.30, null,          0   ],
  ['forest_seed',          'tower_spd',   0.25, null,          0   ],
  ['old_compass',          'tower_range', 0.30, null,          0   ],
  ['ancient_tome',         'tower_dmg',   0.60, null,          0   ],
  ['wind_charm',           'tower_spd',   0.50, null,          0   ],
  ['silver_ring',          'tower_dmg',   0.55, null,          0   ],
  ['storm_feather',        'tower_spd',   0.60, null,          0   ],
  ['jade_fragment',        'tower_range', 0.70, null,          0   ],
  ['hunters_mark',         'tower_dmg',   0.65, null,          0   ],
  ['speed_rune',           'tower_spd',   0.55, null,          0   ],
  ['watchers_eye',         'tower_range', 0.60, null,          0   ],
  ['war_drum',             'tower_spd',   1.00, null,          0   ],
  ['battle_crest',         'tower_dmg',   1.10, null,          0   ],
  ['elemental_core',       'tower_dmg',   0.80, 'tower_spd',   0.40],
  ['rangers_lens',         'tower_range', 1.20, null,          0   ],
  ['thunder_rune',         'tower_spd',   1.10, null,          0   ],
  ['iron_will',            'tower_dmg',   1.00, null,          0   ],
  ['focus_crystal',        'tower_range', 0.80, 'tower_dmg',   0.40],
  ['traders_codex',        'wave_gold',   0.90, 'tower_dmg',   0.40],
  ['copper_coin',          'wave_gold',   0.40, null,          0   ],
  ['tarnished_medal',      'wave_gold',   0.35, null,          0   ],
  ['dusty_scroll',         'wave_gold',   0.30, null,          0   ],
  ['merchants_coin',       'wave_gold',   0.65, null,          0   ],
  ['lucky_charm',          'wave_gold',   0.70, null,          0   ],
  ['moonstone',            'wave_gold',   1.00, null,          0   ],
  ['golden_scale',         'wave_gold',   1.10, null,          0   ],
  ['phoenix_feather',      'tower_dmg',   1.60, 'tower_spd',   0.60],
  ['time_shard',           'tower_spd',   2.00, null,          0   ],
  ['chaos_orb',            'tower_dmg',   1.80, 'tower_spd',   0.80],
  ['rift_stone',           'tower_dmg',   2.00, null,          0   ],
  ['eclipse_gem',          'tower_spd',   1.80, 'wave_gold',   0.80],
  ['dragon_scale',         'tower_dmg',   1.70, 'tower_range', 0.70],
  ['venom_crystal',        'tower_spd',   1.60, 'tower_dmg',   0.80],
  ['storm_prism',          'tower_range', 1.50, 'tower_dmg',   0.90],
  ['arcane_codex',         'tower_dmg',   1.90, 'wave_gold',   0.70],
  ['warlords_seal',        'tower_dmg',   2.20, null,          0   ],
  ['emperors_seal',        'tower_dmg',   2.00, 'wave_gold',   2.00],
  ['ancient_dragon_heart', 'tower_dmg',   2.50, 'tower_spd',   1.50],
  ['celestial_map',        'tower_range', 2.00, 'wave_gold',   1.50],
  ['war_gods_crest',       'tower_dmg',   3.00, 'tower_spd',   1.00],
  ['fortune_crown',        'wave_gold',   3.00, 'tower_dmg',   1.00],
  ['eternal_flame',        'tower_dmg',   2.80, 'tower_spd',   1.20],
  ['universe_core',        'tower_dmg',   2.50, 'tower_range', 1.50],
  ['void_crystal',         'tower_dmg',   3.50, 'tower_spd',   1.50],
  ['cosmic_shard',         'tower_dmg',   4.50, 'tower_spd',   2.00],
  ['eternity_stone',       'tower_dmg',   4.00, 'wave_gold',   2.50],
];

export const SKILL_PASSIVES: ItemPassive[] = [
  ['sk_basic_fortify',    'tower_dmg',   0.35, null,          0   ],
  ['sk_quick_hands',      'tower_spd',   0.30, null,          0   ],
  ['sk_field_vision',     'tower_range', 0.30, null,          0   ],
  ['sk_battle_cry',       'tower_dmg',   0.60, null,          0   ],
  ['sk_swift_reload',     'tower_spd',   0.60, null,          0   ],
  ['sk_sharpshot',        'tower_range', 0.70, null,          0   ],
  ['sk_output_boost',     'tower_dmg',   0.55, 'tower_spd',   0.25],
  ['sk_war_tactics',      'tower_dmg',   1.00, 'tower_spd',   0.40],
  ['sk_economic_mastery', 'tower_dmg',   0.40, 'wave_gold',   1.00],
  ['sk_scavenge',         'wave_gold',   0.40, null,          0   ],
  ['sk_gold_finder',      'wave_gold',   0.70, null,          0   ],
  ['sk_plunderers_mark',  'tower_dmg',   0.80, 'wave_gold',   1.60],
  ['sk_sniper_training',  'tower_range', 1.20, 'tower_dmg',   0.40],
  ['sk_rapid_fire',       'tower_spd',   1.20, 'tower_dmg',   0.40],
  ['sk_supreme_command',  'tower_dmg',   1.80, 'tower_spd',   0.80],
  ['sk_siege_mastery',    'tower_dmg',   1.60, 'tower_range', 0.80],
  ['sk_wealth_surge',     'wave_gold',   1.20, 'tower_dmg',   0.60],
];

export interface DisenchantPassive {
  id:       string;
  stat:     string;
  perItem:  number;
  stat2?:   string;
  perItem2?: number;
}

export const RELIC_DISENCHANT: DisenchantPassive[] = [
  { id: 'breakers_mark',    stat: 'tower_dmg', perItem: 0.15 },
  { id: 'dissolution_core', stat: 'tower_dmg', perItem: 0.20, stat2: 'tower_spd', perItem2: 0.10 },
  { id: 'void_remnant',     stat: 'tower_dmg', perItem: 0.30, stat2: 'wave_gold', perItem2: 0.15 },
  { id: 'scrapper_seal',    stat: 'wave_gold', perItem: 0.10 },
];

// ── Stage rewards ──────────────────────────────────────────────────────────
// Source of truth: campaign-simulate STAGE_REWARDS.

export const STAGE_REWARDS: Record<string, Record<string, number>> = {
  '1-1':{'wood':300,'fiber':150,'xp':45},'1-2':{'wood':450,'stone':225,'xp':60},
  '1-3':{'stone':450,'fiber':300,'xp':75},'1-4':{'stone':600,'ore':225,'xp':98},
  '1-5':{'ore':450,'leather':300,'xp':120},'1-6':{'fiber':600,'leather':375,'xp':143},
  '1-7':{'leather':750,'ore':450,'xp':173},'1-8':{'stone':900,'ore':525,'xp':203},
  '1-9':{'ore':1050,'fiber':600,'xp':240},'1-10':{'wood':3000,'stone':3000,'fiber':3000,'leather':3000,'ore':3000,'xp':450},
  '2-1':{'wood':540,'fiber':270,'xp':81},'2-2':{'wood':810,'stone':405,'xp':108},
  '2-3':{'stone':810,'fiber':540,'xp':135},'2-4':{'stone':1080,'ore':405,'xp':176},
  '2-5':{'ore':810,'leather':540,'xp':216},'2-6':{'fiber':1080,'leather':675,'xp':257},
  '2-7':{'leather':1350,'ore':810,'xp':311},'2-8':{'stone':1620,'ore':945,'xp':365},
  '2-9':{'ore':1890,'fiber':1080,'xp':432},'2-10':{'wood':5400,'stone':5400,'fiber':5400,'leather':5400,'ore':5400,'xp':810},
  '3-1':{'wood':780,'fiber':390,'xp':117},'3-2':{'wood':1170,'stone':585,'xp':156},
  '3-3':{'stone':1170,'fiber':780,'xp':195},'3-4':{'stone':1560,'ore':585,'xp':255},
  '3-5':{'ore':1170,'leather':780,'xp':312},'3-6':{'fiber':1560,'leather':975,'xp':372},
  '3-7':{'leather':1950,'ore':1170,'xp':450},'3-8':{'stone':2340,'ore':1365,'xp':528},
  '3-9':{'ore':2730,'fiber':1560,'xp':624},'3-10':{'wood':7800,'stone':7800,'fiber':7800,'leather':7800,'ore':7800,'xp':1170},
  '4-1':{'wood':1020,'fiber':510,'xp':153},'4-2':{'wood':1530,'stone':765,'xp':204},
  '4-3':{'stone':1530,'fiber':1020,'xp':255},'4-4':{'stone':2040,'ore':765,'xp':333},
  '4-5':{'ore':1530,'leather':1020,'xp':408},'4-6':{'fiber':2040,'leather':1275,'xp':486},
  '4-7':{'leather':2550,'ore':1530,'xp':588},'4-8':{'stone':3060,'ore':1785,'xp':690},
  '4-9':{'ore':3570,'fiber':2040,'xp':816},'4-10':{'wood':10200,'stone':10200,'fiber':10200,'leather':10200,'ore':10200,'xp':1530},
  '5-1':{'wood':1260,'fiber':630,'xp':189},'5-2':{'wood':1890,'stone':945,'xp':252},
  '5-3':{'stone':1890,'fiber':1260,'xp':315},'5-4':{'stone':2520,'ore':945,'xp':412},
  '5-5':{'ore':1890,'leather':1260,'xp':504},'5-6':{'fiber':2520,'leather':1575,'xp':601},
  '5-7':{'leather':3150,'ore':1890,'xp':727},'5-8':{'stone':3780,'ore':2205,'xp':853},
  '5-9':{'ore':4410,'fiber':2520,'xp':1008},'5-10':{'wood':12600,'stone':12600,'fiber':12600,'leather':12600,'ore':12600,'xp':1890},
  '6-1':{'wood':1500,'fiber':750,'xp':225},'6-2':{'wood':2250,'stone':1125,'xp':300},
  '6-3':{'stone':2250,'fiber':1500,'xp':375},'6-4':{'stone':3000,'ore':1125,'xp':490},
  '6-5':{'ore':2250,'leather':1500,'xp':600},'6-6':{'fiber':3000,'leather':1875,'xp':715},
  '6-7':{'leather':3750,'ore':2250,'xp':865},'6-8':{'stone':4500,'ore':2625,'xp':1015},
  '6-9':{'ore':5250,'fiber':3000,'xp':1200},'6-10':{'wood':15000,'stone':15000,'fiber':15000,'leather':15000,'ore':15000,'xp':2250},
  '7-1':{'wood':1740,'fiber':870,'xp':261},'7-2':{'wood':2610,'stone':1305,'xp':348},
  '7-3':{'stone':2610,'fiber':1740,'xp':435},'7-4':{'stone':3480,'ore':1305,'xp':568},
  '7-5':{'ore':2610,'leather':1740,'xp':696},'7-6':{'fiber':3480,'leather':2175,'xp':829},
  '7-7':{'leather':4350,'ore':2610,'xp':1003},'7-8':{'stone':5220,'ore':3045,'xp':1177},
  '7-9':{'ore':6090,'fiber':3480,'xp':1392},'7-10':{'wood':17400,'stone':17400,'fiber':17400,'leather':17400,'ore':17400,'xp':2610},
  '8-1':{'wood':1980,'fiber':990,'xp':297},'8-2':{'wood':2970,'stone':1485,'xp':396},
  '8-3':{'stone':2970,'fiber':1980,'xp':495},'8-4':{'stone':3960,'ore':1485,'xp':647},
  '8-5':{'ore':2970,'leather':1980,'xp':792},'8-6':{'fiber':3960,'leather':2475,'xp':944},
  '8-7':{'leather':4950,'ore':2970,'xp':1142},'8-8':{'stone':5940,'ore':3465,'xp':1340},
  '8-9':{'ore':6930,'fiber':3960,'xp':1584},'8-10':{'wood':19800,'stone':19800,'fiber':19800,'leather':19800,'ore':19800,'xp':2970},
  '9-1':{'wood':2220,'fiber':1110,'xp':333},'9-2':{'wood':3330,'stone':1665,'xp':444},
  '9-3':{'stone':3330,'fiber':2220,'xp':555},'9-4':{'stone':4440,'ore':1665,'xp':725},
  '9-5':{'ore':3330,'leather':2220,'xp':888},'9-6':{'fiber':4440,'leather':2775,'xp':1058},
  '9-7':{'leather':5550,'ore':3330,'xp':1280},'9-8':{'stone':6660,'ore':3885,'xp':1502},
  '9-9':{'ore':7770,'fiber':4440,'xp':1776},'9-10':{'wood':22200,'stone':22200,'fiber':22200,'ore':22200,'leather':22200,'xp':3330},
  '10-1':{'wood':2460,'fiber':1230,'xp':369},'10-2':{'wood':3690,'stone':1845,'xp':492},
  '10-3':{'stone':3690,'fiber':2460,'xp':615},'10-4':{'stone':4920,'ore':1845,'xp':804},
  '10-5':{'ore':3690,'leather':2460,'xp':984},'10-6':{'fiber':4920,'leather':3075,'xp':1173},
  '10-7':{'leather':6150,'ore':3690,'xp':1419},'10-8':{'stone':7380,'ore':4305,'xp':1665},
  '10-9':{'ore':8610,'fiber':4920,'xp':1968},'10-10':{'wood':24600,'stone':24600,'fiber':24600,'leather':24600,'ore':24600,'xp':3690},
};
