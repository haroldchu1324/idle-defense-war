// pvp-simulate: server-side PvP battle simulation
// Client sends { battleId, placements } with user JWT.
// Server reads tower + commander snapshot from DB, runs the deterministic simulation,
// and calls pvp_battle_ended to update pvp_world ownership — client never decides the outcome.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON         = Deno.env.get('SUPABASE_ANON_KEY')!;

// ─────────────────────────────────────────────────────────────────────────────
// TOWER DEFINITIONS  (mirrors TOWER_DEFS in game.js)
// ─────────────────────────────────────────────────────────────────────────────
const TOWER_DEFS: Record<string, {
  baseDmg: number; baseAtkSpeed: number; baseRange: number; baseProj: number;
  upgPct: number; isAoe: boolean;
}> = {
  god_tower:    { baseDmg: 99999, baseAtkSpeed: 1.0,  baseRange: 50.0, baseProj: 999, upgPct: 0.0,  isAoe: true  },
  archer:       { baseDmg: 25,    baseAtkSpeed: 1.2,  baseRange: 2.5,  baseProj: 1,   upgPct: 0.12, isAoe: false },
  catapult:     { baseDmg: 40,    baseAtkSpeed: 5.0,  baseRange: 2.2,  baseProj: 1,   upgPct: 0.12, isAoe: true  },
  crossbow:     { baseDmg: 20,    baseAtkSpeed: 1.8,  baseRange: 2.5,  baseProj: 3,   upgPct: 0.10, isAoe: false },
  ice_tower:    { baseDmg: 15,    baseAtkSpeed: 1.5,  baseRange: 2.0,  baseProj: 1,   upgPct: 0.10, isAoe: false },
  sniper:       { baseDmg: 150,   baseAtkSpeed: 4.0,  baseRange: 4.5,  baseProj: 1,   upgPct: 0.10, isAoe: false },
  inferno:      { baseDmg: 40,    baseAtkSpeed: 0.8,  baseRange: 1.8,  baseProj: 1,   upgPct: 0.15, isAoe: true  },
  ballista:     { baseDmg: 90,    baseAtkSpeed: 3.2,  baseRange: 3.8,  baseProj: 3,   upgPct: 0.15, isAoe: false },
  poison_tower: { baseDmg: 18,    baseAtkSpeed: 2.0,  baseRange: 2.5,  baseProj: 1,   upgPct: 0.12, isAoe: false },
  tesla_tower:  { baseDmg: 25,    baseAtkSpeed: 2.0,  baseRange: 2.8,  baseProj: 2,   upgPct: 0.10, isAoe: false },
  barricade:    { baseDmg: 0,     baseAtkSpeed: 99.0, baseRange: 1.5,  baseProj: 0,   upgPct: 0.0,  isAoe: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENEMY TYPES  (mirrors ENEMY_TYPES in game.js)
// ─────────────────────────────────────────────────────────────────────────────
const ENEMY_TYPES: Record<string, {
  hp: number; speed: number; isBoss?: boolean;
  spawnOnDeath: { type: string; count: number } | null
}> = {
  red:    { hp: 30,   speed: 51,  spawnOnDeath: null },
  blue:   { hp: 40,   speed: 77,  spawnOnDeath: { type: 'red',    count: 1 } },
  green:  { hp: 50,   speed: 96,  spawnOnDeath: { type: 'blue',   count: 1 } },
  yellow: { hp: 55,   speed: 45,  spawnOnDeath: { type: 'green',  count: 2 } },
  pink:   { hp: 60,   speed: 115, spawnOnDeath: { type: 'red',    count: 3 } },
  black:  { hp: 120,  speed: 32,  spawnOnDeath: { type: 'yellow', count: 2 } },
  purple: { hp: 120,  speed: 64,  spawnOnDeath: { type: 'pink',   count: 2 } },
  white:  { hp: 120,  speed: 90,  spawnOnDeath: { type: 'blue',   count: 4 } },
  boss:   { hp: 800,  speed: 19,  isBoss: true, spawnOnDeath: { type: 'black', count: 3 } },
  witch:  { hp: 1000, speed: 30,  spawnOnDeath: null },
};

// ─────────────────────────────────────────────────────────────────────────────
// SPECIAL TERRITORY COMBAT BUFFS  (mirrors SPECIAL_TERRITORIES combat entries)
// Only entries with bonusStat affecting combat are included.
// ─────────────────────────────────────────────────────────────────────────────
interface SpecialTerritoryDef { bonusStat: string; bonusValue: number; }
const SPECIAL_TERRITORY_DEFS: Record<string, SpecialTerritoryDef> = {
  // Combat: tower_dmg
  combat_t1:  { bonusStat: 'tower_dmg',        bonusValue: 0.05 },
  combat_t2:  { bonusStat: 'tower_dmg',        bonusValue: 0.10 },
  combat_t3:  { bonusStat: 'tower_dmg',        bonusValue: 0.05 },
  combat_t4:  { bonusStat: 'tower_dmg',        bonusValue: 0.10 },
  // Combat: tower_spd
  combat_t5:  { bonusStat: 'tower_spd',        bonusValue: 0.05 },
  combat_t6:  { bonusStat: 'tower_spd',        bonusValue: 0.05 },
  combat_t7:  { bonusStat: 'tower_spd',        bonusValue: 0.10 },
  // Combat: special
  combat_t8:  { bonusStat: 'extra_projectile', bonusValue: 1    },
  combat_t9:  { bonusStat: 'slow',             bonusValue: 0.10 },
  combat_t10: { bonusStat: 'crit_bonus',       bonusValue: 0.50 },
  combat_t11: { bonusStat: 'mob_hp_reduce',    bonusValue: 0.05 },
  combat_t12: { bonusStat: 'mob_hp_reduce',    bonusValue: 0.10 },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDER GEAR DEFINITIONS  (mirrors GEAR_WEAPON_DEFS / GEAR_ITEM_DEFS)
// Only combat-relevant stats: atk, atkSpeed, range, critChance, critDmg
// ─────────────────────────────────────────────────────────────────────────────
interface GearStats { atk?: number; atkSpeed?: number; range?: number; critChance?: number; critDmg?: number; }

const GEAR_WEAPON_STATS: Record<string, GearStats> = {
  iron_sword:        { atk: 15,  atkSpeed: 5,   range: 0.2                              },
  shadow_dagger:     { atk: 12,  atkSpeed: 20,  range: 0.1, critChance: 8               },
  war_axe:           { atk: 35,  atkSpeed: -10, range: 0.4, critDmg: 40                 },
  elven_bow:         { atk: 28,  atkSpeed: 15,  range: 1,   critChance: 5               },
  enchanted_staff:   { atk: 50,  atkSpeed: 8,   range: 2,   critChance: 5,  critDmg: 30 },
  stormcaller_blade: { atk: 80,  atkSpeed: 15,  range: 1,   critChance: 10, critDmg: 50 },
  mythic_staff:      { atk: 120, atkSpeed: 20,  range: 3,   critChance: 15, critDmg: 100 },
};

const GEAR_ITEM_STATS: Record<string, GearStats> = {
  wooden_shield:       {},
  magic_orb:           { atk: 15, range: 1,   critChance: 6,  critDmg: 20 },
  phoenix_shield:      { atk: 20,             critChance: 12, critDmg: 60 },
  iron_helmet:         {},
  leather_cap:         {},
  celestial_helm:      { critChance: 8 },
  chain_armor:         {},
  iron_plate:          { critChance: 3 },
  divine_plate:        { critDmg: 30  },
  linen_pants:         {},
  reinforced_leggings: {},
  dragonhide_leggings: { critChance: 4 },
  shadow_leggings:     { critDmg: 40  },
  iron_boots:          {},
  swiftwalkers:        { atkSpeed: 5,  critChance: 5 },
  void_walker_boots:   { atkSpeed: 10, critChance: 8 },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDER BASE STATS  (mirrors COMMANDER_BASE_STATS in game.js)
// ─────────────────────────────────────────────────────────────────────────────
const COMMANDER_BASE = { attackDamage: 25, attackSpeedMs: 1200, attackRange: 2.2 };
interface CommanderStats { attackSpeedSec: number; attackRange: number; avgDmgPerHit: number; }

function getCommanderStats(heroGear: Record<string, unknown> | null): CommanderStats {
  let atk = 0, atkSpeedPct = 0, range = 0, critChance = 0, critDmg = 0;
  if (heroGear) {
    const eq = (heroGear.equippedGear as Record<string, string | null>) ?? {};
    const slots: [string, Record<string, GearStats>][] = [
      ['mainHand', GEAR_WEAPON_STATS],
      ['offhand',  { ...GEAR_WEAPON_STATS, ...GEAR_ITEM_STATS }],
      ['helmet',   GEAR_ITEM_STATS],
      ['armor',    GEAR_ITEM_STATS],
      ['pants',    GEAR_ITEM_STATS],
      ['boots',    GEAR_ITEM_STATS],
    ];
    for (const [slot, defs] of slots) {
      const itemId = eq[slot];
      if (!itemId) continue;
      const s = defs[itemId];
      if (!s) continue;
      atk         += s.atk        ?? 0;
      atkSpeedPct += s.atkSpeed   ?? 0;
      range       += s.range      ?? 0;
      critChance  += s.critChance ?? 0;
      critDmg     += s.critDmg    ?? 0;
    }
  }
  const finalDamage  = COMMANDER_BASE.attackDamage + atk;
  const finalSpeedMs = Math.max(200, Math.round(COMMANDER_BASE.attackSpeedMs / (1 + atkSpeedPct / 100)));
  const finalRange   = COMMANDER_BASE.attackRange + range;
  // Average damage per hit includes crit: dmg * (1 + critChance/100 * critDmg/100)
  const avgDmgPerHit = finalDamage * (1 + (critChance / 100) * (critDmg / 100));
  return { attackSpeedSec: finalSpeedMs / 1000, attackRange: finalRange, avgDmgPerHit };
}

// ─────────────────────────────────────────────────────────────────────────────
// PVP MAP: always forest  (mirrors game.js isPvp ? 'forest' : ...)
// ─────────────────────────────────────────────────────────────────────────────
const FOREST_WAYPOINTS: [number, number][] = [
  [0,2],[2,2],[2,4],[4,4],[4,1],[6,1],[6,5],[8,5],[8,7],[10,7],
  [10,4],[12,4],[12,8],[14,8],[14,5],[16,5],[16,2],[18,2],[18,6],[20,6],[20,3],[19,3],
];
function pathLengthTiles(): number {
  let total = 0;
  for (let i = 1; i < FOREST_WAYPOINTS.length; i++) {
    const dx = FOREST_WAYPOINTS[i][0] - FOREST_WAYPOINTS[i-1][0];
    const dy = FOREST_WAYPOINTS[i][1] - FOREST_WAYPOINTS[i-1][1];
    total += Math.sqrt(dx*dx + dy*dy);
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVE GENERATION for PvP  (mirrors getWaveConfigByIndex for pvp- stages)
// ─────────────────────────────────────────────────────────────────────────────
interface EnemyGroup { type: string; count: number; }
function getPvpWaveConfig(diff: number, wave: number): EnemyGroup[] {
  const stageIdx  = diff - 1;
  const baseCount = 3 + (wave - 1) + Math.floor(stageIdx * 0.8);
  if (stageIdx >= 9) {
    if (wave === 10) return [{ type: 'boss', count: 1 }, { type: 'black', count: 4 }];
    if (wave >= 8)   return [{ type: 'purple', count: 2 }, { type: 'black', count: 3 }];
    if (wave >= 6)   return [{ type: 'pink',   count: 2 }, { type: 'yellow', count: 3 }];
    if (wave >= 4)   return [{ type: 'green',  count: 3 }, { type: 'yellow', count: 2 }];
    return [{ type: 'red', count: Math.floor(baseCount/2) }, { type: 'blue', count: Math.ceil(baseCount/2) }];
  }
  const TIERS       = ['red','blue','green','yellow','pink','black','purple'];
  const withinWorld = stageIdx % 10;
  const maxTierIdx  = withinWorld <= 2 ? 2 : withinWorld <= 5 ? 3 : 4;
  let types: string[];
  if (wave <= 3)      types = ['red'];
  else if (wave <= 5) types = ['red', 'blue'];
  else if (wave <= 7) types = ['blue', 'green'];
  else if (wave <= 9) {
    const secondTop = Math.max(2, maxTierIdx - 1);
    types = maxTierIdx > 2 ? [TIERS[secondTop], TIERS[maxTierIdx]] : ['green'];
  } else {
    types = [TIERS[maxTierIdx]];
  }
  return types.map((typeKey, i) => ({
    type:  typeKey,
    count: i === 0 ? Math.floor(baseCount / types.length) : Math.ceil(baseCount / types.length),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// GACHA LEVEL  (mirrors _gachaHeroLevel in game.js)
// ─────────────────────────────────────────────────────────────────────────────
const GACHA_LV_THRESH = [0, 3, 8, 16, 30, 50, 80, 120, 180, 250];
function gachaLevel(pts: number): number {
  for (let i = 9; i >= 0; i--) if (pts >= GACHA_LV_THRESH[i]) return Math.min(i + 1, 10);
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCH BONUSES  (mirrors getResearchBonuses in game.js — research section only)
// Market/pet/relic/skill passives are handled separately in computeMarketBonuses.
// ─────────────────────────────────────────────────────────────────────────────
interface ResearchBonuses { tower_dmg: number; tower_spd: number; tower_range: number; start_lives: number; }

function computeResearchBonuses(research: Record<string, { done?: boolean }> | null): ResearchBonuses {
  const rb: ResearchBonuses = { tower_dmg: 0, tower_spd: 0, tower_range: 0, start_lives: 0 };
  if (!research) return rb;
  const done = (id: string) => !!(research[id]?.done);

  // tower_dmg — type:'tower_dmg'
  if (done('def1_i'))         rb.tower_dmg  += 0.08;
  if (done('def1_ii'))        rb.tower_dmg  += 0.12;
  if (done('def1_iii'))       rb.tower_dmg  += 0.25;
  // type:'magitech' (mag_syn_iii: tower_dmg:0.20, tower_spd:0.12)
  if (done('mag_syn_iii'))    rb.tower_dmg  += 0.20;
  // type:'war_mastery' (unified_def_iv: tower_dmg:0.35, tower_spd:0.25, start_lives:12)
  if (done('unified_def_iv')) rb.tower_dmg  += 0.35;
  // type:'transcendent' (transcendent_v: tower_dmg:0.50, tower_spd:1.00, start_lives:20)
  if (done('transcendent_v')) rb.tower_dmg  += 0.50;

  // tower_spd — type:'tower_spd'
  if (done('def2_i'))         rb.tower_spd  += 0.06;
  if (done('def2_ii'))        rb.tower_spd  += 0.10;
  if (done('def2_iii'))       rb.tower_spd  += 0.18;
  if (done('mag_syn_iii'))    rb.tower_spd  += 0.12;
  if (done('unified_def_iv')) rb.tower_spd  += 0.25;
  if (done('transcendent_v')) rb.tower_spd  += 1.00;

  // tower_range — type:'tower_range'
  if (done('mag2_i'))         rb.tower_range += 0.05;
  if (done('mag2_ii'))        rb.tower_range += 0.08;
  if (done('mag2_iii'))       rb.tower_range += 0.15;

  // start_lives — type:'start_lives'
  if (done('def3_i'))         rb.start_lives += 2;
  if (done('def3_ii'))        rb.start_lives += 3;
  if (done('mag3_ii'))        rb.start_lives += 4;
  if (done('def3_iii'))       rb.start_lives += 8;
  if (done('unified_def_iv')) rb.start_lives += 12;
  if (done('transcendent_v')) rb.start_lives += 20;

  return rb;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKET BONUSES  (heroes/relics/skills passive tower_dmg|spd|range)
// Disenchant count comes from hero_gear.disenchantCount (NOT market_state).
// ─────────────────────────────────────────────────────────────────────────────
interface MarketBonuses { tower_dmg: number; tower_spd: number; tower_range: number; }
type ItemPassive = [string, string, number, string | null, number];

const HERO_PASSIVES: ItemPassive[] = [
  ['iron_paladin',     'tower_dmg',   0.4,  null,          0  ],
  ['storm_archer',     'tower_dmg',   0.7,  null,          0  ],
  ['shadow_rogue',     'tower_spd',   0.6,  null,          0  ],
  ['frost_golem',      'tower_range', 1.0,  null,          0  ],
  ['arcane_fox',       'tower_dmg',   1.2,  null,          0  ],
  ['void_panther',     'tower_spd',   1.5,  null,          0  ],
  ['storm_phoenix',    'tower_dmg',   1.8,  null,          0  ],
  ['celestial_dragon', 'tower_dmg',   2.5,  'tower_spd',   1.0],
  ['titan_wolf',       'tower_dmg',   1.0,  null,          0  ],
  ['cosmos_serpent',   'tower_dmg',   4.0,  'tower_spd',   2.0],
];

const RELIC_PASSIVES: ItemPassive[] = [
  ['iron_crest',           'tower_dmg',   0.30, null,          0  ],
  ['stone_tablet',         'tower_dmg',   0.25, null,          0  ],
  ['wooden_totem',         'tower_spd',   0.30, null,          0  ],
  ['rusted_arrowhead',     'tower_range', 0.25, null,          0  ],
  ['cracked_crystal',      'tower_dmg',   0.30, null,          0  ],
  ['forest_seed',          'tower_spd',   0.25, null,          0  ],
  ['old_compass',          'tower_range', 0.30, null,          0  ],
  ['ancient_tome',         'tower_dmg',   0.60, null,          0  ],
  ['wind_charm',           'tower_spd',   0.50, null,          0  ],
  ['silver_ring',          'tower_dmg',   0.55, null,          0  ],
  ['storm_feather',        'tower_spd',   0.60, null,          0  ],
  ['jade_fragment',        'tower_range', 0.70, null,          0  ],
  ['hunters_mark',         'tower_dmg',   0.65, null,          0  ],
  ['speed_rune',           'tower_spd',   0.55, null,          0  ],
  ['watchers_eye',         'tower_range', 0.60, null,          0  ],
  ['war_drum',             'tower_spd',   1.00, null,          0  ],
  ['battle_crest',         'tower_dmg',   1.10, null,          0  ],
  ['elemental_core',       'tower_dmg',   0.80, 'tower_spd',   0.40],
  ['rangers_lens',         'tower_range', 1.20, null,          0  ],
  ['thunder_rune',         'tower_spd',   1.10, null,          0  ],
  ['iron_will',            'tower_dmg',   1.00, null,          0  ],
  ['focus_crystal',        'tower_range', 0.80, 'tower_dmg',   0.40],
  ['traders_codex',        'tower_dmg',   0.40, null,          0  ],
  ['phoenix_feather',      'tower_dmg',   1.60, 'tower_spd',   0.60],
  ['time_shard',           'tower_spd',   2.00, null,          0  ],
  ['chaos_orb',            'tower_dmg',   1.80, 'tower_spd',   0.80],
  ['rift_stone',           'tower_dmg',   2.00, null,          0  ],
  ['eclipse_gem',          'tower_spd',   1.80, null,          0  ],
  ['dragon_scale',         'tower_dmg',   1.70, 'tower_range', 0.70],
  ['venom_crystal',        'tower_spd',   1.60, 'tower_dmg',   0.80],
  ['storm_prism',          'tower_range', 1.50, 'tower_dmg',   0.90],
  ['arcane_codex',         'tower_dmg',   1.90, null,          0  ],
  ['warlords_seal',        'tower_dmg',   2.20, null,          0  ],
  ['emperors_seal',        'tower_dmg',   2.00, null,          0  ],
  ['ancient_dragon_heart', 'tower_dmg',   2.50, 'tower_spd',   1.50],
  ['celestial_map',        'tower_range', 2.00, null,          0  ],
  ['war_gods_crest',       'tower_dmg',   3.00, 'tower_spd',   1.00],
  ['fortune_crown',        'tower_dmg',   1.00, null,          0  ],
  ['eternal_flame',        'tower_dmg',   2.80, 'tower_spd',   1.20],
  ['universe_core',        'tower_dmg',   2.50, 'tower_range', 1.50],
  ['void_crystal',         'tower_dmg',   3.50, 'tower_spd',   1.50],
  ['cosmic_shard',         'tower_dmg',   4.50, 'tower_spd',   2.00],
  ['eternity_stone',       'tower_dmg',   4.00, null,          0  ],
];

// Disenchant-scaling relics — count comes from hero_gear.disenchantCount
// dissolution_core has two stats: tower_dmg AND tower_spd
interface DisenchantPassive { id: string; stat: string; perItem: number; stat2?: string; perItem2?: number; }
const RELIC_DISENCHANT_PASSIVES: DisenchantPassive[] = [
  { id: 'breakers_mark',    stat: 'tower_dmg', perItem: 0.15 },
  { id: 'dissolution_core', stat: 'tower_dmg', perItem: 0.20, stat2: 'tower_spd', perItem2: 0.10 },
  { id: 'void_remnant',     stat: 'tower_dmg', perItem: 0.30 },
];

const SKILL_PASSIVES: ItemPassive[] = [
  ['sk_basic_fortify',    'tower_dmg',   0.35, null,          0  ],
  ['sk_quick_hands',      'tower_spd',   0.30, null,          0  ],
  ['sk_field_vision',     'tower_range', 0.30, null,          0  ],
  ['sk_battle_cry',       'tower_dmg',   0.60, null,          0  ],
  ['sk_swift_reload',     'tower_spd',   0.60, null,          0  ],
  ['sk_sharpshot',        'tower_range', 0.70, null,          0  ],
  ['sk_output_boost',     'tower_dmg',   0.55, 'tower_spd',   0.25],
  ['sk_war_tactics',      'tower_dmg',   1.00, 'tower_spd',   0.40],
  ['sk_economic_mastery', 'tower_dmg',   0.40, null,          0  ], // passiveStat2 in client
  ['sk_sniper_training',  'tower_range', 1.20, 'tower_dmg',   0.40],
  ['sk_rapid_fire',       'tower_spd',   1.20, 'tower_dmg',   0.40],
  ['sk_supreme_command',  'tower_dmg',   1.80, 'tower_spd',   0.80],
  ['sk_plunderers_mark',  'tower_dmg',   0.80, null,          0  ], // passiveStat2 in client
  ['sk_siege_mastery',    'tower_dmg',   1.60, 'tower_range', 0.80],
];

function applyPassives(
  bonuses: MarketBonuses,
  pool: ItemPassive[],
  owned: Record<string, { pts: number }> | undefined,
): void {
  if (!owned) return;
  for (const [id, stat1, bpl1, stat2, bpl2] of pool) {
    const entry = owned[id];
    if (!entry?.pts) continue;
    const lv = gachaLevel(entry.pts);
    (bonuses as Record<string, number>)[stat1] = ((bonuses as Record<string, number>)[stat1] ?? 0) + bpl1 * lv / 100;
    if (stat2) {
      (bonuses as Record<string, number>)[stat2] = ((bonuses as Record<string, number>)[stat2] ?? 0) + bpl2 * lv / 100;
    }
  }
}

function computeMarketBonuses(
  marketState: Record<string, unknown> | null,
  heroGear: Record<string, unknown> | null,
): MarketBonuses {
  const b: MarketBonuses = { tower_dmg: 0, tower_spd: 0, tower_range: 0 };
  if (!marketState) return b;

  applyPassives(b, HERO_PASSIVES,  marketState.heroes       as Record<string, { pts: number }>);
  applyPassives(b, RELIC_PASSIVES, marketState.relics       as Record<string, { pts: number }>);
  applyPassives(b, SKILL_PASSIVES, marketState.marketSkills as Record<string, { pts: number }>);

  // Disenchant count comes from hero_gear (NOT market_state) — mirrors cmdGearState.disenchantCount
  const dc = (heroGear?.disenchantCount as number) ?? 0;
  if (dc > 0) {
    const relics = (marketState.relics as Record<string, { pts: number }>) ?? {};
    for (const p of RELIC_DISENCHANT_PASSIVES) {
      if (!relics[p.id]?.pts) continue;
      (b as Record<string, number>)[p.stat] = ((b as Record<string, number>)[p.stat] ?? 0) + dc * p.perItem / 100;
      if (p.stat2 && p.perItem2) {
        (b as Record<string, number>)[p.stat2] = ((b as Record<string, number>)[p.stat2] ?? 0) + dc * p.perItem2 / 100;
      }
    }
  }

  return b;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLIANCE BONUSES  (mirrors ALLIANCE_TERRITORY_MILESTONES + special territories)
// ─────────────────────────────────────────────────────────────────────────────
const TERRITORY_MILESTONES: { territories: number; type: string; value: number }[] = [
  { territories: 15,  type: 'tower_dmg',        value: 0.15 },
  { territories: 25,  type: 'tower_spd',         value: 0.15 },
  { territories: 40,  type: 'slow',              value: 0.25 }, // not used in damage calc but tracked
  { territories: 60,  type: 'extra_projectile',  value: 1    },
  { territories: 80,  type: 'mob_hp_reduce',     value: 0.20 },
  { territories: 120, type: 'crit_bonus',        value: 0.50 }, // 10% chance × 0.50 = +5% avg
  { territories: 150, type: 'boss_dmg',          value: 0.15 },
];

interface AllianceBonuses {
  tower_dmg: number; tower_spd: number; mob_hp_reduce: number;
  extra_projectile: number; crit_bonus: number; boss_dmg: number;
}

function computeAllianceBonuses(
  territoryValue: number,
  ownedSpecialIds: string[],
): AllianceBonuses {
  const ab: AllianceBonuses = {
    tower_dmg: 0, tower_spd: 0, mob_hp_reduce: 0,
    extra_projectile: 0, crit_bonus: 0, boss_dmg: 0,
  };

  // Milestone buffs
  for (const m of TERRITORY_MILESTONES) {
    if (territoryValue < m.territories) continue;
    if      (m.type === 'tower_dmg')       ab.tower_dmg       += m.value;
    else if (m.type === 'tower_spd')        ab.tower_spd       += m.value;
    else if (m.type === 'mob_hp_reduce')    ab.mob_hp_reduce   += m.value;
    else if (m.type === 'extra_projectile') ab.extra_projectile += m.value;
    else if (m.type === 'crit_bonus')       ab.crit_bonus      += m.value;
    else if (m.type === 'boss_dmg')         ab.boss_dmg        += m.value;
  }

  // Special territory buffs (owned named combat territories)
  for (const specialId of ownedSpecialIds) {
    const def = SPECIAL_TERRITORY_DEFS[specialId];
    if (!def) continue;
    if      (def.bonusStat === 'tower_dmg')       ab.tower_dmg        += def.bonusValue;
    else if (def.bonusStat === 'tower_spd')        ab.tower_spd        += def.bonusValue;
    else if (def.bonusStat === 'mob_hp_reduce')    ab.mob_hp_reduce    += def.bonusValue;
    else if (def.bonusStat === 'extra_projectile') ab.extra_projectile += def.bonusValue;
    else if (def.bonusStat === 'crit_bonus')       ab.crit_bonus       += def.bonusValue;
    else if (def.bonusStat === 'boss_dmg')         ab.boss_dmg         += def.bonusValue;
  }

  return ab;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOWER FINAL STATS  (mirrors makeTower / tower display formula in game.js)
// extra_projectile from alliance is added to non-AoE towers.
// ─────────────────────────────────────────────────────────────────────────────
interface TowerStats {
  finalDmg: number; finalAtkSpeed: number; finalRangeTiles: number; finalProj: number;
  isAoe: boolean; critBonus: number; // pass-through for damage calc
}

// MAX_ENCHANT_MULT: enchantments can boost a stat, but not beyond 3× the base-level value.
// This mirrors the identical cap in campaign-simulate. Without it, a player with
// compounded enchantments from repeated idw_apply_enchantment calls could carry
// towers with arbitrarily inflated stats into PvP with no check.
const MAX_ENCHANT_MULT = 3.0;

function buildTowerStats(
  entry: Record<string, unknown>,
  rb: ResearchBonuses,
  mb: MarketBonuses,
  ab: AllianceBonuses,
  towerResLevels: Record<string, number>,
): TowerStats | null {
  const towerId = entry.towerId as string;
  const td = TOWER_DEFS[towerId];
  if (!td) return null;

  const level = (entry.level as number) ?? 1;
  const resLv = towerResLevels[towerId] ?? 0;

  let dmg: number, atk: number, range: number, proj: number;

  // Always compute the expected base-level stats (server-authoritative formulas).
  // These are used as the clamping reference for enchanted towers.
  const levelMult   = 1 + (level - 1) * td.upgPct;
  const computedDmg = td.baseDmg * levelMult;
  const computedAtk = td.baseAtkSpeed / Math.pow(1 + td.upgPct * 0.3, level - 1);

  if (entry.dmg !== undefined) {
    // Enchanted tower: use stored stats but clamp to plausible bounds (same as campaign-simulate).
    // Stored dmg must not exceed 3× the level-scaled base.
    // Stored atkSpeed (cooldown) must not be faster than base / 3.
    // Stored range must not exceed 3× base range.
    const storedDmg   = entry.dmg      as number;
    const storedAtk   = entry.atkSpeed as number;
    const storedRange = entry.range    as number;

    dmg   = Math.min(storedDmg,   computedDmg   * MAX_ENCHANT_MULT);
    atk   = Math.max(storedAtk,   computedAtk   / MAX_ENCHANT_MULT);
    range = Math.min(storedRange, td.baseRange   * MAX_ENCHANT_MULT);
    proj  = (entry.projectiles as number) ?? td.baseProj;
  } else {
    dmg   = computedDmg;
    atk   = computedAtk;
    range = td.baseRange;
    proj  = td.baseProj;
  }

  const dmgMult   = 1 + rb.tower_dmg  + mb.tower_dmg  + ab.tower_dmg  + resLv * 0.05;
  const spdDiv    = 1 + rb.tower_spd  + mb.tower_spd  + ab.tower_spd  + resLv * 0.05;
  const rangeMult = 1 + rb.tower_range + mb.tower_range               + resLv * 0.05;

  // extra_projectile only applies to non-AoE towers (mirrors game.js line 5453)
  const finalProj = proj + (td.isAoe ? 0 : Math.round(ab.extra_projectile));

  return {
    finalDmg:        Math.round(dmg * dmgMult),
    finalAtkSpeed:   atk / spdDiv,
    finalRangeTiles: range * rangeMult,
    finalProj,
    isAoe:           td.isAoe,
    critBonus:       ab.crit_bonus, // passed through for damage calc
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GOLD AUDIT
// ─────────────────────────────────────────────────────────────────────────────
const SHOP_COST: Record<string, number> = {
  archer: 48, catapult: 72, crossbow: 108, ice_tower: 80,
  sniper: 152, inferno: 340, ballista: 144, poison_tower: 172,
  tesla_tower: 160, barricade: 140,
};
function auditGold(placements: Record<string, unknown>[]): number {
  let spent = 0;
  for (const p of placements) {
    if (p.towerId) spent += SHOP_COST[p.towerId as string] ?? 0;
  }
  return spent;
}

// ─────────────────────────────────────────────────────────────────────────────
// BATTLE SIMULATION
// crit_bonus: alliance gives 10% crit chance with X% bonus dmg.
// Avg DPS multiplier = 1 + 0.10 * critBonusPct (e.g. 0.50 → +5% avg)
// boss_dmg: extra % damage to boss-typed enemies.
// ─────────────────────────────────────────────────────────────────────────────
const TILE_W_PX = 30;
interface SimResult { won: boolean; livesLeft: number; wavesCleared: number; debugLog: string[] }

function damageDealtToEnemy(
  enemySpeed: number,
  isBoss: boolean,
  towers: TowerStats[],
  cmd: CommanderStats,
  pathTiles: number,
  bossDmgBonus: number,
): number {
  const traversalSec = (pathTiles * TILE_W_PX) / enemySpeed;
  let totalDmg = 0;

  for (const t of towers) {
    if (t.finalAtkSpeed <= 0 || t.finalDmg <= 0) continue;
    const rangePx  = t.finalRangeTiles * TILE_W_PX;
    const coverSec = Math.min(traversalSec, (2 * rangePx) / enemySpeed);
    const shots    = coverSec / t.finalAtkSpeed;
    // Base tower DPS
    let dmg = t.isAoe ? shots * t.finalDmg : shots * t.finalDmg * t.finalProj;
    // Alliance crit_bonus: 10% chance of +critBonus% → adds 0.10 * critBonus to avg
    dmg *= (1 + 0.10 * t.critBonus);
    // Boss damage bonus
    if (isBoss && bossDmgBonus > 0) dmg *= (1 + bossDmgBonus);
    totalDmg += dmg;
  }

  // Commander damage (single-target, no crit_bonus applied — commander uses gear crits only)
  if (cmd.attackSpeedSec > 0 && cmd.avgDmgPerHit > 0) {
    const rangePx  = cmd.attackRange * TILE_W_PX;
    const coverSec = Math.min(traversalSec, (2 * rangePx) / enemySpeed);
    const shots    = coverSec / cmd.attackSpeedSec;
    let dmg = shots * cmd.avgDmgPerHit;
    if (isBoss && bossDmgBonus > 0) dmg *= (1 + bossDmgBonus);
    totalDmg += dmg;
  }

  return totalDmg;
}

function runPvpSimulation(
  diff: number,
  towers: TowerStats[],
  cmd: CommanderStats,
  rb: ResearchBonuses,
  ab: AllianceBonuses,
): SimResult {
  const hpReduceMult = Math.max(0, 1 - ab.mob_hp_reduce);
  const pathTiles    = pathLengthTiles();
  const startLives   = 20 + rb.start_lives;
  let lives          = startLives;
  let wavesCleared   = 0;
  const log: string[] = [];

  for (let wave = 1; wave <= 10; wave++) {
    const groups = getPvpWaveConfig(diff, wave);

    interface EnemyInst { type: string; hp: number; speed: number; isBoss: boolean; }
    const enemies: EnemyInst[] = [];

    for (const g of groups) {
      const et = ENEMY_TYPES[g.type];
      if (!et) continue;
      for (let i = 0; i < g.count; i++) {
        enemies.push({
          type:   g.type,
          hp:     Math.max(1, Math.round(et.hp * hpReduceMult)),
          speed:  et.speed,
          isBoss: !!(et.isBoss),
        });
      }
    }

    let livesLostThisWave = 0;

    for (const enemy of enemies) {
      const dmg = damageDealtToEnemy(enemy.speed, enemy.isBoss, towers, cmd, pathTiles, ab.boss_dmg);

      if (dmg < enemy.hp) {
        livesLostThisWave++;
        lives--;
      } else {
        // On-death children
        const et = ENEMY_TYPES[enemy.type];
        if (et?.spawnOnDeath) {
          const childEt = ENEMY_TYPES[et.spawnOnDeath.type];
          if (childEt) {
            const childHp = Math.max(1, Math.round(childEt.hp * hpReduceMult));
            for (let c = 0; c < et.spawnOnDeath.count; c++) {
              const childDmg = damageDealtToEnemy(childEt.speed, false, towers, cmd, pathTiles, ab.boss_dmg);
              if (childDmg < childHp) { livesLostThisWave++; lives--; }
            }
          }
        }
      }

      if (lives <= 0) break;
    }

    log.push(`wave ${wave}: ${enemies.length} enemies, lost ${livesLostThisWave}, lives left ${lives}`);
    if (lives > 0) wavesCleared = wave;
    if (lives <= 0) break;
  }

  return { won: lives > 0 && wavesCleared === 10, livesLeft: Math.max(0, lives), wavesCleared, debugLog: log };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }});
  }
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: corsHeaders });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = await req.json() as { battleId: string; placements?: unknown[] };
    const { battleId, placements = [] } = body;
    if (!battleId) return new Response(JSON.stringify({ error: 'battleId required' }), { status: 400, headers: corsHeaders });

    // ── Fetch battle record ────────────────────────────────────────────────
    const { data: battle, error: bErr } = await adminClient
      .from('idw_battle_attempts').select('*')
      .eq('id', battleId).eq('user_id', user.id).single();

    if (bErr || !battle) return new Response(JSON.stringify({ error: 'Battle not found' }), { status: 404, headers: corsHeaders });
    if (battle.result !== 'started') return new Response(JSON.stringify({ error: 'Battle already resolved' }), { status: 409, headers: corsHeaders });

    const stageId: string = battle.stage_id;
    if (!stageId.startsWith('pvp-')) return new Response(JSON.stringify({ error: 'Not a PvP battle' }), { status: 400, headers: corsHeaders });
    const diff = parseInt(stageId.split('-')[1], 10) || 1;

    const tileIdx: number | null = ((battle.client_report as Record<string, unknown>)?.pvpTileIdx as number) ?? null;
    if (tileIdx === null) return new Response(JSON.stringify({ error: 'Missing pvpTileIdx' }), { status: 400, headers: corsHeaders });

    // Minimum duration (10s)
    const elapsedSec = (Date.now() - new Date(battle.started_at).getTime()) / 1000;
    if (elapsedSec < 10) return new Response(JSON.stringify({ error: `Battle ended too quickly (${Math.round(elapsedSec)}s, minimum 10s)` }), { status: 400, headers: corsHeaders });

    // Validate placement indices against snapshot
    const consumedTowers = (battle.consumed_towers as Record<string, unknown>[]) ?? [];
    for (const p of placements as Record<string, unknown>[]) {
      const idx = p.consumedIndex as number;
      if (idx !== undefined && (idx < 0 || idx >= consumedTowers.length)) {
        return new Response(JSON.stringify({ error: `Invalid tower index ${idx}` }), { status: 400, headers: corsHeaders });
      }
    }

    const goldSpent = auditGold(placements as Record<string, unknown>[]);

    // ── Fetch player state ─────────────────────────────────────────────────
    const { data: player, error: pErr } = await adminClient
      .from('idw_player_state')
      .select('research, tower_research_levels, market_state, hero_gear')
      .eq('user_id', user.id).single();

    if (pErr || !player) return new Response(JSON.stringify({ error: 'Player not found' }), { status: 404, headers: corsHeaders });

    // ── Alliance territory + special tiles (best-effort) ───────────────────
    let allianceTerritoryValue = 0;
    let ownedSpecialIds: string[] = [];

    try {
      const { data: alMember } = await adminClient
        .from('idw_alliance_members').select('alliance_id')
        .eq('user_id', user.id).maybeSingle();

      if (alMember?.alliance_id) {
        // Get all member user IDs in this alliance
        const { data: members } = await adminClient
          .from('idw_alliance_members').select('user_id')
          .eq('alliance_id', alMember.alliance_id);

        const memberIds = (members ?? []).map((m: Record<string, string>) => m.user_id);

        if (memberIds.length > 0) {
          const { data: tiles } = await adminClient
            .from('pvp_world')
            .select('territory_value, special_id')
            .in('owner_id', memberIds);

          for (const tile of (tiles ?? []) as Record<string, unknown>[]) {
            allianceTerritoryValue += (tile.territory_value as number) ?? 1;
            if (tile.special_id) ownedSpecialIds.push(tile.special_id as string);
          }
        }
      }
    } catch (_) { /* best-effort */ }

    // ── Compute all bonuses ────────────────────────────────────────────────
    const heroGear       = player.hero_gear as Record<string, unknown> | null;
    const rb             = computeResearchBonuses(player.research as Record<string, { done?: boolean }>);
    const mb             = computeMarketBonuses(player.market_state as Record<string, unknown>, heroGear);
    const ab             = computeAllianceBonuses(allianceTerritoryValue, ownedSpecialIds);
    const towerResLevels = (player.tower_research_levels as Record<string, number>) ?? {};

    // Commander stats from server's hero_gear snapshot
    const cmd = getCommanderStats(heroGear);

    // ── Build tower stats from server snapshot ─────────────────────────────
    const towerStats: TowerStats[] = [];
    for (const entry of consumedTowers) {
      const stats = buildTowerStats(entry, rb, mb, ab, towerResLevels);
      if (stats) towerStats.push(stats);
    }

    // ── Run simulation ─────────────────────────────────────────────────────
    const sim = runPvpSimulation(diff, towerStats, cmd, rb, ab);

    // ── Write battle result ────────────────────────────────────────────────
    await adminClient.from('idw_battle_attempts').update({
      result:      sim.won ? 'victory' : 'defeat',
      finished_at: new Date().toISOString(),
      client_report: {
        pvpTileIdx:        tileIdx,
        simVerified:       true,
        durationSec:       Math.round(elapsedSec),
        simWon:            sim.won,
        simLives:          sim.livesLeft,
        simWaves:          sim.wavesCleared,
        goldSpent,
        allianceTV:        allianceTerritoryValue,
        allianceSpecials:  ownedSpecialIds,
        extraProjectile:   ab.extra_projectile,
        critBonus:         ab.crit_bonus,
        bossDmg:           ab.boss_dmg,
        commanderAvgDmg:   Math.round(cmd.avgDmgPerHit),
        commanderSpd:      cmd.attackSpeedSec,
        commanderRange:    cmd.attackRange,
        simLog:            sim.debugLog,
      },
    }).eq('id', battleId);

    // ── Call pvp_battle_ended to update pvp_world ownership ────────────────
    const { data: pvpResult, error: pvpErr } = await userClient.rpc('pvp_battle_ended', {
      p_tile_idx:  tileIdx,
      p_won:       sim.won,
      p_battle_id: battleId,
    });

    if (pvpErr) {
      console.error('pvp_battle_ended failed:', pvpErr);
      return new Response(JSON.stringify({ error: pvpErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      won: sim.won, livesLeft: sim.livesLeft, wavesCleared: sim.wavesCleared, tileIdx, pvpResult,
    }), { headers: corsHeaders });

  } catch (err) {
    console.error('pvp-simulate error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
