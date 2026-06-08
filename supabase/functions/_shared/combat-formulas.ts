// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMBAT FORMULAS  —  imported by both campaign-simulate and pvp-simulate
//
// All computation functions live here so the two simulations are guaranteed to
// use identical logic.  If a formula changes, change it ONCE here.
//
// Client mirror: /shared/combat-config.js (contains equivalent JS functions).
// When you change a formula here, update the mirror too and bump BALANCE_VERSION.
// ─────────────────────────────────────────────────────────────────────────────

import {
  TOWER_DEFS, ENEMY_DATA, GEAR_ITEM_STATS, GEAR_EFFECT_MAP, VALID_SLOT_ITEMS,
  TERRITORY_MILESTONES, SPECIAL_TERRITORY_DEFS, COMMANDER_BASE,
  HERO_PASSIVES, RELIC_PASSIVES, SKILL_PASSIVES, RELIC_DISENCHANT,
  GACHA_LV_THRESH, MAX_ENCHANT_MULT,
  type TowerDef, type GearStats, type ItemPassive, type DisenchantPassive,
} from './combat-config.ts';

// ── Gacha level ────────────────────────────────────────────────────────────

export function gachaLevel(pts: number): number {
  for (let i = 9; i >= 0; i--) {
    if (pts >= GACHA_LV_THRESH[i]) return Math.min(i + 1, 10);
  }
  return 1;
}

// ── Research bonuses ───────────────────────────────────────────────────────
// Source of truth: game.js getResearchBonuses() — research section.

export interface ResearchBonuses {
  tower_dmg:   number;
  tower_spd:   number;
  tower_range: number;
  start_lives: number;
  wave_gold:   number;
  start_gold:  number;
}

export function computeResearchBonuses(
  research: Record<string, { done?: boolean }> | null,
): ResearchBonuses {
  const rb: ResearchBonuses = { tower_dmg: 0, tower_spd: 0, tower_range: 0, start_lives: 0, wave_gold: 0, start_gold: 0 };
  if (!research) return rb;
  const done = (id: string) => !!(research[id]?.done);

  if (done('def1_i'))          rb.tower_dmg   += 0.08;
  if (done('def1_ii'))         rb.tower_dmg   += 0.12;
  if (done('def1_iii'))        rb.tower_dmg   += 0.25;
  if (done('mag_syn_iii'))   { rb.tower_dmg   += 0.20; rb.tower_spd += 0.12; }
  if (done('unified_def_iv'))  rb.tower_dmg   += 0.35;
  if (done('transcendent_v'))  rb.tower_dmg   += 0.50;

  if (done('def2_i'))          rb.tower_spd   += 0.06;
  if (done('def2_ii'))         rb.tower_spd   += 0.10;
  if (done('def2_iii'))        rb.tower_spd   += 0.18;
  if (done('unified_def_iv'))  rb.tower_spd   += 0.25;
  if (done('transcendent_v'))  rb.tower_spd   += 1.00;

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

// ── Market bonuses (heroes / relics / skills) ──────────────────────────────
// Source of truth: game.js getMarketBonuses() + relic/skill passive logic.

export interface MarketBonuses {
  tower_dmg:   number;
  tower_spd:   number;
  tower_range: number;
  wave_gold:   number;
}

function applyPassivePool(
  b: Record<string, number>,
  pool: ItemPassive[],
  owned: Record<string, { pts: number }> | undefined,
): void {
  if (!owned) return;
  for (const [id, s1, b1, s2, b2] of pool) {
    const pts = owned[id]?.pts;
    if (!pts) continue;
    const lv = gachaLevel(pts);
    b[s1] = (b[s1] ?? 0) + b1 * lv / 100;
    if (s2) b[s2] = (b[s2] ?? 0) + b2 * lv / 100;
  }
}

export function computeMarketBonuses(
  ms: Record<string, unknown> | null,
  heroGear?: Record<string, unknown> | null,
): MarketBonuses {
  const b: Record<string, number> = { tower_dmg: 0, tower_spd: 0, tower_range: 0, wave_gold: 0 };
  if (!ms) return b as MarketBonuses;

  applyPassivePool(b, HERO_PASSIVES,  ms.heroes       as Record<string, { pts: number }>);
  applyPassivePool(b, RELIC_PASSIVES, ms.relics       as Record<string, { pts: number }>);
  applyPassivePool(b, SKILL_PASSIVES, ms.marketSkills as Record<string, { pts: number }>);

  // Disenchant count lives in hero_gear in PvP, market_state in campaign
  const dc = (heroGear?.disenchantCount as number) ?? (ms.disenchantCount as number) ?? 0;
  if (dc > 0) {
    const relics = (ms.relics as Record<string, { pts: number }>) ?? {};
    for (const { id, stat, perItem, stat2, perItem2 } of RELIC_DISENCHANT) {
      if (!relics[id]?.pts) continue;
      b[stat] = (b[stat] ?? 0) + dc * perItem / 100;
      if (stat2 && perItem2) b[stat2] = (b[stat2] ?? 0) + dc * perItem2 / 100;
    }
  }
  return b as MarketBonuses;
}

// ── Alliance bonuses ───────────────────────────────────────────────────────
// Source of truth: game.js getAllianceBuffs() + territory milestone logic.

export interface AllianceBonuses {
  tower_dmg:        number;
  tower_spd:        number;
  mob_hp_reduce:    number;
  extra_projectile: number;
  crit_bonus:       number;   // raw pct value from milestones (e.g. 0.50)
  crit_bonus_avg:   number;   // effective avg DPS boost = 0.10 * crit_bonus
  boss_dmg:         number;
  slow:             number;
}

export function computeAllianceBonuses(
  tv: number,
  ownedSpecialIds: string[] = [],
): AllianceBonuses {
  const ab: AllianceBonuses = {
    tower_dmg: 0, tower_spd: 0, mob_hp_reduce: 0,
    extra_projectile: 0, crit_bonus: 0, crit_bonus_avg: 0, boss_dmg: 0, slow: 0,
  };

  for (const m of TERRITORY_MILESTONES) {
    if (tv < m.tv) continue;
    if      (m.type === 'tower_dmg')        ab.tower_dmg        += m.pct!;
    else if (m.type === 'tower_spd')         ab.tower_spd        += m.pct!;
    else if (m.type === 'mob_hp_reduce')     ab.mob_hp_reduce    += m.pct!;
    else if (m.type === 'extra_projectile')  ab.extra_projectile += m.count!;
    else if (m.type === 'crit_bonus')      { ab.crit_bonus       += m.pct!; ab.crit_bonus_avg += 0.10 * m.pct!; }
    else if (m.type === 'boss_dmg')          ab.boss_dmg         += m.pct!;
    else if (m.type === 'slow')              ab.slow             += m.pct!;
  }

  for (const specialId of ownedSpecialIds) {
    const def = SPECIAL_TERRITORY_DEFS[specialId];
    if (!def) continue;
    if      (def.bonusStat === 'tower_dmg')       ab.tower_dmg        += def.bonusValue;
    else if (def.bonusStat === 'tower_spd')        ab.tower_spd        += def.bonusValue;
    else if (def.bonusStat === 'mob_hp_reduce')    ab.mob_hp_reduce    += def.bonusValue;
    else if (def.bonusStat === 'extra_projectile') ab.extra_projectile += def.bonusValue;
    else if (def.bonusStat === 'crit_bonus')     { ab.crit_bonus       += def.bonusValue; ab.crit_bonus_avg += 0.10 * def.bonusValue; }
    else if (def.bonusStat === 'boss_dmg')         ab.boss_dmg         += def.bonusValue;
    else if (def.bonusStat === 'slow')             ab.slow             += def.bonusValue;
  }
  return ab;
}

// ── Tower stat builder ─────────────────────────────────────────────────────
// Source of truth: game.js towerStatsAtLevel() + buff application in makeTower().

export interface TowerStats {
  towerId:          string;
  finalDmg:         number;
  finalAtkSpeed:    number;
  finalRangeTiles:  number;
  finalProj:        number;
  isAoe:            boolean;
  isIceTower:       boolean;
  isCatapult:       boolean;
  col:              number;
  row:              number;
  baseDmg:          number;
  baseAtkSpeed:     number;
  baseRangeTiles:   number;
  critBonusAvg:     number;
  statsCapped:      boolean;
}

export function buildTowerStats(
  entry: Record<string, unknown>,
  rb: ResearchBonuses,
  mb: MarketBonuses,
  ab: AllianceBonuses,
  towerResLevels: Record<string, number>,
  col = -1,
  row = -1,
): TowerStats | null {
  const towerId = entry.towerId as string;
  const td = TOWER_DEFS[towerId];
  if (!td) return null;

  const level  = (entry.level as number) ?? 1;
  const resLv  = towerResLevels[towerId] ?? 0;

  // Server-authoritative level-scaled base stats
  const levelMult   = 1 + (level - 1) * td.upgPct;
  const computedDmg = td.baseDmg * levelMult;
  const computedAtk = td.baseAtkSpeed / Math.pow(1 + td.upgPct * 0.3, level - 1);

  let dmg: number, atk: number, range: number, proj: number;
  let statsCapped = false;

  if (entry.dmg !== undefined) {
    // Enchanted tower: clamp stored stats to MAX_ENCHANT_MULT × computed base
    const storedDmg   = entry.dmg      as number;
    const storedAtk   = entry.atkSpeed as number;
    const storedRange = entry.range    as number;

    const cappedDmg   = Math.min(storedDmg,   computedDmg * MAX_ENCHANT_MULT);
    const cappedAtk   = Math.max(storedAtk,   computedAtk / MAX_ENCHANT_MULT);
    const cappedRange = Math.min(storedRange, td.baseRange * MAX_ENCHANT_MULT);

    if (cappedDmg < storedDmg || cappedAtk > storedAtk || cappedRange < storedRange) statsCapped = true;

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

  const dmgMult   = 1 + rb.tower_dmg   + mb.tower_dmg   + ab.tower_dmg  + resLv * 0.05;
  const spdDiv    = 1 + rb.tower_spd   + mb.tower_spd   + ab.tower_spd  + resLv * 0.05;
  const rangeMult = 1 + rb.tower_range + mb.tower_range                  + resLv * 0.05;

  const finalDmg        = Math.round(dmg * dmgMult * (1 + ab.crit_bonus_avg));
  const finalAtkSpeed   = atk / spdDiv;
  const finalRangeTiles = range * rangeMult;

  return {
    towerId,
    finalDmg, finalAtkSpeed, finalRangeTiles,
    finalProj:     td.isAoe ? proj : proj + ab.extra_projectile,
    isAoe:         td.isAoe,
    isIceTower:    towerId === 'ice_tower',
    isCatapult:    towerId === 'catapult',
    col, row,
    baseDmg:       finalDmg,
    baseAtkSpeed:  finalAtkSpeed,
    baseRangeTiles: finalRangeTiles,
    critBonusAvg:  ab.crit_bonus_avg,
    statsCapped,
  };
}

// ── Commander stats ────────────────────────────────────────────────────────
// Source of truth: game.js computeCommanderStats() / getCommanderFinalStats().

export interface CommanderResult {
  dmg:          number;
  atkSpeedS:    number;
  rangeTiles:   number;
  avgDmgPerHit: number;
  activeEffects: Set<string>;
  gearFlags:    string[];   // anti-cheat warnings
}

export function computeCommanderStats(
  heroGear: Record<string, unknown> | null,
): CommanderResult {
  let gAtk = 0, gAS = 0, gRange = 0, gCC = 0, gCD = 0;
  const effects = new Set<string>();
  const gearFlags: string[] = [];

  if (heroGear) {
    const eq = (heroGear.equippedGear as Record<string, string>) ?? {};

    const ownedIds = new Set<string>();
    for (const inv of ['ownedWeapons', 'ownedGear'] as const) {
      for (const item of ((heroGear[inv] as Record<string, unknown>[]) ?? [])) {
        if (item.id) ownedIds.add(item.id as string);
      }
    }

    for (const slot of ['mainHand', 'offhand', 'helmet', 'armor', 'pants', 'boots']) {
      const id = eq[slot];
      if (!id) continue;
      if (!VALID_SLOT_ITEMS[slot]?.has(id)) { gearFlags.push(`unknown_item:${slot}:${id}`); continue; }
      if (!ownedIds.has(id))                { gearFlags.push(`unowned_item:${slot}:${id}`); continue; }

      const s = GEAR_ITEM_STATS[id];
      if (s) {
        gAtk   += s.atk        ?? 0;
        gAS    += s.atkSpeed   ?? 0;
        gRange += s.range      ?? 0;
        gCC    += s.critChance ?? 0;
        gCD    += s.critDmg    ?? 0;
      }
      const effect = GEAR_EFFECT_MAP[id];
      if (effect) effects.add(effect);
    }
  }

  const baseDmg       = COMMANDER_BASE.atk + gAtk;
  const atkSpeedS     = Math.max(0.2, (COMMANDER_BASE.atkSpeedMs / (1 + gAS / 100)) / 1000);
  const rangeTiles    = COMMANDER_BASE.range + gRange;
  const critMult      = 1 + (gCC / 100) * (gCD / 100);

  // Named effect DPS multipliers (model average contribution)
  let effectMult = 1.0;
  if (effects.has('chain_lightning')) effectMult *= 1.15;
  if (effects.has('soul_drain'))      effectMult *= 1.10;

  const dmg         = Math.round(baseDmg * critMult * effectMult);
  const avgDmgPerHit = dmg;

  return { dmg, atkSpeedS, rangeTiles, avgDmgPerHit, activeEffects: effects, gearFlags };
}

// ── Elite campaign modifiers ───────────────────────────────────────────────
// Source of truth: game.js ELITE_MODIFIERS + getEliteModifiers().
// Seeded RNG matches the exact LCG the client uses so server selects identical modifiers.

export interface EliteConfig {
  hpMult:        number;   // multiply enemy HP (on top of campaign HP scaling)
  speedMult:     number;   // multiply enemy speed
  countMult:     number;   // multiply enemy count per wave group
  waveBonusMult: number;   // multiply wave completion gold
  dmgReduce:     number;   // fraction of damage absorbed (0.30 = 30% reduction)
  turretSlowMult: number;  // divide tower attack speed (>1 = slower towers)
  enemyRegen:    boolean;  // enemies regenerate 2% maxHp per second
}

export function defaultEliteConfig(): EliteConfig {
  return { hpMult: 1, speedMult: 1, countMult: 1, waveBonusMult: 1, dmgReduce: 0, turretSlowMult: 1, enemyRegen: false };
}

// LCG identical to game.js seededRandom()
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

// Modifier definitions in the same order as ELITE_MODIFIERS in game.js
const ELITE_MODIFIER_DEFS: Array<{ id: string; apply: (cfg: EliteConfig) => void }> = [
  { id: 'hp50',       apply: (c) => { c.hpMult        *= 1.5; } },
  { id: 'speed20',    apply: (c) => { c.speedMult      *= 1.2; } },
  { id: 'armor',      apply: (c) => { c.dmgReduce       = 0.30; } },
  { id: 'count50',    apply: (c) => { c.countMult       *= 1.5; } },
  { id: 'goldhalved', apply: (c) => { c.waveBonusMult   = 0.5; } },
  { id: 'slowturret', apply: (c) => { c.turretSlowMult  = 1.2; } },
  { id: 'regen',      apply: (c) => { c.enemyRegen      = true; } },
  { id: 'doublewave', apply: (c) => { c.countMult *= 2.0; c.waveBonusMult = (c.waveBonusMult || 1) * 0.5; } },
  { id: 'nointerest', apply: (c) => { c.waveBonusMult   = 0; } },
];

export function getEliteModifiers(baseStageId: string): string[] {
  const seed = baseStageId.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 0);
  const rng  = seededRandom(Math.abs(seed));
  const count = rng() < 0.4 ? 2 : 1;
  return [...ELITE_MODIFIER_DEFS]
    .sort(() => rng() - 0.5)
    .slice(0, count)
    .map(m => m.id);
}

export function buildEliteConfig(baseStageId: string): EliteConfig {
  const cfg = defaultEliteConfig();
  const ids = getEliteModifiers(baseStageId);
  for (const id of ids) {
    ELITE_MODIFIER_DEFS.find(m => m.id === id)?.apply(cfg);
  }
  return cfg;
}

// ── Wave config ────────────────────────────────────────────────────────────
// Source of truth: game.js getWaveConfigByIndex().

export interface EnemyGroup { type: string; count: number; }

export function getWaveConfig(stageId: string, wave: number): EnemyGroup[] {
  const [wStr, sStr] = stageId.split('-');
  const world     = parseInt(wStr, 10);
  const stageNum  = parseInt(sStr, 10);
  const stageIdx  = (world - 1) * 10 + stageNum - 1;
  const baseCount = 3 + (wave - 1) + Math.floor(stageIdx * 0.8);

  if (stageNum === 10) {
    if (wave === 10) return [{ type: 'boss', count: 1 }, { type: 'black', count: 4 }];
    if (wave >= 8)   return [{ type: 'purple', count: 2 }, { type: 'black', count: 3 }];
    if (wave >= 6)   return [{ type: 'pink', count: 2 }, { type: 'yellow', count: 3 }];
    if (wave >= 4)   return [{ type: 'green', count: 3 }, { type: 'yellow', count: 2 }];
    return [{ type: 'red', count: Math.floor(baseCount / 2) }, { type: 'blue', count: Math.ceil(baseCount / 2) }];
  }

  const TIERS     = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'purple'];
  const maxTierIdx = (stageNum - 1) <= 2 ? 2 : (stageNum - 1) <= 5 ? 3 : 4;
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
  return types.map((t, i) => ({
    type:  t,
    count: i === 0 ? Math.floor(baseCount / types.length) : Math.ceil(baseCount / types.length),
  }));
}

export function getPvpWaveConfig(diff: number, wave: number): EnemyGroup[] {
  const stageIdx  = diff - 1;
  const baseCount = 3 + (wave - 1) + Math.floor(stageIdx * 0.8);

  if (stageIdx >= 9) {
    if (wave === 10) return [{ type: 'boss', count: 1 }, { type: 'black', count: 4 }];
    if (wave >= 8)   return [{ type: 'purple', count: 2 }, { type: 'black', count: 3 }];
    if (wave >= 6)   return [{ type: 'pink', count: 2 }, { type: 'yellow', count: 3 }];
    if (wave >= 4)   return [{ type: 'green', count: 3 }, { type: 'yellow', count: 2 }];
    return [{ type: 'red', count: Math.floor(baseCount / 2) }, { type: 'blue', count: Math.ceil(baseCount / 2) }];
  }

  const TIERS      = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'purple'];
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
  return types.map((t, i) => ({
    type:  t,
    count: i === 0 ? Math.floor(baseCount / types.length) : Math.ceil(baseCount / types.length),
  }));
}

// ── HP / gold helpers ──────────────────────────────────────────────────────

export function getCampaignHpMult(stageId: string): number {
  const [wStr, sStr] = stageId.split('-');
  const globalStage  = (parseInt(wStr, 10) - 1) * 10 + parseInt(sStr, 10);
  return 1 + Math.floor((globalStage - 1) / 5) * 0.05;
}

export function spawnIntervalMs(wave: number): number {
  return Math.max(350, 1000 - wave * 50);
}

export function waveCompletionGold(waveGoldBonus: number): number {
  return Math.round(50 * (1 + waveGoldBonus));
}

// ── Gear fingerprint ───────────────────────────────────────────────────────

export function buildGearFingerprint(heroGear: Record<string, unknown> | null): string {
  if (!heroGear) return '';
  const eq     = (heroGear.equippedGear as Record<string, string>) ?? {};
  const allInv = [...((heroGear.ownedWeapons as unknown[]) ?? []), ...((heroGear.ownedGear as unknown[]) ?? [])];
  const parts: string[] = [];
  for (const slot of ['armor', 'boots', 'helmet', 'mainHand', 'offhand', 'pants']) {
    const id = eq[slot]; if (!id) continue;
    const item = (allInv as Record<string, unknown>[]).find(i => i.id === id);
    const lv   = (item?.level as number) ?? 1;
    parts.push(`${slot}:${id}:${lv}`);
  }
  return parts.join('|');
}

// ── Desync / anti-cheat validation helpers ─────────────────────────────────

/** Warns about towers whose IDs have no server definition (not in TOWER_DEFS). */
export function detectUnsupportedTowers(towerIds: string[]): string[] {
  return towerIds.filter(id => !TOWER_DEFS[id]);
}

/** Warns about enemy types whose IDs have no server definition. */
export function detectUnsupportedEnemies(enemyTypes: string[]): string[] {
  return enemyTypes.filter(t => !ENEMY_DATA[t]);
}

/** Warns about gear items whose IDs have no server definition. */
export function detectUnsupportedGear(itemIds: string[]): string[] {
  const known = new Set(Object.keys(GEAR_ITEM_STATS));
  return itemIds.filter(id => !known.has(id));
}
