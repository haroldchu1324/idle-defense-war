// ─────────────────────────────────────────────────────────────────────────────
// SHARED TICK-BASED BATTLE SIMULATION
// Used by both campaign-simulate and pvp-simulate.
// The only difference between campaign and PvP is the wave config function
// passed as `getWaveGroups` and the HP multiplier.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ENEMY_DATA, ASCEND_MULTS,
  SHOP_GOLD_COST, UPGRADE_GOLD_COST, ASCENSION_GOLD_COST,
  TILE_W, TICK_MS, TICK_S,
  ICE_SLOW_FACTOR, ICE_SLOW_DURATION, CATAPULT_STAGGER,
  START_LIVES,
} from './combat-config.ts';
import {
  type ResearchBonuses, type MarketBonuses, type AllianceBonuses,
  type TowerStats, type EnemyGroup, type EliteConfig,
  buildTowerStats, spawnIntervalMs, waveCompletionGold, defaultEliteConfig,
} from './combat-formulas.ts';

export interface SimEnemy {
  id: number; type: string;
  hp: number; maxHp: number;
  speedTiles: number;
  x: number; y: number;
  wpIdx: number; totalDist: number;
  isDead: boolean; isReached: boolean;
  slowTimer: number; staggerTimer: number;
  waveNum: number; reward: number;
}

export interface PlacedTower {
  stats: TowerStats;
  cx: number; cy: number;
  cooldown: number;
  addedAtWave: number;
  ascended: boolean;
}

export interface SimResult {
  won: boolean; livesLeft: number; wavesCleared: number;
  goldValid: boolean; goldLog: string[]; simLog: string[];
}

const PURCHASABLE_TOWER_IDS = new Set([
  'archer', 'catapult', 'crossbow', 'ice_tower', 'sniper',
  'inferno', 'ballista', 'poison_tower', 'tesla_tower', 'barricade',
]);

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function runTickSimulation(
  getWaveGroups: (wave: number) => EnemyGroup[],
  waypoints: { x: number; y: number }[],
  initialTowers: PlacedTower[],
  commanderTower: PlacedTower | null,
  shopPlacements: Record<string, unknown>[],
  rb: ResearchBonuses,
  mb: MarketBonuses,
  ab: AllianceBonuses,
  towerResLevels: Record<string, number>,
  hpMult: number,
  startGold: number,
  waveGoldBonus: number,
  commanderEffects: Set<string>,
  eliteConfig: EliteConfig = defaultEliteConfig(),
): SimResult {
  const hpReduceMult = Math.max(0, 1 - ab.mob_hp_reduce);
  const startLives   = START_LIVES + rb.start_lives;

  let lives = startLives;
  let gold  = startGold;
  let wavesCleared = 0;
  let nextEnemyId  = 0;
  const simLog:  string[] = [];
  const goldLog: string[] = [];
  let goldValid = true;

  const towers: PlacedTower[] = [...initialTowers];
  if (commanderTower) towers.push(commanderTower);

  // Apply turretSlowMult: multiply attack cooldown so towers fire slower
  if (eliteConfig.turretSlowMult !== 1) {
    for (const t of towers) {
      t.stats = { ...t.stats, finalAtkSpeed: t.stats.finalAtkSpeed * eliteConfig.turretSlowMult };
    }
  }

  const voidAuraSlow = commanderEffects.has('void_aura') ? 0.10 : 0;

  // Group purchases by wave
  const purchasesByWave = new Map<number, Record<string, unknown>[]>();
  for (const p of shopPlacements) {
    const wave = (p.wave as number) ?? 0;
    if (!purchasesByWave.has(wave)) purchasesByWave.set(wave, []);
    purchasesByWave.get(wave)!.push(p);
  }

  // Gold timeline validation: compute max possible gold at each wave boundary
  let cumulativeMaxGold = startGold;
  const maxGoldAtWaveStart: number[] = [0];
  for (let w = 1; w <= 10; w++) {
    maxGoldAtWaveStart.push(cumulativeMaxGold);
    const groups = getWaveGroups(w);
    let waveKillGold = 0;
    const addKillGold = (type: string, count: number) => {
      const d = ENEMY_DATA[type]; if (!d) return;
      waveKillGold += d.reward * count;
      if (d.spawnOnDeath) addKillGold(d.spawnOnDeath.type, d.spawnOnDeath.count * count);
    };
    for (const g of groups) addKillGold(g.type, g.count);
    cumulativeMaxGold += waveKillGold + Math.round(waveCompletionGold(waveGoldBonus) * eliteConfig.waveBonusMult);
  }

  // Validate purchases against wave-level gold availability
  for (let w = 0; w <= 10; w++) {
    const purchases = purchasesByWave.get(w) ?? [];
    let waveCost = 0;
    for (const p of purchases) {
      if (p.type === 'shopTower' && PURCHASABLE_TOWER_IDS.has(p.towerId as string))
        waveCost += SHOP_GOLD_COST[p.towerId as string] ?? 0;
      else if (p.type === 'upgrade')
        waveCost += (UPGRADE_GOLD_COST[p.upgradeKey as string] ?? [0])[((p.level as number) ?? 1) - 1] ?? 0;
      else if (p.type === 'ascension')
        waveCost += ASCENSION_GOLD_COST;
    }
    if (waveCost > 0) {
      const available = w === 0 ? startGold : maxGoldAtWaveStart[w];
      if (waveCost > available + 50) {
        goldLog.push(`wave ${w}: spent ${waveCost} gold but max available was ${available}`);
        goldValid = false;
      }
    }
  }

  // ── Wave loop ──────────────────────────────────────────────────────────────
  for (let wave = 1; wave <= 10; wave++) {
    if (lives <= 0) break;

    // Apply purchases for this wave
    for (const p of (purchasesByWave.get(wave) ?? [])) {
      if (p.type === 'shopTower' && PURCHASABLE_TOWER_IDS.has(p.towerId as string)) {
        const col   = typeof p.col === 'number' ? p.col : 0;
        const row   = typeof p.row === 'number' ? p.row : 0;
        const stats = buildTowerStats({ towerId: p.towerId, level: 1 }, rb, mb, ab, towerResLevels, col, row);
        if (stats) towers.push({ stats, cx: col + 0.5, cy: row + 0.5, cooldown: 0, addedAtWave: wave, ascended: false });

      } else if (p.type === 'upgrade') {
        const pCol = p.col as number, pRow = p.row as number;
        const key  = p.upgradeKey as string, lvl = (p.level as number) ?? 1;
        const t = towers.find(t2 => t2.stats.col === pCol && t2.stats.row === pRow);
        if (t) {
          const s = t.stats;
          if (key === 'range')       t.stats = { ...s, finalRangeTiles: s.baseRangeTiles * (1 + lvl * 0.20) };
          else if (key === 'speed')  t.stats = { ...s, finalAtkSpeed:   s.baseAtkSpeed   * (1 - lvl * 0.15) };
          else if (key === 'damage') t.stats = { ...s, finalDmg:        Math.round(s.baseDmg * (1 + lvl * 0.25)) };
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

    // Build spawn queue for this wave (apply countMult for elite)
    const groups   = getWaveGroups(wave);
    const interval = spawnIntervalMs(wave);
    interface SpawnEntry { type: string; spawnAtMs: number; }
    const spawnQueue: SpawnEntry[] = [];
    let spawnMs = 0;
    for (const g of groups) {
      const count = eliteConfig.countMult !== 1 ? Math.round(g.count * eliteConfig.countMult) : g.count;
      for (let i = 0; i < count; i++) { spawnQueue.push({ type: g.type, spawnAtMs: spawnMs }); spawnMs += interval; }
    }

    const waveEnemies: SimEnemy[] = [];
    const allLiving  = () => waveEnemies.filter(e => !e.isDead && !e.isReached);

    const spawnEnemy = (type: string, spawnX: number, spawnY: number, wpStart: number): SimEnemy => {
      const d = ENEMY_DATA[type]!;
      const rawHp = Math.max(1, Math.round(d.hp * hpMult * eliteConfig.hpMult * hpReduceMult));
      return {
        id: nextEnemyId++, type,
        hp: rawHp, maxHp: rawHp,
        speedTiles: d.speed * eliteConfig.speedMult / TILE_W,
        x: spawnX, y: spawnY,
        wpIdx: wpStart, totalDist: 0,
        isDead: false, isReached: false,
        slowTimer: 0, staggerTimer: 0,
        waveNum: wave, reward: d.reward,
      };
    };

    let waveTimeMs = 0;
    const maxWaveMs = 120_000;

    while (waveTimeMs < maxWaveMs) {
      while (spawnQueue.length > 0 && waveTimeMs >= spawnQueue[0].spawnAtMs) {
        const s = spawnQueue.shift()!;
        waveEnemies.push(spawnEnemy(s.type, waypoints[0].x, waypoints[0].y, 1));
      }
      if (allLiving().length === 0 && spawnQueue.length === 0) break;
      if (lives <= 0) break;

      // ── Tick enemies ──
      for (const e of waveEnemies) {
        if (e.isDead || e.isReached) continue;
        // Regen: 2% maxHp per second, applied every tick (matches client updateEnemies dt logic)
        if (eliteConfig.enemyRegen) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * TICK_S);
        if (e.staggerTimer > 0) { e.staggerTimer = Math.max(0, e.staggerTimer - TICK_MS); continue; }

        const iceSlow    = e.slowTimer > 0 ? (1 - ICE_SLOW_FACTOR) : 0;
        if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - TICK_MS);
        const totalSlow  = Math.min(iceSlow + voidAuraSlow, 0.80);
        const effSpeed   = e.speedTiles * (1 - totalSlow);

        let move = effSpeed * TICK_S;
        while (move > 0 && e.wpIdx < waypoints.length) {
          const wp = waypoints[e.wpIdx];
          const dx = wp.x - e.x, dy = wp.y - e.y;
          const d  = dist2(e.x, e.y, wp.x, wp.y);
          if (d <= move) {
            e.x = wp.x; e.y = wp.y; e.totalDist += d; move -= d; e.wpIdx++;
            if (e.wpIdx >= waypoints.length) { e.isReached = true; lives--; break; }
          } else {
            e.x += (dx / d) * move; e.y += (dy / d) * move; e.totalDist += move; move = 0;
          }
        }
      }
      if (lives <= 0) break;

      // ── Tick towers ──
      for (const tower of towers) {
        if (tower.addedAtWave > wave) continue;
        tower.cooldown = Math.max(0, tower.cooldown - TICK_S);
        if (tower.cooldown > 0 || tower.stats.finalDmg <= 0) continue;

        const inRange = waveEnemies.filter(e =>
          !e.isDead && !e.isReached &&
          dist2(tower.cx, tower.cy, e.x, e.y) <= tower.stats.finalRangeTiles
        );
        if (inRange.length === 0) continue;

        inRange.sort((a, b) => b.totalDist - a.totalDist);
        tower.cooldown = tower.stats.finalAtkSpeed;

        const killEnemy = (e: SimEnemy) => {
          e.isDead = true;
          gold += e.reward;
          if (e.wpIdx < waypoints.length) {
            const sp = ENEMY_DATA[e.type]?.spawnOnDeath;
            if (sp) {
              for (let c = 0; c < sp.count; c++) {
                const child = spawnEnemy(sp.type, e.x, e.y, e.wpIdx);
                child.totalDist = e.totalDist;
                waveEnemies.push(child);
              }
            }
          }
        };

        // dmgReduce: armor modifier absorbs a fraction of each hit (min 1 damage)
        const effectiveDmg = eliteConfig.dmgReduce > 0
          ? Math.max(1, Math.round(tower.stats.finalDmg * (1 - eliteConfig.dmgReduce)))
          : tower.stats.finalDmg;

        if (tower.stats.isAoe) {
          for (const e of inRange) {
            e.hp -= effectiveDmg;
            if (tower.stats.isCatapult) e.staggerTimer = CATAPULT_STAGGER;
            if (tower.stats.isIceTower) e.slowTimer    = ICE_SLOW_DURATION;
            if (e.hp <= 0 && !e.isDead) killEnemy(e);
          }
        } else {
          for (const t of inRange.slice(0, tower.stats.finalProj)) {
            t.hp -= effectiveDmg;
            if (tower.stats.isIceTower) t.slowTimer = ICE_SLOW_DURATION;
            if (ab.slow > 0)            t.slowTimer = Math.max(t.slowTimer, ICE_SLOW_DURATION);
            if (t.hp <= 0 && !t.isDead) killEnemy(t);
          }
        }
      }

      waveTimeMs += TICK_MS;
    }

    if (lives > 0) { wavesCleared = wave; gold += Math.round(waveCompletionGold(waveGoldBonus) * eliteConfig.waveBonusMult); }
    const leaked = waveEnemies.filter(e => e.isReached).length;
    const killed = waveEnemies.filter(e => e.isDead).length;
    simLog.push(`wave ${wave}: ${killed} killed, ${leaked} leaked, lives=${lives}, gold=${Math.round(gold)}`);
  }

  return { won: lives > 0 && wavesCleared === 10, livesLeft: Math.max(0, lives), wavesCleared, goldValid, goldLog, simLog };
}
