// pvp-simulate: server-side PvP battle simulation
// PvP uses the identical tick-based simulation as campaign.
// The only differences are: wave config (getPvpWaveConfig), no HP scaling, forest map always.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  MAP_WAYPOINTS, SHOP_GOLD_COST, START_GOLD,
} from '../_shared/combat-config.ts';
import {
  computeResearchBonuses, computeMarketBonuses, computeAllianceBonuses,
  buildTowerStats, computeCommanderStats,
  getPvpWaveConfig,
  type ResearchBonuses, type MarketBonuses, type AllianceBonuses,
  type TowerStats,
} from '../_shared/combat-formulas.ts';
import { runTickSimulation, type PlacedTower } from '../_shared/combat-simulation.ts';
import { currentVersionSnapshot } from '../_shared/combat-version.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON         = Deno.env.get('SUPABASE_ANON_KEY')!;

// PvP always uses the forest map
function getWaypoints(): { x: number; y: number }[] {
  return MAP_WAYPOINTS.forest.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401, headers: corsHeaders });

    const userClient  = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const body = await req.json() as {
      battleId: string;
      armoryPlacements?: { armoryIdx: number; col: number; row: number }[];
      commanderPlacement?: { col: number; row: number } | null;
    };
    const { battleId, armoryPlacements = [], commanderPlacement = null } = body;
    if (!battleId) return new Response(JSON.stringify({ error: 'battleId required' }), { status: 400, headers: corsHeaders });

    // ── Fetch battle record ────────────────────────────────────────────────
    const { data: battle, error: bErr } = await adminClient.from('idw_battle_attempts').select('*').eq('id', battleId).eq('user_id', user.id).single();
    if (bErr || !battle) return new Response(JSON.stringify({ error: 'Battle not found' }), { status: 404, headers: corsHeaders });
    if (battle.result !== 'started') return new Response(JSON.stringify({ error: 'Battle already resolved' }), { status: 409, headers: corsHeaders });

    const stageId: string = battle.stage_id;
    if (!stageId.startsWith('pvp-')) return new Response(JSON.stringify({ error: 'Not a PvP battle' }), { status: 400, headers: corsHeaders });
    const diff = parseInt(stageId.split('-')[1], 10) || 1;

    const tileIdx: number | null = ((battle.client_report as Record<string, unknown>)?.pvpTileIdx as number) ?? null;
    if (tileIdx === null) return new Response(JSON.stringify({ error: 'Missing pvpTileIdx' }), { status: 400, headers: corsHeaders });

    const elapsedSec = (Date.now() - new Date(battle.started_at).getTime()) / 1000;
    if (elapsedSec < 10) return new Response(JSON.stringify({ error: `Battle ended too quickly (${Math.round(elapsedSec)}s, minimum 10s)` }), { status: 400, headers: corsHeaders });

    // ── Validate placement indices against snapshot ────────────────────────
    const consumedTowers = (battle.consumed_towers as Record<string, unknown>[]) ?? [];
    for (const p of armoryPlacements) {
      if (p.armoryIdx < 0 || p.armoryIdx >= consumedTowers.length) {
        return new Response(JSON.stringify({ error: `Invalid tower index ${p.armoryIdx}` }), { status: 400, headers: corsHeaders });
      }
    }

    // ── Fetch player state ─────────────────────────────────────────────────
    const { data: player, error: pErr } = await adminClient.from('idw_player_state').select('research, tower_research_levels, market_state, hero_gear').eq('user_id', user.id).single();
    if (pErr || !player) return new Response(JSON.stringify({ error: 'Player not found' }), { status: 404, headers: corsHeaders });

    // ── Alliance territory + special tiles (best-effort) ───────────────────
    let allianceTerritoryValue = 0;
    let ownedSpecialIds: string[] = [];
    try {
      const { data: alMember } = await adminClient.from('idw_alliance_members').select('alliance_id').eq('user_id', user.id).maybeSingle();
      if (alMember?.alliance_id) {
        const { data: members } = await adminClient.from('idw_alliance_members').select('user_id').eq('alliance_id', alMember.alliance_id);
        const memberIds = (members ?? []).map((m: Record<string, string>) => m.user_id);
        if (memberIds.length > 0) {
          const { data: tiles } = await adminClient.from('pvp_world').select('territory_value, special_id').in('owner_id', memberIds);
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

    const cmdStats = computeCommanderStats(heroGear);

    // ── Build initial tower list from armory snapshot ──────────────────────
    const initialTowers: PlacedTower[] = [];
    if (armoryPlacements.length > 0) {
      for (const ap of armoryPlacements) {
        const entry = consumedTowers[ap.armoryIdx];
        if (!entry) continue;
        const stats = buildTowerStats(entry, rb, mb, ab, towerResLevels, ap.col, ap.row);
        if (stats) initialTowers.push({ stats, cx: ap.col + 0.5, cy: ap.row + 0.5, cooldown: 0, addedAtWave: 0, ascended: false });
      }
    } else {
      // No placement positions sent — place all consumed towers at origin (still uses correct stats)
      for (const entry of consumedTowers) {
        const stats = buildTowerStats(entry, rb, mb, ab, towerResLevels);
        if (stats) initialTowers.push({ stats, cx: 0.5, cy: 0.5, cooldown: 0, addedAtWave: 0, ascended: false });
      }
    }

    // ── Commander tower ────────────────────────────────────────────────────
    let commanderTower: PlacedTower | null = null;
    if (commanderPlacement) {
      const { col, row } = commanderPlacement;
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

    // ── Shop purchases (DB-recorded, same as campaign) ─────────────────────
    const shopPurchases = (battle.shop_purchases as Record<string, unknown>[]) ?? [];

    // Gold spent audit
    let goldSpent = 0;
    for (const p of shopPurchases) {
      if (p.type === 'shopTower') goldSpent += SHOP_GOLD_COST[p.towerId as string] ?? 0;
    }

    // ── Run tick simulation (identical to campaign) ────────────────────────
    const startGold     = START_GOLD + rb.start_gold;
    const waveGoldBonus = rb.wave_gold + mb.wave_gold;
    const waypoints     = getWaypoints();

    const sim = runTickSimulation(
      (wave) => getPvpWaveConfig(diff, wave),
      waypoints,
      initialTowers, commanderTower, shopPurchases,
      rb, mb, ab, towerResLevels,
      1.0,           // no HP scaling for PvP
      startGold, waveGoldBonus,
      cmdStats.activeEffects,
    );

    const versionSnapshot = currentVersionSnapshot();

    // ── Write battle result ────────────────────────────────────────────────
    await adminClient.from('idw_battle_attempts').update({
      result:      sim.won ? 'victory' : 'defeat',
      finished_at: new Date().toISOString(),
      client_report: {
        pvpTileIdx:         tileIdx,
        simVerified:        true,
        combatVersion:      versionSnapshot,
        durationSec:        Math.round(elapsedSec),
        simWon:             sim.won,
        simLives:           sim.livesLeft,
        simWaves:           sim.wavesCleared,
        goldValid:          sim.goldValid,
        goldLog:            sim.goldLog,
        goldSpent,
        allianceTV:         allianceTerritoryValue,
        allianceSpecials:   ownedSpecialIds,
        commanderAvgDmg:    Math.round(cmdStats.dmg),
        commanderSpd:       cmdStats.atkSpeedS,
        commanderRange:     cmdStats.rangeTiles,
        commanderGearFlags: cmdStats.gearFlags,
        simLog:             sim.simLog,
      },
    }).eq('id', battleId);

    // ── Call pvp_battle_ended ──────────────────────────────────────────────
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
