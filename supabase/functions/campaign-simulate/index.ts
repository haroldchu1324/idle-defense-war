// campaign-simulate: server-side tower-defense battle simulation
// Client sends { battleId, armoryPlacements, commanderPlacement, gearFingerprint }.
// Server runs a deterministic tick-based simulation (50ms ticks) using tower grid positions,
// enemy path traversal, and gold timing — the client's "won" claim is NEVER trusted.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  MAP_WAYPOINTS, WORLD_MAPS, STAGE_REWARDS,
  COLS, ROWS, MAX_ENCHANT_MULT, START_GOLD,
} from '../_shared/combat-config.ts';
import {
  computeResearchBonuses, computeMarketBonuses, computeAllianceBonuses,
  buildTowerStats, computeCommanderStats, buildGearFingerprint,
  getWaveConfig, getCampaignHpMult, buildEliteConfig,
  type ResearchBonuses, type MarketBonuses, type AllianceBonuses,
  type TowerStats,
} from '../_shared/combat-formulas.ts';
import { runTickSimulation, type PlacedTower } from '../_shared/combat-simulation.ts';
import { currentVersionSnapshot, type CombatVersionSnapshot } from '../_shared/combat-version.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON         = Deno.env.get('SUPABASE_ANON_KEY')!;

// ─────────────────────────────────────────────────────────────────────────────
// MAP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getMapForStage(stageId: string): string {
  const world = parseInt(stageId.split('-')[0], 10);
  return (world >= 1 && world <= 10) ? WORLD_MAPS[world - 1] : 'forest';
}

function getWaypoints(mapKey: string): { x: number; y: number }[] {
  const raw = MAP_WAYPOINTS[mapKey] ?? MAP_WAYPOINTS.forest;
  return raw.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick simulation is in _shared/combat-simulation.ts
// ─────────────────────────────────────────────────────────────────────────────

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
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: corsHeaders });

    const userClient  = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const body = await req.json() as {
      battleId: string;
      armoryPlacements?:    unknown[];
      commanderPlacement?:  { col: number; row: number } | null;
      gearFingerprint?:     string;
    };
    const { battleId, armoryPlacements = [], commanderPlacement = null, gearFingerprint = '' } = body;
    if (!battleId) return new Response(JSON.stringify({ error: 'battleId required' }), { status: 400, headers: corsHeaders });

    // ── Fetch battle record ────────────────────────────────────────────────
    const { data: battle, error: bErr } = await adminClient.from('idw_battle_attempts').select('*').eq('id', battleId).eq('user_id', user.id).single();
    if (bErr || !battle) return new Response(JSON.stringify({ error: 'Battle not found' }), { status: 404, headers: corsHeaders });
    if (battle.result !== 'started') return new Response(JSON.stringify({ error: 'Battle already resolved' }), { status: 409, headers: corsHeaders });

    // Resolve elite vs normal stage
    const rawStageId  = battle.stage_id as string;
    const isElite     = rawStageId.startsWith('elite:');
    const baseStageId = isElite ? rawStageId.slice(6) : rawStageId;

    const startedAt  = new Date(battle.started_at).getTime();
    const elapsedSec = (Date.now() - startedAt) / 1000;
    if (elapsedSec < 10) return new Response(JSON.stringify({ error: `Battle ended too quickly (${Math.round(elapsedSec)}s)` }), { status: 400, headers: corsHeaders });

    // ── Fetch player state ─────────────────────────────────────────────────
    const { data: player, error: pErr } = await adminClient.from('idw_player_state').select('research, tower_research_levels, market_state, hero_gear').eq('user_id', user.id).single();
    if (pErr || !player) return new Response(JSON.stringify({ error: 'Player not found' }), { status: 404, headers: corsHeaders });

    // ── Alliance bonuses ───────────────────────────────────────────────────
    let alTV = 0, alDmg = 0, alSpd = 0, alHpRed = 0, alProj = 0, alCrit = 0, alBoss = 0;
    try {
      const { data: alMember } = await adminClient.from('idw_alliance_members').select('alliance_id').eq('user_id', user.id).maybeSingle();
      if (alMember?.alliance_id) {
        const { data: alMembers } = await adminClient.from('idw_alliance_members').select('user_id').eq('alliance_id', alMember.alliance_id);
        const ids = (alMembers ?? []).map((m: Record<string, string>) => m.user_id);
        const { data: tiles } = ids.length > 0
          ? await adminClient.from('pvp_world').select('territory_value,territory_bonus_type,territory_bonus_value').in('owner_id', ids)
          : { data: [] };
        type TR = { territory_value: number; territory_bonus_type: string | null; territory_bonus_value: number };
        alTV = (tiles ?? []).reduce((s: number, t: TR) => s + (t.territory_value ?? 1), 0);
        for (const t of (tiles ?? []) as TR[]) {
          const bv = t.territory_bonus_value ?? 0;
          if      (t.territory_bonus_type === 'tower_dmg')        alDmg    += bv;
          else if (t.territory_bonus_type === 'tower_spd')         alSpd    += bv;
          else if (t.territory_bonus_type === 'mob_hp_reduce')     alHpRed  += bv;
          else if (t.territory_bonus_type === 'extra_projectile')  alProj   += bv;
          else if (t.territory_bonus_type === 'crit_bonus')        alCrit   += 0.10 * bv;
          else if (t.territory_bonus_type === 'boss_dmg')          alBoss   += bv;
        }
      }
    } catch (_) { /* best-effort */ }

    // ── Compute all bonuses ────────────────────────────────────────────────
    const rb = computeResearchBonuses(player.research as Record<string, { done?: boolean }>);
    const mb = computeMarketBonuses(player.market_state as Record<string, unknown>);
    const ab = computeAllianceBonuses(alTV);
    ab.tower_dmg += alDmg; ab.tower_spd += alSpd; ab.mob_hp_reduce += alHpRed;
    ab.extra_projectile += alProj; ab.crit_bonus_avg += alCrit; ab.boss_dmg += alBoss;

    const towerResLevels = (player.tower_research_levels as Record<string, number>) ?? {};
    const storedGear     = player.hero_gear as Record<string, unknown> | null;

    // ── Gear fingerprint ───────────────────────────────────────────────────
    const serverFingerprint = buildGearFingerprint(storedGear);
    const fingerprintMatch  = !gearFingerprint || serverFingerprint === gearFingerprint;

    // ── Shop purchases ─────────────────────────────────────────────────────
    const shopPurchases = (battle.shop_purchases as Record<string, unknown>[]) ?? [];

    // Total gold spent (recomputed from DB-recorded purchases — never trust client)
    let goldSpent = 0;
    for (const p of shopPurchases) {
      if (p.type === 'shopTower')  goldSpent += SHOP_GOLD_COST[p.towerId as string] ?? 0;
      else if (p.type === 'upgrade')   goldSpent += (UPGRADE_GOLD_COST[p.upgradeKey as string] ?? [0])[((p.level as number) ?? 1) - 1] ?? 0;
      else if (p.type === 'ascension') goldSpent += ASCENSION_GOLD_COST;
    }

    // ── Build initial tower list from armory ───────────────────────────────
    const consumedTowers      = (battle.consumed_towers as Record<string, unknown>[]) ?? [];
    const armoryPlacementsArr = armoryPlacements as { armoryIdx: number; col: number; row: number }[];
    const initialTowers: PlacedTower[] = [];

    for (const ap of armoryPlacementsArr) {
      const entry = consumedTowers[ap.armoryIdx];
      if (!entry) continue;
      const col   = typeof ap.col === 'number' ? ap.col : COLS / 2;
      const row   = typeof ap.row === 'number' ? ap.row : ROWS / 2;
      const stats = buildTowerStats(entry, rb, mb, ab, towerResLevels, col, row);
      if (stats) initialTowers.push({ stats, cx: col + 0.5, cy: row + 0.5, cooldown: 0, addedAtWave: 0, ascended: false });
    }
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
          critBonusAvg: 0, statsCapped: false,
        },
        cx: col + 0.5, cy: row + 0.5, cooldown: 0, addedAtWave: 0, ascended: false,
      };
    }

    // ── Run simulation ─────────────────────────────────────────────────────
    const startGold     = START_GOLD + rb.start_gold;
    const waveGoldBonus = rb.wave_gold + mb.wave_gold;
    const mapKey        = getMapForStage(baseStageId);
    const waypoints     = getWaypoints(mapKey);
    const hpMult        = getCampaignHpMult(baseStageId);
    const eliteConfig   = isElite ? buildEliteConfig(baseStageId) : undefined;

    const sim = runTickSimulation(
      (wave) => getWaveConfig(baseStageId, wave),
      waypoints,
      initialTowers, commanderTower, shopPurchases,
      rb, mb, ab, towerResLevels,
      hpMult, startGold, waveGoldBonus,
      cmdStats.activeEffects,
      eliteConfig,
    );

    // ── Gold cap cross-check ───────────────────────────────────────────────
    const { data: goldCapRpc } = await adminClient.rpc('idw_compute_gold_cap', {
      p_research: player.research, p_market_state: player.market_state, p_waves: sim.wavesCleared || 10,
    });
    const goldCap = (goldCapRpc as number) ?? 999999;
    const goldOk  = goldSpent <= goldCap;

    const cappedTowerCount = initialTowers.filter(t => t.stats.statsCapped).length;

    const won = sim.won && sim.goldValid && goldOk
             && cmdStats.gearFlags.length === 0
             && cappedTowerCount === 0;

    const versionSnapshot: CombatVersionSnapshot = currentVersionSnapshot();

    const antiCheat = {
      durationSec:      Math.round(elapsedSec),
      durationOk:       elapsedSec >= 10,
      combatVersion:    versionSnapshot,
      fingerprintMatch,
      clientFingerprint: gearFingerprint,
      serverFingerprint,
      commanderDmg:        cmdStats.dmg,
      commanderAtkSpeedS:  cmdStats.atkSpeedS,
      commanderRangeTiles: cmdStats.rangeTiles,
      commanderEffects:    [...cmdStats.activeEffects],
      commanderGearFlags:  cmdStats.gearFlags,
      commanderGearClean:  cmdStats.gearFlags.length === 0,
      commanderPlacement,
      towerCount:               initialTowers.length + (commanderTower ? 1 : 0),
      armoryPlacementsReceived: armoryPlacementsArr.length,
      cappedTowerCount,
      simulationWon:   sim.won,
      simulationLives: sim.livesLeft,
      simulationWaves: sim.wavesCleared,
      goldValid:       sim.goldValid,
      goldLog:         sim.goldLog,
      goldSpent, goldCap, goldOk,
      simLog: sim.simLog,
    };

    // ── Fetch completion data and write result ─────────────────────────────
    const { data: fullPlayer } = await adminClient.from('idw_player_state').select('campaign_completed').eq('user_id', user.id).single();
    const alreadyCompleted: string[] = (fullPlayer?.campaign_completed ?? []) as string[];
    // Elite completion is tracked as "elite:1-5"; normal as "1-5"
    const firstClear = won && !alreadyCompleted.includes(rawStageId);

    // Elite first-clear grants 3× the base stage reward; replays grant nothing (same as normal)
    const baseReward = won && firstClear ? (STAGE_REWARDS[baseStageId] ?? {}) : {};
    const rewardMult = isElite ? 3 : 1;
    const fullReward: Record<string, number> = {};
    for (const [k, v] of Object.entries(baseReward)) {
      fullReward[k] = Math.round((v as number) * rewardMult);
    }
    const xpGained  = fullReward.xp ?? 0;
    const resReward = { ...fullReward }; delete resReward.xp;

    await adminClient.from('idw_battle_attempts').update({ client_report: { simVerified: true, simResult: won } }).eq('id', battleId);

    const { data: rpcResult, error: rpcErr } = await userClient.rpc('idw_submit_battle_result', {
      p_battle_id:        battleId,
      p_won:              won && goldOk,
      p_waves:            sim.wavesCleared,
      p_lives:            sim.livesLeft,
      p_client_gold:      goldSpent,
      p_gear_fingerprint: gearFingerprint,
      p_shop_placements:  shopPurchases,
    });

    if (rpcErr) {
      console.error('idw_submit_battle_result failed:', rpcErr);
      await adminClient.from('idw_battle_attempts').update({ result: won ? 'victory' : 'defeat', finished_at: new Date().toISOString(), client_report: { antiCheat, simVerified: true, error: rpcErr.message } }).eq('id', battleId);
      return new Response(JSON.stringify({ error: rpcErr.message }), { status: 500, headers: corsHeaders });
    }

    await adminClient.from('idw_battle_attempts').update({ client_report: { ...((rpcResult?.client_report) ?? {}), simVerified: true, antiCheat } }).eq('id', battleId);
    return new Response(JSON.stringify(rpcResult), { headers: corsHeaders });

  } catch (err) {
    console.error('campaign-simulate error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
