// campaign-simulate: server-side tower-defense battle simulation
// Client sends { battleId, shopPlacements, armoryPlacements, commanderPlacement, gearFingerprint }.
// Server runs a deterministic tick-based simulation (50 ms ticks) using tower grid positions,
// enemy path traversal, and gold timing — the client's "won" claim is NEVER trusted.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON         = Deno.env.get('SUPABASE_ANON_KEY')!;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TILE_W   = 30;   // canonical px per tile — same as client TILE_W_PX hardcode
const COLS     = 22;
const ROWS     = 10;
const TICK_MS  = 50;   // simulation tick in ms
const TICK_S   = TICK_MS / 1000;
const ICE_SLOW_FACTOR  = 0.80;  // 20% slow
const ICE_SLOW_DURATION = 2000; // ms
const CATAPULT_STAGGER  = 1200; // ms

// ─────────────────────────────────────────────────────────────────────────────
// TOWER DEFINITIONS  (mirrors TOWER_DEFS in game.js)
// ─────────────────────────────────────────────────────────────────────────────
interface TowerDef { baseDmg:number; baseAtkSpeed:number; baseRange:number; baseProj:number; upgPct:number; isAoe:boolean; }
const TOWER_DEFS: Record<string, TowerDef> = {
  god_tower:    { baseDmg:99999, baseAtkSpeed:1.0,  baseRange:50.0, baseProj:999, upgPct:0.0,  isAoe:true  },
  archer:       { baseDmg:25,    baseAtkSpeed:1.2,  baseRange:2.5,  baseProj:1,   upgPct:0.12, isAoe:false },
  catapult:     { baseDmg:40,    baseAtkSpeed:5.0,  baseRange:2.2,  baseProj:1,   upgPct:0.12, isAoe:true  },
  crossbow:     { baseDmg:20,    baseAtkSpeed:1.8,  baseRange:2.5,  baseProj:3,   upgPct:0.10, isAoe:false },
  ice_tower:    { baseDmg:15,    baseAtkSpeed:1.5,  baseRange:2.0,  baseProj:1,   upgPct:0.10, isAoe:false },
  sniper:       { baseDmg:150,   baseAtkSpeed:4.0,  baseRange:4.5,  baseProj:1,   upgPct:0.10, isAoe:false },
  inferno:      { baseDmg:40,    baseAtkSpeed:0.8,  baseRange:1.8,  baseProj:1,   upgPct:0.15, isAoe:true  },
  ballista:     { baseDmg:90,    baseAtkSpeed:3.2,  baseRange:3.8,  baseProj:1,   upgPct:0.15, isAoe:false },
  poison_tower: { baseDmg:18,    baseAtkSpeed:2.0,  baseRange:2.5,  baseProj:1,   upgPct:0.12, isAoe:false },
  tesla_tower:  { baseDmg:25,    baseAtkSpeed:2.0,  baseRange:2.8,  baseProj:2,   upgPct:0.10, isAoe:false },
  barricade:    { baseDmg:0,     baseAtkSpeed:99.0, baseRange:1.5,  baseProj:0,   upgPct:0.0,  isAoe:false },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENEMY TYPES  (mirrors ENEMY_TYPES in game.js — includes reward per kill)
// ─────────────────────────────────────────────────────────────────────────────
interface EnemyDef { hp:number; speed:number; reward:number; spawnOnDeath:{ type:string; count:number }|null; }
const ENEMY_DATA: Record<string, EnemyDef> = {
  red:    { hp:30,   speed:51,  reward:1,  spawnOnDeath: null },
  blue:   { hp:40,   speed:77,  reward:2,  spawnOnDeath: { type:'red',    count:1 } },
  green:  { hp:50,   speed:96,  reward:3,  spawnOnDeath: { type:'blue',   count:1 } },
  yellow: { hp:55,   speed:45,  reward:4,  spawnOnDeath: { type:'green',  count:2 } },
  pink:   { hp:60,   speed:115, reward:5,  spawnOnDeath: { type:'red',    count:3 } },
  black:  { hp:120,  speed:32,  reward:8,  spawnOnDeath: { type:'yellow', count:2 } },
  purple: { hp:120,  speed:64,  reward:10, spawnOnDeath: { type:'pink',   count:2 } },
  white:  { hp:120,  speed:90,  reward:9,  spawnOnDeath: { type:'blue',   count:4 } },
  boss:   { hp:800,  speed:19,  reward:50, spawnOnDeath: { type:'black',  count:3 } },
  witch:  { hp:1000, speed:30,  reward:40, spawnOnDeath: null },
};

// ─────────────────────────────────────────────────────────────────────────────
// ASCENSION MULTIPLIERS  (mirrors ASCEND_DEFS apply() in game.js)
// ─────────────────────────────────────────────────────────────────────────────
interface AscendMult { atkSpeedMult:number; dmgMult:number; projDelta:number; becomesAoe:boolean; }
const ASCEND_MULTS: Record<string, Record<number, AscendMult>> = {
  archer:   { 0:{atkSpeedMult:1.2, dmgMult:1.0, projDelta:0, becomesAoe:true },
               1:{atkSpeedMult:1/3, dmgMult:0.5, projDelta:0, becomesAoe:false},
               2:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false} },
  catapult: { 0:{atkSpeedMult:0.5,  dmgMult:1.0, projDelta:0, becomesAoe:true},
               1:{atkSpeedMult:0.45, dmgMult:1.0, projDelta:0, becomesAoe:true},
               2:{atkSpeedMult:1.0,  dmgMult:2.0, projDelta:0, becomesAoe:true} },
  crossbow: { 0:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               1:{atkSpeedMult:1/3, dmgMult:0.5, projDelta:1, becomesAoe:false},
               2:{atkSpeedMult:0.6, dmgMult:2.0, projDelta:0, becomesAoe:true } },
  ice_tower:{ 0:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               1:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               2:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false} },
  sniper:   { 0:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               1:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               2:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false} },
  inferno:  { 0:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               1:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               2:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false} },
  ballista: { 0:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               1:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false},
               2:{atkSpeedMult:1.0, dmgMult:1.0, projDelta:0, becomesAoe:false} },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAP WAYPOINTS  (tile coords — mirrors MAP_WAYPOINTS in game.js)
// Pixel center of waypoint [c,r] = (c*TILE_W + TILE_W/2, r*TILE_W + TILE_W/2)
// ─────────────────────────────────────────────────────────────────────────────
const MAP_WAYPOINTS: Record<string,[number,number][]> = {
  forest:  [[0,2],[2,2],[2,4],[4,4],[4,1],[6,1],[6,5],[8,5],[8,7],[10,7],[10,4],[12,4],[12,8],[14,8],[14,5],[16,5],[16,2],[18,2],[18,6],[20,6],[20,3],[19,3]],
  canyon:  [[0,1],[2,1],[2,3],[4,3],[4,6],[2,6],[2,8],[5,8],[5,5],[7,5],[7,2],[9,2],[9,6],[11,6],[11,3],[14,3],[14,7],[16,7],[16,4],[18,4],[18,1],[20,1],[20,5],[19,5]],
  swamp:   [[0,5],[2,5],[2,2],[4,2],[4,7],[6,7],[6,4],[8,4],[8,8],[10,8],[10,5],[12,5],[12,1],[14,1],[14,4],[16,4],[16,8],[18,8],[18,5],[20,5],[20,2],[19,2]],
  volcano: [[0,4],[3,4],[3,1],[5,1],[5,6],[7,6],[7,3],[9,3],[9,8],[11,8],[11,5],[13,5],[13,2],[15,2],[15,7],[17,7],[17,4],[19,4],[19,1],[20,1]],
  tundra:  [[0,3],[2,3],[2,7],[4,7],[4,2],[7,2],[7,5],[9,5],[9,1],[11,1],[11,6],[13,6],[13,3],[15,3],[15,8],[17,8],[17,5],[19,5],[19,2],[20,2]],
  desert:  [[0,6],[2,6],[2,2],[4,2],[4,8],[6,8],[6,4],[9,4],[9,7],[11,7],[11,2],[13,2],[13,6],[15,6],[15,3],[17,3],[17,7],[19,7],[19,4],[20,4]],
  ruins:   [[0,1],[2,1],[2,5],[4,5],[4,2],[6,2],[6,7],[8,7],[8,4],[10,4],[10,8],[12,8],[12,3],[14,3],[14,6],[16,6],[16,2],[18,2],[18,5],[20,5],[20,3],[19,3]],
  ocean:   [[0,2],[3,2],[3,5],[1,5],[1,8],[4,8],[4,6],[6,6],[6,1],[8,1],[8,4],[10,4],[10,8],[12,8],[12,5],[14,5],[14,2],[16,2],[16,6],[18,6],[18,3],[20,3]],
  citadel: [[0,5],[2,5],[2,2],[5,2],[5,4],[3,4],[3,7],[6,7],[6,5],[8,5],[8,1],[10,1],[10,4],[12,4],[12,8],[14,8],[14,5],[16,5],[16,2],[18,2],[18,6],[19,6]],
  hellgate:[[0,4],[2,4],[2,1],[4,1],[4,6],[6,6],[6,3],[8,3],[8,7],[10,7],[10,2],[12,2],[12,5],[14,5],[14,8],[16,8],[16,4],[18,4],[18,1],[20,1],[20,5],[19,5]],
};
const WORLD_MAPS = ['forest','canyon','swamp','volcano','tundra','desert','ruins','ocean','citadel','hellgate'];

function getMapForStage(stageId: string): string {
  const world = parseInt(stageId.split('-')[0], 10);
  return (world >= 1 && world <= 10) ? WORLD_MAPS[world - 1] : 'forest';
}

// Convert tile-coord waypoints to tile-float coords (center of each tile)
function getWaypoints(mapKey: string): { x:number; y:number }[] {
  const raw = MAP_WAYPOINTS[mapKey] ?? MAP_WAYPOINTS.forest;
  return raw.map(([c,r]) => ({ x: c + 0.5, y: r + 0.5 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVE CONFIG  (mirrors getWaveConfigByIndex in game.js)
// ─────────────────────────────────────────────────────────────────────────────
interface EnemyGroup { type:string; count:number; }

function getWaveConfig(stageId: string, wave: number): EnemyGroup[] {
  const [wStr, sStr] = stageId.split('-');
  const world = parseInt(wStr, 10), stageNum = parseInt(sStr, 10);
  const stageIdx = (world - 1) * 10 + stageNum - 1;
  const baseCount = 3 + (wave - 1) + Math.floor(stageIdx * 0.8);

  if (stageNum === 10) {
    if (wave === 10) return [{ type:'boss', count:1 }, { type:'black', count:4 }];
    if (wave >= 8)   return [{ type:'purple', count:2 }, { type:'black', count:3 }];
    if (wave >= 6)   return [{ type:'pink', count:2 }, { type:'yellow', count:3 }];
    if (wave >= 4)   return [{ type:'green', count:3 }, { type:'yellow', count:2 }];
    return [{ type:'red', count:Math.floor(baseCount/2) }, { type:'blue', count:Math.ceil(baseCount/2) }];
  }

  const TIERS = ['red','blue','green','yellow','pink','black','purple'];
  const maxTierIdx = (stageNum - 1) <= 2 ? 2 : (stageNum - 1) <= 5 ? 3 : 4;
  let types: string[];
  if (wave <= 3)      types = ['red'];
  else if (wave <= 5) types = ['red','blue'];
  else if (wave <= 7) types = ['blue','green'];
  else if (wave <= 9) {
    const secondTop = Math.max(2, maxTierIdx - 1);
    types = maxTierIdx > 2 ? [TIERS[secondTop], TIERS[maxTierIdx]] : ['green'];
  } else              types = [TIERS[maxTierIdx]];

  return types.map((t, i) => ({
    type: t,
    count: i === 0 ? Math.floor(baseCount / types.length) : Math.ceil(baseCount / types.length),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// HP / GOLD HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function getCampaignHpMult(stageId: string): number {
  const [wStr, sStr] = stageId.split('-');
  const globalStage = (parseInt(wStr, 10) - 1) * 10 + parseInt(sStr, 10);
  return 1 + Math.floor((globalStage - 1) / 5) * 0.05;
}

// Spawn interval between enemies in a wave — mirrors game.js line 5764
function spawnIntervalMs(wave: number): number {
  return Math.max(350, 1000 - wave * 50);
}

// Wave completion gold — mirrors killEnemy bonus in game.js
function waveCompletionGold(waveGoldBonus: number): number {
  return Math.round(50 * (1 + waveGoldBonus));
}

// ─────────────────────────────────────────────────────────────────────────────
// GACHA LEVEL
// ─────────────────────────────────────────────────────────────────────────────
const GACHA_LV_THRESH = [0,3,8,16,30,50,80,120,180,250];
function gachaLevel(pts: number): number {
  for (let i = 9; i >= 0; i--) if (pts >= GACHA_LV_THRESH[i]) return Math.min(i+1, 10);
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCH BONUSES
// ─────────────────────────────────────────────────────────────────────────────
interface ResearchBonuses { tower_dmg:number; tower_spd:number; tower_range:number; start_lives:number; wave_gold:number; start_gold:number; }

function computeResearchBonuses(research: Record<string,{done?:boolean}> | null): ResearchBonuses {
  const rb: ResearchBonuses = { tower_dmg:0, tower_spd:0, tower_range:0, start_lives:0, wave_gold:0, start_gold:0 };
  if (!research) return rb;
  const done = (id: string) => !!(research[id]?.done);
  if (done('def1_i'))          rb.tower_dmg  += 0.08;
  if (done('def1_ii'))         rb.tower_dmg  += 0.12;
  if (done('def1_iii'))        rb.tower_dmg  += 0.25;
  if (done('mag_syn_iii'))   { rb.tower_dmg  += 0.20; rb.tower_spd += 0.12; }
  if (done('unified_def_iv'))  rb.tower_dmg  += 0.35;
  if (done('transcendent_v'))  rb.tower_dmg  += 0.50;
  if (done('def2_i'))          rb.tower_spd  += 0.06;
  if (done('def2_ii'))         rb.tower_spd  += 0.10;
  if (done('def2_iii'))        rb.tower_spd  += 0.18;
  if (done('unified_def_iv'))  rb.tower_spd  += 0.25;
  if (done('transcendent_v'))  rb.tower_spd  += 1.00;
  if (done('mag2_i'))          rb.tower_range += 0.05;
  if (done('mag2_ii'))         rb.tower_range += 0.08;
  if (done('mag2_iii'))        rb.tower_range += 0.15;
  if (done('def3_i'))          rb.start_lives += 2;
  if (done('def3_ii'))         rb.start_lives += 3;
  if (done('mag3_ii'))         rb.start_lives += 4;
  if (done('def3_iii'))        rb.start_lives += 8;
  if (done('unified_def_iv'))  rb.start_lives += 12;
  if (done('transcendent_v'))  rb.start_lives += 20;
  if (done('def4_ii'))         rb.wave_gold   += 0.15;
  if (done('econ2_i'))         rb.start_gold  += 25;
  if (done('econ2_ii'))        rb.start_gold  += 50;
  if (done('econ2_iii'))     { rb.start_gold  += 100; rb.wave_gold += 0.25; }
  if (done('unified_econ_iv')){ rb.start_gold += 200; rb.wave_gold += 0.50; }
  if (done('transcendent_v'))  rb.start_gold  += 300;
  return rb;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKET BONUSES
// ─────────────────────────────────────────────────────────────────────────────
interface MarketBonuses { tower_dmg:number; tower_spd:number; tower_range:number; wave_gold:number; }

type ItemPassive = [string, string, number, string|null, number];
const HERO_PASSIVES: ItemPassive[] = [
  ['iron_paladin','tower_dmg',0.4,null,0],['storm_archer','tower_dmg',0.7,null,0],
  ['shadow_rogue','tower_spd',0.6,null,0],['frost_golem','tower_range',1.0,null,0],
  ['arcane_fox','tower_dmg',1.2,null,0],['void_panther','tower_spd',1.5,null,0],
  ['storm_phoenix','tower_dmg',1.8,null,0],['celestial_dragon','tower_dmg',2.5,'tower_spd',1.0],
  ['titan_wolf','tower_dmg',1.0,'wave_gold',3.0],['cosmos_serpent','tower_dmg',4.0,'tower_spd',2.0],
  ['ember_witch','wave_gold',0.5,null,0],
];
const RELIC_PASSIVES: ItemPassive[] = [
  ['iron_crest','tower_dmg',0.30,null,0],['stone_tablet','tower_dmg',0.25,null,0],
  ['wooden_totem','tower_spd',0.30,null,0],['rusted_arrowhead','tower_range',0.25,null,0],
  ['cracked_crystal','tower_dmg',0.30,null,0],['forest_seed','tower_spd',0.25,null,0],
  ['old_compass','tower_range',0.30,null,0],['ancient_tome','tower_dmg',0.60,null,0],
  ['wind_charm','tower_spd',0.50,null,0],['silver_ring','tower_dmg',0.55,null,0],
  ['storm_feather','tower_spd',0.60,null,0],['jade_fragment','tower_range',0.70,null,0],
  ['hunters_mark','tower_dmg',0.65,null,0],['speed_rune','tower_spd',0.55,null,0],
  ['watchers_eye','tower_range',0.60,null,0],['war_drum','tower_spd',1.00,null,0],
  ['battle_crest','tower_dmg',1.10,null,0],['elemental_core','tower_dmg',0.80,'tower_spd',0.40],
  ['rangers_lens','tower_range',1.20,null,0],['thunder_rune','tower_spd',1.10,null,0],
  ['iron_will','tower_dmg',1.00,null,0],['focus_crystal','tower_range',0.80,'tower_dmg',0.40],
  ['traders_codex','wave_gold',0.90,'tower_dmg',0.40],
  ['copper_coin','wave_gold',0.40,null,0],['tarnished_medal','wave_gold',0.35,null,0],
  ['dusty_scroll','wave_gold',0.30,null,0],['merchants_coin','wave_gold',0.65,null,0],
  ['lucky_charm','wave_gold',0.70,null,0],['moonstone','wave_gold',1.00,null,0],
  ['golden_scale','wave_gold',1.10,null,0],['phoenix_feather','tower_dmg',1.60,'tower_spd',0.60],
  ['time_shard','tower_spd',2.00,null,0],['chaos_orb','tower_dmg',1.80,'tower_spd',0.80],
  ['rift_stone','tower_dmg',2.00,null,0],['eclipse_gem','tower_spd',1.80,'wave_gold',0.80],
  ['dragon_scale','tower_dmg',1.70,'tower_range',0.70],['venom_crystal','tower_spd',1.60,'tower_dmg',0.80],
  ['storm_prism','tower_range',1.50,'tower_dmg',0.90],['arcane_codex','tower_dmg',1.90,'wave_gold',0.70],
  ['warlords_seal','tower_dmg',2.20,null,0],['emperors_seal','tower_dmg',2.00,'wave_gold',2.00],
  ['ancient_dragon_heart','tower_dmg',2.50,'tower_spd',1.50],
  ['celestial_map','tower_range',2.00,'wave_gold',1.50],
  ['war_gods_crest','tower_dmg',3.00,'tower_spd',1.00],
  ['fortune_crown','wave_gold',3.00,'tower_dmg',1.00],
  ['eternal_flame','tower_dmg',2.80,'tower_spd',1.20],
  ['universe_core','tower_dmg',2.50,'tower_range',1.50],
  ['void_crystal','tower_dmg',3.50,'tower_spd',1.50],
  ['cosmic_shard','tower_dmg',4.50,'tower_spd',2.00],
  ['eternity_stone','tower_dmg',4.00,'wave_gold',2.50],
];
const RELIC_DISENCHANT: { id:string; stat:string; perItem:number; stat2?:string; perItem2?:number }[] = [
  { id:'breakers_mark',    stat:'tower_dmg', perItem:0.15 },
  { id:'dissolution_core', stat:'tower_dmg', perItem:0.20, stat2:'tower_spd', perItem2:0.10 },
  { id:'void_remnant',     stat:'tower_dmg', perItem:0.30, stat2:'wave_gold', perItem2:0.15 },
  { id:'scrapper_seal',    stat:'wave_gold', perItem:0.10 },
];
const SKILL_PASSIVES: ItemPassive[] = [
  ['sk_basic_fortify','tower_dmg',0.35,null,0],['sk_quick_hands','tower_spd',0.30,null,0],
  ['sk_field_vision','tower_range',0.30,null,0],['sk_battle_cry','tower_dmg',0.60,null,0],
  ['sk_swift_reload','tower_spd',0.60,null,0],['sk_sharpshot','tower_range',0.70,null,0],
  ['sk_output_boost','tower_dmg',0.55,'tower_spd',0.25],
  ['sk_war_tactics','tower_dmg',1.00,'tower_spd',0.40],
  ['sk_economic_mastery','tower_dmg',0.40,'wave_gold',1.00],
  ['sk_scavenge','wave_gold',0.40,null,0],['sk_gold_finder','wave_gold',0.70,null,0],
  ['sk_plunderers_mark','tower_dmg',0.80,'wave_gold',1.60],
  ['sk_sniper_training','tower_range',1.20,'tower_dmg',0.40],
  ['sk_rapid_fire','tower_spd',1.20,'tower_dmg',0.40],
  ['sk_supreme_command','tower_dmg',1.80,'tower_spd',0.80],
  ['sk_siege_mastery','tower_dmg',1.60,'tower_range',0.80],
];

function applyPassivePool(b: Record<string,number>, pool: ItemPassive[], owned: Record<string,{pts:number}>|undefined) {
  if (!owned) return;
  for (const [id, s1, b1, s2, b2] of pool) {
    const pts = owned[id]?.pts; if (!pts) continue;
    const lv = gachaLevel(pts);
    b[s1] = (b[s1] ?? 0) + b1 * lv / 100;
    if (s2) b[s2] = (b[s2] ?? 0) + b2 * lv / 100;
  }
}

function computeMarketBonuses(ms: Record<string,unknown>|null): MarketBonuses {
  const b: Record<string,number> = { tower_dmg:0, tower_spd:0, tower_range:0, wave_gold:0 };
  if (!ms) return b as MarketBonuses;
  applyPassivePool(b, HERO_PASSIVES,  ms.heroes        as Record<string,{pts:number}>);
  applyPassivePool(b, RELIC_PASSIVES, ms.relics        as Record<string,{pts:number}>);
  applyPassivePool(b, SKILL_PASSIVES, ms.marketSkills  as Record<string,{pts:number}>);
  const dc = (ms.disenchantCount as number) ?? 0;
  if (dc > 0) {
    const relics = (ms.relics as Record<string,{pts:number}>) ?? {};
    for (const { id, stat, perItem, stat2, perItem2 } of RELIC_DISENCHANT) {
      if (relics[id]?.pts) {
        b[stat] = (b[stat] ?? 0) + dc * perItem / 100;
        if (stat2 && perItem2) b[stat2] = (b[stat2] ?? 0) + dc * perItem2 / 100;
      }
    }
  }
  return b as MarketBonuses;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLIANCE TERRITORY BONUSES
// ─────────────────────────────────────────────────────────────────────────────
interface AllianceBonuses { tower_dmg:number; tower_spd:number; mob_hp_reduce:number; extra_projectile:number; crit_bonus_avg:number; boss_dmg:number; slow:number; }

const TERRITORY_MILESTONES = [
  { tv:15,  type:'tower_dmg',        pct:0.15  },
  { tv:25,  type:'tower_spd',        pct:0.15  },
  { tv:40,  type:'slow',             pct:0.25  },
  { tv:60,  type:'extra_projectile', count:1   },
  { tv:80,  type:'mob_hp_reduce',    pct:0.20  },
  { tv:120, type:'crit_bonus',       pct:0.50  },
  { tv:150, type:'boss_dmg',         pct:0.15  },
];

function computeAllianceBonuses(tv: number): AllianceBonuses {
  const ab: AllianceBonuses = { tower_dmg:0, tower_spd:0, mob_hp_reduce:0, extra_projectile:0, crit_bonus_avg:0, boss_dmg:0, slow:0 };
  for (const m of TERRITORY_MILESTONES) {
    if (tv < m.tv) continue;
    if (m.type === 'tower_dmg')        ab.tower_dmg        += m.pct!;
    if (m.type === 'tower_spd')        ab.tower_spd        += m.pct!;
    if (m.type === 'mob_hp_reduce')    ab.mob_hp_reduce    += m.pct!;
    if (m.type === 'extra_projectile') ab.extra_projectile += m.count!;
    if (m.type === 'crit_bonus')       ab.crit_bonus_avg   += 0.10 * m.pct!;
    if (m.type === 'boss_dmg')         ab.boss_dmg         += m.pct!;
    if (m.type === 'slow')             ab.slow             += m.pct!;
  }
  return ab;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDER GEAR EFFECTS
// ─────────────────────────────────────────────────────────────────────────────
const GEAR_ITEM_STATS: Record<string,{atk?:number;atkSpeed?:number;range?:number;critChance?:number;critDmg?:number}> = {
  iron_sword:{atk:15,atkSpeed:5,range:0.2},shadow_dagger:{atk:12,atkSpeed:20,range:0.1,critChance:8},
  war_axe:{atk:35,atkSpeed:-10,range:0.4,critDmg:40},elven_bow:{atk:28,atkSpeed:15,range:1,critChance:5},
  enchanted_staff:{atk:50,atkSpeed:8,range:2,critChance:5,critDmg:30},
  stormcaller_blade:{atk:80,atkSpeed:15,range:1,critChance:10,critDmg:50},
  mythic_staff:{atk:120,atkSpeed:20,range:3,critChance:15,critDmg:100},
  iron_helmet:{},leather_cap:{atkSpeed:5},celestial_helm:{atkSpeed:10,critChance:8},
  chain_armor:{},iron_plate:{critChance:3},divine_plate:{critDmg:30},
  linen_pants:{},reinforced_leggings:{},dragonhide_leggings:{critChance:4},shadow_leggings:{critDmg:40},
  iron_boots:{},swiftwalkers:{atkSpeed:5,critChance:5},void_walker_boots:{atkSpeed:10,critChance:8},
  wooden_shield:{},magic_orb:{atk:15,range:1,critChance:6,critDmg:20},
  phoenix_shield:{atk:20,critChance:12,critDmg:60},
};
const GEAR_EFFECT_MAP: Record<string,string> = {
  stormcaller_blade:'chain_lightning', mythic_staff:'soul_drain',
  celestial_helm:'radiant',            divine_plate:'thorns',
  void_walker_boots:'void_aura',       phoenix_shield:'phoenix',
};

// Slot→valid item category: mainHand/offhand accept weapons, other slots accept armor/accessories
const VALID_SLOT_ITEMS: Record<string, Set<string>> = {
  mainHand: new Set(['iron_sword','shadow_dagger','war_axe','elven_bow','enchanted_staff','stormcaller_blade','mythic_staff']),
  offhand:  new Set(['iron_sword','shadow_dagger','war_axe','elven_bow','enchanted_staff','stormcaller_blade','mythic_staff',
                     'wooden_shield','magic_orb','phoenix_shield']),
  helmet:   new Set(['iron_helmet','leather_cap','celestial_helm']),
  armor:    new Set(['chain_armor','iron_plate','divine_plate']),
  pants:    new Set(['linen_pants','reinforced_leggings','dragonhide_leggings','shadow_leggings']),
  boots:    new Set(['iron_boots','swiftwalkers','void_walker_boots']),
};

interface CommanderStats {
  dmg:number; atkSpeedS:number; rangeTiles:number;
  activeEffects:Set<string>;
  gearFlags: string[];  // anti-cheat warnings for this commander
}

function computeCommanderStats(heroGear: Record<string,unknown>|null): CommanderStats {
  let gAtk=0, gAS=0, gRange=0, gCC=0, gCD=0;
  const effects = new Set<string>();
  const gearFlags: string[] = [];

  if (heroGear) {
    const eq       = (heroGear.equippedGear as Record<string,string>) ?? {};
    // Build owned-item ID set for ownership verification
    const ownedIds = new Set<string>();
    for (const inv of ['ownedWeapons','ownedGear'] as const) {
      for (const item of ((heroGear[inv] as Record<string,unknown>[]) ?? [])) {
        if (item.id) ownedIds.add(item.id as string);
      }
    }

    for (const slot of ['mainHand','offhand','helmet','armor','pants','boots']) {
      const id = eq[slot]; if (!id) continue;

      // 1. Item must be a recognised item for this slot
      if (!VALID_SLOT_ITEMS[slot]?.has(id)) {
        gearFlags.push(`unknown_item:${slot}:${id}`);
        continue;
      }
      // 2. Item must exist in the player's owned inventory
      if (!ownedIds.has(id)) {
        gearFlags.push(`unowned_item:${slot}:${id}`);
        continue;
      }
      // 3. Stats come from server-side GEAR_ITEM_STATS only — client values are never used
      const s = GEAR_ITEM_STATS[id];
      if (s) {
        gAtk   += s.atk       ?? 0;
        gAS    += s.atkSpeed  ?? 0;
        gRange += s.range     ?? 0;
        gCC    += s.critChance ?? 0;
        gCD    += s.critDmg   ?? 0;
      }
      const effect = GEAR_EFFECT_MAP[id];
      if (effect) effects.add(effect);
    }
  }

  const atkDmg    = 25 + gAtk;
  const atkSpeedS = Math.max(0.2, 1.2 / (1 + gAS / 100));
  const rangeTiles = 2.2 + gRange;
  const critMult  = 1 + (gCC / 100) * (gCD / 100);

  // Named gear effects applied to expected DPS:
  //   chain_lightning (stormcaller_blade): 25% proc arcing to nearby enemies at 60% dmg = +15% avg DPS
  //   soul_drain (mythic_staff): burn DoT on every hit = +10% avg DPS
  //   void_aura (void_walker_boots): 20% slow on nearby enemies — modelled as 10% global slow in simulation
  //   radiant (celestial_helm): 4 HP/s regen — defensive only, no DPS impact
  //   thorns (divine_plate): 30% melee reflect — defensive only
  //   phoenix (phoenix_shield): revive once per wave — defensive only
  let effectMult = 1.0;
  if (effects.has('chain_lightning')) effectMult *= 1.15;
  if (effects.has('soul_drain'))      effectMult *= 1.10;

  return {
    dmg: Math.round(atkDmg * critMult * effectMult),
    atkSpeedS, rangeTiles,
    activeEffects: effects,
    gearFlags,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TOWER STAT BUILDER  (research + market + alliance + tower-research bonuses)
// ─────────────────────────────────────────────────────────────────────────────
interface TowerStats {
  towerId: string; finalDmg:number; finalAtkSpeed:number; finalRangeTiles:number;
  finalProj:number; isAoe:boolean; isIceTower:boolean; isCatapult:boolean;
  col: number; row: number;
  baseDmg: number; baseAtkSpeed: number; baseRangeTiles: number;
  statsCapped: boolean;  // true if stored enchanted stats exceeded plausible cap and were clamped
}

function buildTowerStats(
  entry: Record<string,unknown>,
  rb: ResearchBonuses, mb: MarketBonuses, ab: AllianceBonuses,
  towerResLevels: Record<string,number>,
  col = -1, row = -1,
): TowerStats | null {
  const towerId = entry.towerId as string;
  const td = TOWER_DEFS[towerId]; if (!td) return null;
  const level = (entry.level as number) ?? 1;
  const resLv = towerResLevels[towerId] ?? 0;

  // Always derive base stats from towerId + level using server-authoritative formulas.
  // This is the ground truth regardless of what the armory snapshot says.
  const levelMult   = 1 + (level - 1) * td.upgPct;
  const computedDmg = td.baseDmg * levelMult;
  const computedAtk = td.baseAtkSpeed / Math.pow(1 + td.upgPct * 0.3, level - 1);

  // MAX_ENCHANT_MULT: enchantments can boost a stat, but not beyond 3× the base-level value.
  // If the stored value exceeds this we clamp it and record the flag.
  const MAX_ENCHANT_MULT = 3.0;

  let dmg: number, atk: number, range: number, proj: number;
  let statsCapped = false;

  if (entry.dmg !== undefined) {
    // Enchanted tower: use stored values but clamp to plausible bounds
    const storedDmg = entry.dmg as number;
    const storedAtk = entry.atkSpeed as number;
    const storedRange = entry.range as number;

    const cappedDmg   = Math.min(storedDmg,   computedDmg * MAX_ENCHANT_MULT);
    // atkSpeed is a cooldown — lower = faster. A stored value below base / MAX_ENCHANT_MULT means impossibly fast.
    const cappedAtk   = Math.max(storedAtk,   computedAtk / MAX_ENCHANT_MULT);
    const cappedRange = Math.min(storedRange,  td.baseRange * MAX_ENCHANT_MULT);

    if (cappedDmg < storedDmg || cappedAtk > storedAtk || cappedRange < storedRange) {
      statsCapped = true;
    }

    dmg   = cappedDmg;
    atk   = cappedAtk;
    range = cappedRange;
    proj  = (entry.projectiles as number) ?? td.baseProj;
  } else {
    dmg   = computedDmg;
    atk   = computedAtk;
    range = td.baseRange;
    proj  = td.baseProj;
  }

  const dmgMult   = 1 + rb.tower_dmg  + mb.tower_dmg  + ab.tower_dmg  + resLv * 0.05;
  const spdDiv    = 1 + rb.tower_spd  + mb.tower_spd  + ab.tower_spd  + resLv * 0.05;
  const rangeMult = 1 + rb.tower_range + mb.tower_range                + resLv * 0.05;
  const critMult  = 1 + ab.crit_bonus_avg;

  const finalDmg        = Math.round(dmg * dmgMult * critMult);
  const finalAtkSpeed   = atk / spdDiv;
  const finalRangeTiles = range * rangeMult;
  return {
    towerId,
    finalDmg, finalAtkSpeed, finalRangeTiles,
    finalProj:  td.isAoe ? proj : proj + ab.extra_projectile,
    isAoe:      td.isAoe,
    isIceTower: towerId === 'ice_tower',
    isCatapult: towerId === 'catapult',
    col, row,
    baseDmg: finalDmg, baseAtkSpeed: finalAtkSpeed, baseRangeTiles: finalRangeTiles,
    statsCapped,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK-BASED BATTLE SIMULATION
// All positions in TILE coordinates (1 tile = TILE_W px).
// Enemy speed in tiles/s = px_speed / TILE_W.
// Tower center = (col+0.5, row+0.5).
// ─────────────────────────────────────────────────────────────────────────────

interface SimEnemy {
  id: number; type: string;
  hp: number; maxHp: number;
  speedTiles: number;       // tiles/s
  x: number; y: number;    // tile coords
  wpIdx: number;            // next waypoint index
  totalDist: number;        // total tiles traveled (for "first" targeting)
  isDead: boolean; isReached: boolean;
  slowTimer: number;        // ms
  staggerTimer: number;     // ms
  waveNum: number; reward: number;
}

interface PlacedTower {
  stats: TowerStats;
  cx: number; cy: number;   // center tile coords
  cooldown: number;          // s until next shot
  addedAtWave: number;       // wave number when this tower becomes active
  ascended: boolean;
}

interface SimResult { won:boolean; livesLeft:number; wavesCleared:number; goldValid:boolean; goldLog:string[]; simLog:string[]; }

function dist2(ax:number,ay:number, bx:number,by:number): number {
  const dx=bx-ax, dy=by-ay; return Math.sqrt(dx*dx+dy*dy);
}

function runTickSimulation(
  stageId: string,
  waypoints: {x:number;y:number}[],
  // towers that are placed from the start (armory), keyed by addedAtWave=0
  initialTowers: PlacedTower[],
  commanderTower: PlacedTower | null,
  // shop placements ordered by wave — used to add towers/upgrades mid-battle
  shopPlacements: Record<string,unknown>[],
  rb: ResearchBonuses,
  mb: MarketBonuses,
  ab: AllianceBonuses,
  towerResLevels: Record<string,number>,
  hpMult: number,
  startGold: number,
  waveGoldBonus: number,
  commanderEffects: Set<string>,
): SimResult {
  const hpReduceMult = Math.max(0, 1 - ab.mob_hp_reduce);
  const startLives = 20 + rb.start_lives;

  let lives = startLives;
  let gold = startGold;
  let wavesCleared = 0;
  let nextEnemyId = 0;
  const simLog: string[] = [];
  const goldLog: string[] = [];
  let goldValid = true;

  // Active towers (start with armory towers)
  const towers: PlacedTower[] = [...initialTowers];
  if (commanderTower) towers.push(commanderTower);

  // void_aura slow from commander (20% slow → conservatively model as 10% on all enemies)
  const voidAuraSlow = commanderEffects.has('void_aura') ? 0.10 : 0;

  // Collect shop purchase events grouped by wave
  const PURCHASABLE = new Set(['archer','catapult','crossbow','ice_tower','sniper','inferno','ballista','poison_tower','tesla_tower','barricade']);
  const SHOP_COST: Record<string,number> = { archer:48,catapult:72,crossbow:108,ice_tower:80,sniper:152,inferno:340,ballista:144,poison_tower:172,tesla_tower:160,barricade:140 };
  const UPGRADE_COST: Record<string,number[]> = { range:[60,120,220], speed:[80,160,280], damage:[70,150,260] };

  // Group purchases by wave for timeline validation
  const purchasesByWave: Map<number, Record<string,unknown>[]> = new Map();
  for (const p of shopPlacements) {
    const wave = (p.wave as number) ?? 0;
    if (!purchasesByWave.has(wave)) purchasesByWave.set(wave, []);
    purchasesByWave.get(wave)!.push(p);
  }

  // Gold timeline validation: compute max possible gold at each wave boundary
  // (all enemies killed + wave completion bonus)
  // We validate after each wave that purchases in that wave were affordable.
  let cumulativeMaxGold = startGold;
  const maxGoldAtWaveStart: number[] = [0]; // index = wave (1-based)
  for (let w = 1; w <= 10; w++) {
    maxGoldAtWaveStart.push(cumulativeMaxGold);
    // Max gold earned THIS wave = all kills + wave completion
    const groups = getWaveConfig(stageId, w);
    let waveKillGold = 0;
    const addKillGold = (type: string, count: number) => {
      const d = ENEMY_DATA[type]; if (!d) return;
      waveKillGold += d.reward * count;
      if (d.spawnOnDeath) addKillGold(d.spawnOnDeath.type, d.spawnOnDeath.count * count);
    };
    for (const g of groups) addKillGold(g.type, g.count);
    cumulativeMaxGold += waveKillGold + waveCompletionGold(waveGoldBonus);
  }

  // Validate all purchases against their wave's max available gold
  let runningGoldCheck = startGold;
  for (let w = 0; w <= 10; w++) {
    const purchases = purchasesByWave.get(w) ?? [];
    let waveCost = 0;
    for (const p of purchases) {
      if (p.type === 'shopTower' && PURCHASABLE.has(p.towerId as string)) waveCost += SHOP_COST[p.towerId as string] ?? 0;
      else if (p.type === 'upgrade') waveCost += (UPGRADE_COST[p.upgradeKey as string] ?? [0])[((p.level as number)??1)-1] ?? 0;
      else if (p.type === 'ascension') waveCost += 100;
    }
    if (waveCost > 0) {
      const available = w === 0 ? startGold : maxGoldAtWaveStart[w];
      if (waveCost > available + 50) { // +50 rounding buffer
        goldLog.push(`wave ${w}: spent ${waveCost} gold but max available was ${available}`);
        goldValid = false;
      }
    }
    // Accumulate for running check
    if (w > 0) {
      const groups = getWaveConfig(stageId, w);
      for (const g of groups) {
        const d = ENEMY_DATA[g.type]; if (d) runningGoldCheck += d.reward * g.count;
      }
      runningGoldCheck += waveCompletionGold(waveGoldBonus);
    }
    runningGoldCheck -= waveCost;
  }

  // ── WAVE LOOP ──────────────────────────────────────────────────────────────
  for (let wave = 1; wave <= 10; wave++) {
    if (lives <= 0) break;

    // Apply all purchases for this wave: new towers, upgrades, ascensions
    const wavePurchases = purchasesByWave.get(wave) ?? [];
    for (const p of wavePurchases) {
      if (p.type === 'shopTower' && PURCHASABLE.has(p.towerId as string)) {
        const col = typeof p.col === 'number' ? p.col : COLS / 2;
        const row = typeof p.row === 'number' ? p.row : ROWS / 2;
        const stats = buildTowerStats({ towerId: p.towerId, level: 1 }, rb, mb, ab, towerResLevels, col, row);
        if (stats) towers.push({ stats, cx: col + 0.5, cy: row + 0.5, cooldown: 0, addedAtWave: wave, ascended: false });

      } else if (p.type === 'upgrade') {
        const pCol = p.col as number, pRow = p.row as number;
        const key  = p.upgradeKey as string;
        const lvl  = (p.level as number) ?? 1;
        const t = towers.find(t2 => t2.stats.col === pCol && t2.stats.row === pRow);
        if (t) {
          const s = t.stats;
          if (key === 'range')  t.stats = { ...s, finalRangeTiles: s.baseRangeTiles * (1 + lvl * 0.20) };
          else if (key === 'speed')  t.stats = { ...s, finalAtkSpeed: s.baseAtkSpeed  * (1 - lvl * 0.15) };
          else if (key === 'damage') t.stats = { ...s, finalDmg: Math.round(s.baseDmg * (1 + lvl * 0.25)) };
        }

      } else if (p.type === 'ascension' && p.towerId) {
        const pathIdx = typeof p.pathIdx === 'number' ? p.pathIdx : -1;
        if (pathIdx < 0) continue;
        const mult = ASCEND_MULTS[p.towerId as string]?.[pathIdx];
        if (!mult) continue;
        const pCol = p.col as number, pRow = p.row as number;
        const t = (typeof pCol === 'number' && pCol >= 0)
          ? towers.find(t2 => !t2.ascended && t2.stats.col === pCol && t2.stats.row === pRow && t2.stats.towerId === p.towerId)
          : towers.find(t2 => !t2.ascended && t2.stats.towerId === p.towerId);
        if (t) {
          t.ascended = true;
          t.stats = { ...t.stats,
            finalAtkSpeed: t.stats.finalAtkSpeed * mult.atkSpeedMult,
            finalDmg:      Math.round(t.stats.finalDmg * mult.dmgMult),
            finalProj:     t.stats.finalProj + mult.projDelta,
            isAoe:         t.stats.isAoe || mult.becomesAoe,
          };
        }
      }
    }

    // Build enemy list for this wave with HP scaling and spawn timing
    const groups = getWaveConfig(stageId, wave);
    const interval = spawnIntervalMs(wave);

    interface SpawnEntry { type:string; spawnAtMs:number; }
    const spawnQueue: SpawnEntry[] = [];
    let spawnMs = 0;
    for (const g of groups) {
      for (let i = 0; i < g.count; i++) {
        spawnQueue.push({ type: g.type, spawnAtMs: spawnMs });
        spawnMs += interval;
      }
    }

    // Enemies active in this wave
    const waveEnemies: SimEnemy[] = [];
    const allEnemies = () => waveEnemies.filter(e => !e.isDead && !e.isReached);

    const spawnEnemy = (type: string, spawnX: number, spawnY: number, wpStart: number): SimEnemy => {
      const d = ENEMY_DATA[type]!;
      const rawHp = Math.max(1, Math.round(d.hp * hpMult * hpReduceMult));
      return {
        id: nextEnemyId++, type,
        hp: rawHp, maxHp: rawHp,
        speedTiles: d.speed / TILE_W,
        x: spawnX, y: spawnY,
        wpIdx: wpStart,
        totalDist: 0,
        isDead: false, isReached: false,
        slowTimer: 0, staggerTimer: 0,
        waveNum: wave, reward: d.reward,
      };
    };

    let waveTimeMs = 0;
    const maxWaveMs = 120_000; // safety cap: 2 minutes per wave

    // Simulate wave
    while (waveTimeMs < maxWaveMs) {
      // Spawn pending enemies
      while (spawnQueue.length > 0 && waveTimeMs >= spawnQueue[0].spawnAtMs) {
        const s = spawnQueue.shift()!;
        waveEnemies.push(spawnEnemy(s.type, waypoints[0].x, waypoints[0].y, 1));
      }

      const living = allEnemies();
      if (living.length === 0 && spawnQueue.length === 0) break; // wave complete

      if (lives <= 0) break;

      // ── Tick enemies ──
      for (const e of waveEnemies) {
        if (e.isDead || e.isReached) continue;

        // Stagger: frozen
        if (e.staggerTimer > 0) {
          e.staggerTimer = Math.max(0, e.staggerTimer - TICK_MS);
          continue;
        }

        // Slow (ice + void_aura)
        const iceSlow = e.slowTimer > 0 ? (1 - ICE_SLOW_FACTOR) : 0;
        if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - TICK_MS);
        const totalSlow = Math.min(iceSlow + voidAuraSlow, 0.80);
        const effectiveSpeed = e.speedTiles * (1 - totalSlow);

        let move = effectiveSpeed * TICK_S;
        while (move > 0 && e.wpIdx < waypoints.length) {
          const wp = waypoints[e.wpIdx];
          const dx = wp.x - e.x, dy = wp.y - e.y;
          const d = dist2(e.x, e.y, wp.x, wp.y);
          if (d <= move) {
            e.x = wp.x; e.y = wp.y;
            e.totalDist += d;
            move -= d;
            e.wpIdx++;
            if (e.wpIdx >= waypoints.length) { e.isReached = true; lives--; break; }
          } else {
            e.x += (dx / d) * move; e.y += (dy / d) * move;
            e.totalDist += move; move = 0;
          }
        }
      }

      if (lives <= 0) break;

      // ── Tick towers ──
      for (const tower of towers) {
        if (tower.addedAtWave > wave) continue;
        tower.cooldown = Math.max(0, tower.cooldown - TICK_S);
        if (tower.cooldown > 0) continue;
        if (tower.stats.finalDmg <= 0) continue;

        // Gather enemies in range
        const inRange = waveEnemies.filter(e =>
          !e.isDead && !e.isReached &&
          dist2(tower.cx, tower.cy, e.x, e.y) <= tower.stats.finalRangeTiles
        );
        if (inRange.length === 0) continue;

        // "First" targeting: most path distance traveled
        inRange.sort((a, b) => b.totalDist - a.totalDist);

        tower.cooldown = tower.stats.finalAtkSpeed;

        if (tower.stats.isAoe) {
          // Hit all enemies in range
          for (const e of inRange) {
            e.hp -= tower.stats.finalDmg;
            if (tower.stats.isCatapult) e.staggerTimer = CATAPULT_STAGGER;
            if (tower.stats.isIceTower) e.slowTimer = ICE_SLOW_DURATION;
            if (e.hp <= 0 && !e.isDead) {
              e.isDead = true;
              gold += e.reward;
              // On-death spawns — spawn at enemy's current position, after the waypoint it just passed
              if (e.wpIdx < waypoints.length) {
                const dType = ENEMY_DATA[e.type]?.spawnOnDeath;
                if (dType) {
                  for (let c = 0; c < dType.count; c++) {
                    // Child spawns at parent's death position, same waypoint progress
                    const child = spawnEnemy(dType.type, e.x, e.y, e.wpIdx);
                    child.totalDist = e.totalDist; // inherit path progress
                    waveEnemies.push(child);
                  }
                }
              }
            }
          }
        } else {
          // Single / multi-projectile: hit top N enemies by path progress
          const targets = inRange.slice(0, tower.stats.finalProj);
          for (const t of targets) {
            t.hp -= tower.stats.finalDmg;
            if (tower.stats.isIceTower) t.slowTimer = ICE_SLOW_DURATION;
            // Alliance slow on non-AoE hit
            if (ab.slow > 0) t.slowTimer = Math.max(t.slowTimer, ICE_SLOW_DURATION);
            if (t.hp <= 0 && !t.isDead) {
              t.isDead = true;
              gold += t.reward;
              if (t.wpIdx < waypoints.length) {
                const dType = ENEMY_DATA[t.type]?.spawnOnDeath;
                if (dType) {
                  for (let c = 0; c < dType.count; c++) {
                    const child = spawnEnemy(dType.type, t.x, t.y, t.wpIdx);
                    child.totalDist = t.totalDist;
                    waveEnemies.push(child);
                  }
                }
              }
            }
          }
        }
      }

      waveTimeMs += TICK_MS;
    }

    // Wave ended — grant wave completion gold
    if (lives > 0) {
      wavesCleared = wave;
      gold += waveCompletionGold(waveGoldBonus);
    }

    const leaked = waveEnemies.filter(e => e.isReached).length;
    const killed = waveEnemies.filter(e => e.isDead).length;
    simLog.push(`wave ${wave}: ${killed} killed, ${leaked} leaked, lives=${lives}, gold=${Math.round(gold)}`);
  }

  return {
    won: lives > 0 && wavesCleared === 10,
    livesLeft: Math.max(0, lives),
    wavesCleared,
    goldValid,
    goldLog,
    simLog,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GEAR FINGERPRINT
// ─────────────────────────────────────────────────────────────────────────────
function buildGearFingerprint(heroGear: Record<string,unknown>|null): string {
  if (!heroGear) return '';
  const eq = (heroGear.equippedGear as Record<string,string>) ?? {};
  const allInv = [...((heroGear.ownedWeapons as unknown[]) ?? []), ...((heroGear.ownedGear as unknown[]) ?? [])];
  const parts: string[] = [];
  for (const slot of ['armor','boots','helmet','mainHand','offhand','pants']) {
    const id = eq[slot]; if (!id) continue;
    const item = (allInv as Record<string,unknown>[]).find(i => i.id === id);
    const lv = (item?.level as number) ?? 1;
    parts.push(`${slot}:${id}:${lv}`);
  }
  return parts.join('|');
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE REWARDS
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_REWARDS: Record<string,Record<string,number>> = {
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

// Gold shop costs (server-authoritative, used for spending cap check)
const SHOP_GOLD_COST: Record<string,number> = { archer:48,catapult:72,crossbow:108,ice_tower:80,sniper:152,inferno:340,ballista:144,poison_tower:172,tesla_tower:160,barricade:140 };
const UPGRADE_GOLD_COST: Record<string,number[]> = { range:[60,120,220], speed:[80,160,280], damage:[70,150,260] };

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error:'Missing Authorization' }), { status:401, headers:corsHeaders });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, { global:{ headers:{ Authorization: authHeader } } });
    const { data:{ user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error:'Unauthorized' }), { status:401, headers:corsHeaders });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const body = await req.json() as {
      battleId: string;
      armoryPlacements?: unknown[];     // {armoryIdx, col, row}
      commanderPlacement?: { col:number; row:number } | null;
      gearFingerprint?: string;
    };
    const {
      battleId,
      armoryPlacements = [],
      commanderPlacement = null,
      gearFingerprint = '',
    } = body;
    if (!battleId) return new Response(JSON.stringify({ error:'battleId required' }), { status:400, headers:corsHeaders });

    // ── Fetch battle record ────────────────────────────────────────────────
    const { data: battle, error: bErr } = await adminClient.from('idw_battle_attempts').select('*').eq('id', battleId).eq('user_id', user.id).single();
    if (bErr || !battle) return new Response(JSON.stringify({ error:'Battle not found' }), { status:404, headers:corsHeaders });
    if (battle.result !== 'started') return new Response(JSON.stringify({ error:'Battle already resolved' }), { status:409, headers:corsHeaders });

    if ((battle.stage_id as string).startsWith('elite:')) {
      await adminClient.from('idw_battle_attempts').update({ result:'defeat', finished_at:new Date().toISOString(), client_report:{ note:'Elite battles not yet server-simulated' } }).eq('id', battleId);
      return new Response(JSON.stringify({ reward:{}, xp_gained:0, first_clear:false, eliteNotSimulated:true }), { headers:corsHeaders });
    }

    const startedAt = new Date(battle.started_at).getTime();
    const elapsedSec = (Date.now() - startedAt) / 1000;
    if (elapsedSec < 10) return new Response(JSON.stringify({ error:`Battle ended too quickly (${Math.round(elapsedSec)}s)` }), { status:400, headers:corsHeaders });

    // ── Fetch player state ─────────────────────────────────────────────────
    const { data: player, error: pErr } = await adminClient.from('idw_player_state').select('research, tower_research_levels, market_state, hero_gear').eq('user_id', user.id).single();
    if (pErr || !player) return new Response(JSON.stringify({ error:'Player not found' }), { status:404, headers:corsHeaders });

    // ── Alliance bonuses ───────────────────────────────────────────────────
    let alTV = 0, alDmg=0, alSpd=0, alHpRed=0, alProj=0, alCrit=0, alBoss=0;
    try {
      const { data: alMember } = await adminClient.from('idw_alliance_members').select('alliance_id').eq('user_id', user.id).maybeSingle();
      if (alMember?.alliance_id) {
        const { data: alMembers } = await adminClient.from('idw_alliance_members').select('user_id').eq('alliance_id', alMember.alliance_id);
        const ids = (alMembers ?? []).map((m: Record<string,string>) => m.user_id);
        const { data: tiles } = ids.length > 0
          ? await adminClient.from('pvp_world').select('territory_value,territory_bonus_type,territory_bonus_value').in('owner_id', ids)
          : { data:[] };
        type TR = { territory_value:number; territory_bonus_type:string|null; territory_bonus_value:number };
        alTV = (tiles ?? []).reduce((s:number, t:TR) => s + (t.territory_value ?? 1), 0);
        for (const t of (tiles ?? []) as TR[]) {
          const bv = t.territory_bonus_value ?? 0;
          if (t.territory_bonus_type === 'tower_dmg')        alDmg   += bv;
          else if (t.territory_bonus_type === 'tower_spd')   alSpd   += bv;
          else if (t.territory_bonus_type === 'mob_hp_reduce') alHpRed += bv;
          else if (t.territory_bonus_type === 'extra_projectile') alProj += bv;
          else if (t.territory_bonus_type === 'crit_bonus')  alCrit  += 0.10 * bv;
          else if (t.territory_bonus_type === 'boss_dmg')    alBoss  += bv;
        }
      }
    } catch (_) { /* best-effort */ }

    // ── Compute bonuses ────────────────────────────────────────────────────
    const rb = computeResearchBonuses(player.research as Record<string,{done?:boolean}>);
    const mb = computeMarketBonuses(player.market_state as Record<string,unknown>);
    const ab = computeAllianceBonuses(alTV);
    ab.tower_dmg += alDmg; ab.tower_spd += alSpd; ab.mob_hp_reduce += alHpRed;
    ab.extra_projectile += alProj; ab.crit_bonus_avg += alCrit; ab.boss_dmg += alBoss;

    const towerResLevels = (player.tower_research_levels as Record<string,number>) ?? {};
    const storedGear = player.hero_gear as Record<string,unknown> | null;

    // ── Gear fingerprint ───────────────────────────────────────────────────
    const serverFingerprint = buildGearFingerprint(storedGear);
    const fingerprintMatch = !gearFingerprint || serverFingerprint === gearFingerprint;

    // ── Shop purchases — read from DB (server-recorded, not client-trusted) ──
    const shopPurchases = (battle.shop_purchases as Record<string,unknown>[]) ?? [];

    // Total gold spent (authoritative recompute from DB-recorded purchases)
    let goldSpent = 0;
    for (const p of shopPurchases) {
      if (p.type === 'shopTower')  goldSpent += SHOP_GOLD_COST[p.towerId as string] ?? 0;
      else if (p.type === 'upgrade')   goldSpent += (UPGRADE_GOLD_COST[p.upgradeKey as string] ?? [0])[((p.level as number)??1)-1] ?? 0;
      else if (p.type === 'ascension') goldSpent += 100;
    }

    // ── Build tower list from armory (consumed_towers + placements) ────────
    const consumedTowers = (battle.consumed_towers as Record<string,unknown>[]) ?? [];
    const armoryPlacementsArr = armoryPlacements as { armoryIdx:number; col:number; row:number }[];
    const PURCHASABLE_SET = new Set(['archer','catapult','crossbow','ice_tower','sniper','inferno','ballista','poison_tower','tesla_tower','barricade']);

    // Build initial tower list (armory towers that have been placed)
    const initialTowers: PlacedTower[] = [];
    for (const ap of armoryPlacementsArr) {
      const entry = consumedTowers[ap.armoryIdx];
      if (!entry) continue;
      const col = typeof ap.col === 'number' ? ap.col : COLS / 2;
      const row = typeof ap.row === 'number' ? ap.row : ROWS / 2;
      const stats = buildTowerStats(entry, rb, mb, ab, towerResLevels, col, row);
      if (!stats) continue;
      initialTowers.push({ stats, cx: col + 0.5, cy: row + 0.5, cooldown: 0, addedAtWave: 0, ascended: false });
    }

    // Any consumed towers NOT in armoryPlacements (old clients without position) — place at map center
    if (armoryPlacementsArr.length === 0 && consumedTowers.length > 0) {
      for (const entry of consumedTowers) {
        const stats = buildTowerStats(entry, rb, mb, ab, towerResLevels);
        if (stats) initialTowers.push({ stats, cx: COLS / 2, cy: ROWS / 2, cooldown: 0, addedAtWave: 0, ascended: false });
      }
    }

    // ── Commander tower ────────────────────────────────────────────────────
    const cmdStats = computeCommanderStats(storedGear);
    let commanderTower: PlacedTower | null = null;
    if (commanderPlacement) {
      const col = typeof commanderPlacement.col === 'number' ? commanderPlacement.col : COLS / 2;
      const row = typeof commanderPlacement.row === 'number' ? commanderPlacement.row : ROWS / 2;
      commanderTower = {
        stats: {
          towerId: '__commander__',
          finalDmg: cmdStats.dmg, finalAtkSpeed: cmdStats.atkSpeedS, finalRangeTiles: cmdStats.rangeTiles,
          finalProj: 1, isAoe: false, isIceTower: false, isCatapult: false,
          col, row,
          baseDmg: cmdStats.dmg, baseAtkSpeed: cmdStats.atkSpeedS, baseRangeTiles: cmdStats.rangeTiles,
          statsCapped: false,
        },
        cx: col + 0.5, cy: row + 0.5,
        cooldown: 0, addedAtWave: 0, ascended: false,
      };
    }

    // ── Start gold ─────────────────────────────────────────────────────────
    const startGold = 200 + rb.start_gold;
    const waveGoldBonus = rb.wave_gold + mb.wave_gold;

    // ── Run tick simulation ────────────────────────────────────────────────
    const mapKey = getMapForStage(battle.stage_id);
    const waypoints = getWaypoints(mapKey);
    const hpMult = getCampaignHpMult(battle.stage_id);

    const sim = runTickSimulation(
      battle.stage_id, waypoints,
      initialTowers, commanderTower,
      shopPurchases,
      rb, mb, ab, towerResLevels,
      hpMult, startGold, waveGoldBonus,
      cmdStats.activeEffects,
    );

    // ── Gold cap cross-check (belt + suspenders) ───────────────────────────
    const { data: goldCapRpc } = await adminClient.rpc('idw_compute_gold_cap', {
      p_research: player.research, p_market_state: player.market_state, p_waves: sim.wavesCleared || 10,
    });
    const goldCap = (goldCapRpc as number) ?? 999999;
    const goldOk  = goldSpent <= goldCap;

    // Count capped towers (must come after initialTowers is built)
    const cappedTowerCount = initialTowers.filter(t => t.stats.statsCapped).length;

    // Battle is a win only when every check passes:
    //   - simulation says won
    //   - wave-by-wave gold timeline was valid
    //   - total gold spent within server-computed cap
    //   - commander has no unowned/unknown gear items
    //   - no tower had implausibly inflated stored stats
    const won = sim.won && sim.goldValid && goldOk
             && cmdStats.gearFlags.length === 0
             && cappedTowerCount === 0;

    const antiCheat = {
      durationSec:      Math.round(elapsedSec),
      durationOk:       elapsedSec >= 10,
      fingerprintMatch,
      clientFingerprint:gearFingerprint,
      serverFingerprint,
      // Commander verification
      commanderDmg:        cmdStats.dmg,
      commanderAtkSpeedS:  cmdStats.atkSpeedS,
      commanderRangeTiles: cmdStats.rangeTiles,
      commanderEffects:    [...cmdStats.activeEffects],
      commanderGearFlags:  cmdStats.gearFlags,          // unowned or unknown items
      commanderGearClean:  cmdStats.gearFlags.length === 0,
      commanderPlacement,
      // Turret verification
      towerCount:                initialTowers.length + (commanderTower ? 1 : 0),
      armoryPlacementsReceived:  armoryPlacementsArr.length,
      cappedTowerCount,                                  // towers whose stored stats exceeded 3× computed base
      // Simulation results
      simulationWon:    sim.won,
      simulationLives:  sim.livesLeft,
      simulationWaves:  sim.wavesCleared,
      // Gold verification
      goldValid:        sim.goldValid,
      goldLog:          sim.goldLog,
      goldSpent,
      goldCap,
      goldOk,
      simLog:           sim.debugLog ?? sim.simLog,
    };

    // ── Fetch player completion data ───────────────────────────────────────
    const { data: fullPlayer } = await adminClient.from('idw_player_state').select('campaign_completed').eq('user_id', user.id).single();
    const alreadyCompleted: string[] = (fullPlayer?.campaign_completed ?? []) as string[];
    const firstClear = won && !alreadyCompleted.includes(battle.stage_id);

    const fullReward = won ? (STAGE_REWARDS[battle.stage_id] ?? {}) : {};
    const xpGained   = (fullReward.xp as number) ?? 0;
    const resReward   = { ...fullReward }; delete resReward.xp;

    // ── Stamp simVerified + write result ───────────────────────────────────
    await adminClient.from('idw_battle_attempts').update({ client_report:{ simVerified:true, simResult:won } }).eq('id', battleId);

    const { data: rpcResult, error: rpcErr } = await userClient.rpc('idw_submit_battle_result', {
      p_battle_id:        battleId,
      p_won:              won && goldOk,
      p_waves:            sim.wavesCleared,
      p_lives:            sim.livesLeft,
      p_client_gold:      goldSpent,
      p_gear_fingerprint: gearFingerprint,
      p_shop_placements:  shopPlacements,
    });

    if (rpcErr) {
      console.error('idw_submit_battle_result failed:', rpcErr);
      await adminClient.from('idw_battle_attempts').update({ result: won ? 'victory':'defeat', finished_at:new Date().toISOString(), client_report:{ antiCheat, simVerified:true, error:rpcErr.message } }).eq('id', battleId);
      return new Response(JSON.stringify({ error: rpcErr.message }), { status:500, headers:corsHeaders });
    }

    await adminClient.from('idw_battle_attempts').update({ client_report:{ ...((rpcResult?.client_report) ?? {}), simVerified:true, antiCheat } }).eq('id', battleId);
    return new Response(JSON.stringify(rpcResult), { headers: corsHeaders });

  } catch (err) {
    console.error('campaign-simulate error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status:500, headers:corsHeaders });
  }
});
