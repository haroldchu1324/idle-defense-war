
-- Idle Defense War - Server-authoritative backend v1
-- Run this whole file in Supabase SQL Editor.
-- It keeps your old public.game_saves table as a backup, then moves trusted state to public.idw_player_state.

create extension if not exists pgcrypto;

create table if not exists public.idw_player_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resources jsonb not null default '{"wood":500,"stone":500,"fiber":500,"leather":500,"ore":500}'::jsonb,
  player_xp integer not null default 0 check (player_xp >= 0),
  player_level integer not null default 1 check (player_level >= 1),
  nodes jsonb not null default '{}'::jsonb,
  research jsonb not null default '{}'::jsonb,
  active_research_id text,
  armory jsonb not null default '[]'::jsonb,
  campaign_completed text[] not null default '{}',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.idw_battle_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage_id text not null,
  seed text not null default encode(gen_random_bytes(16),'hex'),
  consumed_towers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result text not null default 'started' check (result in ('started','victory','defeat','abandoned')),
  reward jsonb not null default '{}'::jsonb,
  client_report jsonb not null default '{}'::jsonb
);

alter table public.idw_player_state enable row level security;
alter table public.idw_battle_attempts enable row level security;

drop policy if exists idw_player_state_select_own on public.idw_player_state;
create policy idw_player_state_select_own on public.idw_player_state for select using (auth.uid() = user_id);

drop policy if exists idw_battle_attempts_select_own on public.idw_battle_attempts;
create policy idw_battle_attempts_select_own on public.idw_battle_attempts for select using (auth.uid() = user_id);

-- Optional hardening for your old cloud-save blob. This stops browser users from overwriting save_data directly.
-- Keep SELECT so you can manually inspect/migrate old saves.
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='game_saves') then
    alter table public.game_saves enable row level security;
    drop policy if exists "Users can update own save" on public.game_saves;
    drop policy if exists "Users can insert own save" on public.game_saves;
    drop policy if exists "Users can upsert own save" on public.game_saves;
  end if;
end $$;

create or replace function public.idw_default_nodes()
returns jsonb language sql immutable as $$
select jsonb_build_object(
  'wood', jsonb_build_array(jsonb_build_object('unlocked',true,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000)),
  'stone', jsonb_build_array(jsonb_build_object('unlocked',true,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000)),
  'fiber', jsonb_build_array(jsonb_build_object('unlocked',true,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000)),
  'leather', jsonb_build_array(jsonb_build_object('unlocked',true,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000)),
  'ore', jsonb_build_array(jsonb_build_object('unlocked',true,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000), jsonb_build_object('unlocked',false,'upgradeLevel',1,'storedAmount',0,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0,'lastCollectAt',extract(epoch from now())*1000))
);
$$;

create or replace function public.idw_res_cost_currency(res_id text) returns text language sql immutable as $$
select case res_id when 'wood' then 'fiber' when 'stone' then 'leather' when 'fiber' then 'ore' when 'leather' then 'stone' when 'ore' then 'wood' else null end;
$$;

create or replace function public.idw_base_prod(tier_idx integer) returns numeric language sql immutable as $$
select (array[300,600,1200,2400,4800])[tier_idx+1]::numeric;
$$;
create or replace function public.idw_storage_cap(tier_idx integer, lvl integer) returns numeric language sql immutable as $$
select ((array[900,1800,3600,7200,14400])[tier_idx+1] * (1.0 + 0.90 * (greatest(lvl,1)-1)))::numeric;
$$;
create or replace function public.idw_node_upgrade_cost(tier_idx integer, lvl integer) returns integer language sql immutable as $$
select round((array[80,180,400,900,2000])[tier_idx+1] * power(1.6, greatest(lvl,1)-1))::integer;
$$;
create or replace function public.idw_node_unlock_cost(res_id text, tier_idx integer) returns integer language sql immutable as $$
select case res_id
  when 'wood' then (array[0,300,700,1500,3500])[tier_idx+1]
  when 'stone' then (array[0,250,600,1400,3000])[tier_idx+1]
  when 'fiber' then (array[0,280,650,1450,3200])[tier_idx+1]
  when 'leather' then (array[0,220,550,1300,2800])[tier_idx+1]
  when 'ore' then (array[0,200,500,1200,2500])[tier_idx+1]
  else null end;
$$;
create or replace function public.idw_level_unlock(tier_idx integer) returns integer language sql immutable as $$
select (array[1,5,15,30,50])[tier_idx+1];
$$;

create or replace function public.idw_tower_cost(tower_id text) returns jsonb language sql immutable as $$
select case tower_id
  when 'god_tower' then '{}'::jsonb
  when 'archer' then '{"wood":80,"fiber":40}'::jsonb
  when 'catapult' then '{"stone":120,"wood":60}'::jsonb
  when 'crossbow' then '{"wood":150,"fiber":80,"ore":40}'::jsonb
  when 'ice_tower' then '{"stone":100,"fiber":60,"leather":40}'::jsonb
  when 'sniper' then '{"ore":200,"leather":100,"wood":80}'::jsonb
  when 'inferno' then '{"ore":350,"stone":200,"leather":150,"fiber":100}'::jsonb
  else null end;
$$;
create or replace function public.idw_tower_unlock_level(tower_id text) returns integer language sql immutable as $$
select case tower_id when 'god_tower' then 0 when 'archer' then 0 when 'catapult' then 0 when 'crossbow' then 10 when 'ice_tower' then 10 when 'sniper' then 20 when 'inferno' then 40 else 9999 end;
$$;

create or replace function public.idw_stage_reward(stage_id text) returns jsonb language sql immutable as $$
-- Values match client-side CAMPAIGN_REWARDS constant exactly (source of truth)
select case stage_id
  when '1-1'  then '{"wood":300,"fiber":150,"xp":45}'::jsonb
  when '1-2'  then '{"wood":450,"stone":225,"xp":60}'::jsonb
  when '1-3'  then '{"stone":450,"fiber":300,"xp":75}'::jsonb
  when '1-4'  then '{"stone":600,"ore":225,"xp":98}'::jsonb
  when '1-5'  then '{"ore":450,"leather":300,"xp":120}'::jsonb
  when '1-6'  then '{"fiber":600,"leather":375,"xp":143}'::jsonb
  when '1-7'  then '{"leather":750,"ore":450,"xp":173}'::jsonb
  when '1-8'  then '{"stone":900,"ore":525,"xp":203}'::jsonb
  when '1-9'  then '{"ore":1050,"fiber":600,"xp":240}'::jsonb
  when '1-10' then '{"wood":3000,"stone":3000,"fiber":3000,"leather":3000,"ore":3000,"xp":450}'::jsonb
  when '2-1'  then '{"wood":540,"fiber":270,"xp":81}'::jsonb
  when '2-2'  then '{"wood":810,"stone":405,"xp":108}'::jsonb
  when '2-3'  then '{"stone":810,"fiber":540,"xp":135}'::jsonb
  when '2-4'  then '{"stone":1080,"ore":405,"xp":176}'::jsonb
  when '2-5'  then '{"ore":810,"leather":540,"xp":216}'::jsonb
  when '2-6'  then '{"fiber":1080,"leather":675,"xp":257}'::jsonb
  when '2-7'  then '{"leather":1350,"ore":810,"xp":311}'::jsonb
  when '2-8'  then '{"stone":1620,"ore":945,"xp":365}'::jsonb
  when '2-9'  then '{"ore":1890,"fiber":1080,"xp":432}'::jsonb
  when '2-10' then '{"wood":5400,"stone":5400,"fiber":5400,"leather":5400,"ore":5400,"xp":810}'::jsonb
  when '3-1'  then '{"wood":780,"fiber":390,"xp":117}'::jsonb
  when '3-2'  then '{"wood":1170,"stone":585,"xp":156}'::jsonb
  when '3-3'  then '{"stone":1170,"fiber":780,"xp":195}'::jsonb
  when '3-4'  then '{"stone":1560,"ore":585,"xp":255}'::jsonb
  when '3-5'  then '{"ore":1170,"leather":780,"xp":312}'::jsonb
  when '3-6'  then '{"fiber":1560,"leather":975,"xp":372}'::jsonb
  when '3-7'  then '{"leather":1950,"ore":1170,"xp":450}'::jsonb
  when '3-8'  then '{"stone":2340,"ore":1365,"xp":528}'::jsonb
  when '3-9'  then '{"ore":2730,"fiber":1560,"xp":624}'::jsonb
  when '3-10' then '{"wood":7800,"stone":7800,"fiber":7800,"leather":7800,"ore":7800,"xp":1170}'::jsonb
  when '4-1'  then '{"wood":1020,"fiber":510,"xp":153}'::jsonb
  when '4-2'  then '{"wood":1530,"stone":765,"xp":204}'::jsonb
  when '4-3'  then '{"stone":1530,"fiber":1020,"xp":255}'::jsonb
  when '4-4'  then '{"stone":2040,"ore":765,"xp":333}'::jsonb
  when '4-5'  then '{"ore":1530,"leather":1020,"xp":408}'::jsonb
  when '4-6'  then '{"fiber":2040,"leather":1275,"xp":486}'::jsonb
  when '4-7'  then '{"leather":2550,"ore":1530,"xp":588}'::jsonb
  when '4-8'  then '{"stone":3060,"ore":1785,"xp":690}'::jsonb
  when '4-9'  then '{"ore":3570,"fiber":2040,"xp":816}'::jsonb
  when '4-10' then '{"wood":10200,"stone":10200,"fiber":10200,"leather":10200,"ore":10200,"xp":1530}'::jsonb
  when '5-1'  then '{"wood":1260,"fiber":630,"xp":189}'::jsonb
  when '5-2'  then '{"wood":1890,"stone":945,"xp":252}'::jsonb
  when '5-3'  then '{"stone":1890,"fiber":1260,"xp":315}'::jsonb
  when '5-4'  then '{"stone":2520,"ore":945,"xp":412}'::jsonb
  when '5-5'  then '{"ore":1890,"leather":1260,"xp":504}'::jsonb
  when '5-6'  then '{"fiber":2520,"leather":1575,"xp":601}'::jsonb
  when '5-7'  then '{"leather":3150,"ore":1890,"xp":727}'::jsonb
  when '5-8'  then '{"stone":3780,"ore":2205,"xp":853}'::jsonb
  when '5-9'  then '{"ore":4410,"fiber":2520,"xp":1008}'::jsonb
  when '5-10' then '{"wood":12600,"stone":12600,"fiber":12600,"leather":12600,"ore":12600,"xp":1890}'::jsonb
  when '6-1'  then '{"wood":1500,"fiber":750,"xp":225}'::jsonb
  when '6-2'  then '{"wood":2250,"stone":1125,"xp":300}'::jsonb
  when '6-3'  then '{"stone":2250,"fiber":1500,"xp":375}'::jsonb
  when '6-4'  then '{"stone":3000,"ore":1125,"xp":490}'::jsonb
  when '6-5'  then '{"ore":2250,"leather":1500,"xp":600}'::jsonb
  when '6-6'  then '{"fiber":3000,"leather":1875,"xp":715}'::jsonb
  when '6-7'  then '{"leather":3750,"ore":2250,"xp":865}'::jsonb
  when '6-8'  then '{"stone":4500,"ore":2625,"xp":1015}'::jsonb
  when '6-9'  then '{"ore":5250,"fiber":3000,"xp":1200}'::jsonb
  when '6-10' then '{"wood":15000,"stone":15000,"fiber":15000,"leather":15000,"ore":15000,"xp":2250}'::jsonb
  when '7-1'  then '{"wood":1740,"fiber":870,"xp":261}'::jsonb
  when '7-2'  then '{"wood":2610,"stone":1305,"xp":348}'::jsonb
  when '7-3'  then '{"stone":2610,"fiber":1740,"xp":435}'::jsonb
  when '7-4'  then '{"stone":3480,"ore":1305,"xp":568}'::jsonb
  when '7-5'  then '{"ore":2610,"leather":1740,"xp":696}'::jsonb
  when '7-6'  then '{"fiber":3480,"leather":2175,"xp":829}'::jsonb
  when '7-7'  then '{"leather":4350,"ore":2610,"xp":1003}'::jsonb
  when '7-8'  then '{"stone":5220,"ore":3045,"xp":1177}'::jsonb
  when '7-9'  then '{"ore":6090,"fiber":3480,"xp":1392}'::jsonb
  when '7-10' then '{"wood":17400,"stone":17400,"fiber":17400,"leather":17400,"ore":17400,"xp":2610}'::jsonb
  when '8-1'  then '{"wood":1980,"fiber":990,"xp":297}'::jsonb
  when '8-2'  then '{"wood":2970,"stone":1485,"xp":396}'::jsonb
  when '8-3'  then '{"stone":2970,"fiber":1980,"xp":495}'::jsonb
  when '8-4'  then '{"stone":3960,"ore":1485,"xp":647}'::jsonb
  when '8-5'  then '{"ore":2970,"leather":1980,"xp":792}'::jsonb
  when '8-6'  then '{"fiber":3960,"leather":2475,"xp":944}'::jsonb
  when '8-7'  then '{"leather":4950,"ore":2970,"xp":1142}'::jsonb
  when '8-8'  then '{"stone":5940,"ore":3465,"xp":1340}'::jsonb
  when '8-9'  then '{"ore":6930,"fiber":3960,"xp":1584}'::jsonb
  when '8-10' then '{"wood":19800,"stone":19800,"fiber":19800,"leather":19800,"ore":19800,"xp":2970}'::jsonb
  when '9-1'  then '{"wood":2220,"fiber":1110,"xp":333}'::jsonb
  when '9-2'  then '{"wood":3330,"stone":1665,"xp":444}'::jsonb
  when '9-3'  then '{"stone":3330,"fiber":2220,"xp":555}'::jsonb
  when '9-4'  then '{"stone":4440,"ore":1665,"xp":725}'::jsonb
  when '9-5'  then '{"ore":3330,"leather":2220,"xp":888}'::jsonb
  when '9-6'  then '{"fiber":4440,"leather":2775,"xp":1058}'::jsonb
  when '9-7'  then '{"leather":5550,"ore":3330,"xp":1280}'::jsonb
  when '9-8'  then '{"stone":6660,"ore":3885,"xp":1502}'::jsonb
  when '9-9'  then '{"ore":7770,"fiber":4440,"xp":1776}'::jsonb
  when '9-10' then '{"wood":22200,"stone":22200,"fiber":22200,"leather":22200,"ore":22200,"xp":3330}'::jsonb
  when '10-1'  then '{"wood":2460,"fiber":1230,"xp":369}'::jsonb
  when '10-2'  then '{"wood":3690,"stone":1845,"xp":492}'::jsonb
  when '10-3'  then '{"stone":3690,"fiber":2460,"xp":615}'::jsonb
  when '10-4'  then '{"stone":4920,"ore":1845,"xp":804}'::jsonb
  when '10-5'  then '{"ore":3690,"leather":2460,"xp":984}'::jsonb
  when '10-6'  then '{"fiber":4920,"leather":3075,"xp":1173}'::jsonb
  when '10-7'  then '{"leather":6150,"ore":3690,"xp":1419}'::jsonb
  when '10-8'  then '{"stone":7380,"ore":4305,"xp":1665}'::jsonb
  when '10-9'  then '{"ore":8610,"fiber":4920,"xp":1968}'::jsonb
  when '10-10' then '{"wood":24600,"stone":24600,"fiber":24600,"leather":24600,"ore":24600,"xp":3690}'::jsonb
  else '{}'::jsonb end;
$$;

create or replace function public.idw_apply_resource_delta(base jsonb, delta jsonb)
returns jsonb language plpgsql immutable as $$
declare k text; v numeric; outj jsonb := coalesce(base,'{}'::jsonb);
begin
  for k, v in select key, value::numeric from jsonb_each_text(coalesce(delta,'{}'::jsonb)) loop
    outj := jsonb_set(outj, array[k], to_jsonb(greatest(0, coalesce((outj->>k)::numeric,0)+v)::integer), true);
  end loop;
  return outj;
end $$;

create or replace function public.idw_can_pay(res jsonb, cost jsonb)
returns boolean language sql immutable as $$
select not exists (select 1 from jsonb_each_text(cost) c where coalesce((res->>c.key)::integer,0) < c.value::integer);
$$;

create or replace function public.idw_negative(cost jsonb)
returns jsonb language sql immutable as $$
select coalesce(jsonb_object_agg(key, -(value::integer)), '{}'::jsonb) from jsonb_each_text(cost);
$$;

-- Add silo column if it doesn't exist yet
alter table public.idw_player_state add column if not exists silo jsonb not null default '{}'::jsonb;

-- Drop silo helpers first so CREATE OR REPLACE can change signatures freely
drop function if exists public.idw_silo_unlock_cost(int);
drop function if exists public.idw_silo_upgrade_cost(int,int);
drop function if exists public.idw_silo_upgrade_duration_ms(int,int);
drop function if exists public.idw_default_silo_tier(boolean);
drop function if exists public.idw_default_silo();
drop function if exists public.idw_tick_silo_upgrades(public.idw_player_state);
drop function if exists public.idw_unlock_silo(text,int);
drop function if exists public.idw_start_silo_upgrade(text,int);

-- Silo cost helpers (mirrors client-side SILO_TIERS)
create or replace function public.idw_silo_unlock_cost(p_tier_idx int) returns integer language sql immutable as $$
  select (array[0,300,700,1500,3500])[p_tier_idx+1];
$$;
create or replace function public.idw_silo_upgrade_cost(p_tier_idx int, p_level int) returns integer language sql immutable as $$
  select round((array[2500,6250,15000,37500,100000])[p_tier_idx+1] * power(1.6, greatest(p_level,1)-1))::integer;
$$;
create or replace function public.idw_silo_upgrade_duration_ms(p_tier_idx int, p_level int) returns integer language sql immutable as $$
  select (round(20.0 * greatest(p_level,1) * (1.0 + p_tier_idx * 0.5)) * 1000)::integer;
$$;

-- Default silo state: tier 0 unlocked, tiers 1-4 locked, all level 1
create or replace function public.idw_default_silo_tier(p_unlocked boolean) returns jsonb language sql immutable as $$
  select jsonb_build_object('unlocked',p_unlocked,'level',1,'upgrading',false,'upgradeStartMs',0,'upgradeDurationMs',0,'upgradeCostPaid',0);
$$;
create or replace function public.idw_default_silo() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'wood',    jsonb_build_array(public.idw_default_silo_tier(true),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false)),
    'stone',   jsonb_build_array(public.idw_default_silo_tier(true),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false)),
    'fiber',   jsonb_build_array(public.idw_default_silo_tier(true),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false)),
    'leather', jsonb_build_array(public.idw_default_silo_tier(true),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false)),
    'ore',     jsonb_build_array(public.idw_default_silo_tier(true),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false),public.idw_default_silo_tier(false))
  );
$$;

create or replace function public.idw_ensure_player()
returns public.idw_player_state language plpgsql security definer set search_path=public as $$
declare u uuid := auth.uid(); row public.idw_player_state;
begin
  if u is null then raise exception 'Not authenticated'; end if;
  insert into public.idw_player_state(user_id, nodes, silo)
  values (u, public.idw_default_nodes(), public.idw_default_silo())
  on conflict (user_id) do nothing;
  -- Initialize silo for existing rows that haven't had it set yet
  update public.idw_player_state set silo = public.idw_default_silo()
  where user_id = u and (silo = '{}'::jsonb or silo is null);
  select * into row from public.idw_player_state where user_id=u;
  return row;
end $$;

create or replace function public.idw_tick_upgrades(p public.idw_player_state)
returns public.idw_player_state language plpgsql security definer set search_path=public as $$
declare res_id text; i int; ns jsonb; now_ms numeric := extract(epoch from now())*1000; n jsonb := p.nodes;
begin
  foreach res_id in array array['wood','stone','fiber','leather','ore'] loop
    for i in 0..4 loop
      ns := n->res_id->i;
      if coalesce((ns->>'upgrading')::boolean,false) and now_ms >= coalesce((ns->>'upgradeStartMs')::numeric,0)+coalesce((ns->>'upgradeDurationMs')::numeric,0) then
        ns := jsonb_set(ns,'{upgradeLevel}',to_jsonb(coalesce((ns->>'upgradeLevel')::int,1)+1),true);
        ns := jsonb_set(ns,'{upgrading}','false'::jsonb,true);
        ns := jsonb_set(ns,'{upgradeStartMs}','0'::jsonb,true);
        ns := jsonb_set(ns,'{upgradeDurationMs}','0'::jsonb,true);
        ns := jsonb_set(ns,'{upgradeCostPaid}','0'::jsonb,true);
        ns := jsonb_set(ns,'{lastCollectAt}',to_jsonb(now_ms),true);
        n := jsonb_set(n, array[res_id,i::text], ns, true);
      end if;
    end loop;
  end loop;
  update public.idw_player_state set nodes=n, updated_at=now() where user_id=p.user_id returning * into p;
  return p;
end $$;

-- ── Research production bonus helper ────────────────────────────────────────
-- Returns the total additive production bonus fraction for p_res_id
-- from all completed research items, matching client getResearchBonuses().
-- e.g. 0.14 means +14% production.
create or replace function public.idw_research_prod_bonus(p_research jsonb, p_res_id text)
returns numeric language sql stable as $$
  with bonuses(id, applies_to, pct) as (values
    -- res_prod: per-resource bonuses (mirrors RESEARCH_DEFS bonus.type='res_prod')
    ('prod1_i',        'wood',    0.08::numeric),
    ('prod2_i',        'ore',     0.08::numeric),
    ('prod3_i',        'fiber',   0.08::numeric),
    ('prod4_i',        'leather', 0.08::numeric),
    ('prod5_i',        'stone',   0.08::numeric),
    ('prod1_ii',       'wood',    0.12::numeric),
    ('prod2_ii',       'ore',     0.12::numeric),
    ('prod3_ii',       'fiber',   0.12::numeric),
    ('prod4_ii',       'leather', 0.12::numeric),
    ('prod5_ii',       'stone',   0.12::numeric),
    ('prod1_iii',      'wood',    0.18::numeric),
    ('prod2_iii',      'ore',     0.18::numeric),
    -- all_prod: applies to every resource (mirrors bonus.type='all_prod')
    ('prod_syn_ii',    'all',     0.06::numeric),
    ('prod_mega_iii',  'all',     0.15::numeric),
    ('unified_prod_iv','all',     0.25::numeric),
    ('transcendent_v', 'all',     0.50::numeric)
  )
  select coalesce(sum(pct), 0)
  from bonuses
  where coalesce((p_research->id->>'done')::boolean, false)
    and (applies_to = 'all' or applies_to = p_res_id);
$$;

-- ── Node stored amount (matches client nodeProdPerHour formula exactly) ──────
-- Client formula:
--   base     = round(baseProd[tier] * (1 + (upgradeLevel-1) * 0.50))
--   levelMult= 1 + (playerLevel-1) * 0.001
--   resMult  = 1 + researchProdBonus(resId)
--   prodPerHour = round(base * levelMult * resMult)
-- Old server used power(1.15, lvl-1) — wrong at higher levels.
-- Drop old signature first so CREATE OR REPLACE can change the parameter list.
drop function if exists public.idw_node_stored_amount(jsonb, int);

create or replace function public.idw_node_stored_amount(
  ns jsonb, tier_idx int, player_level int, p_research jsonb, p_res_id text
)
returns integer language plpgsql stable as $$
declare
  now_ms        numeric := extract(epoch from now())*1000;
  last_ms       numeric;
  lvl           int;
  elapsed_hours numeric;
  base_rate     numeric;
  level_mult    numeric;
  res_mult      numeric;
  amount        numeric;
  cap           numeric;
begin
  if not coalesce((ns->>'unlocked')::boolean, false)
     or coalesce((ns->>'upgrading')::boolean, false) then return 0; end if;
  last_ms       := coalesce((ns->>'lastCollectAt')::numeric, now_ms);
  lvl           := coalesce((ns->>'upgradeLevel')::int, 1);
  elapsed_hours := greatest(0, least(now_ms - last_ms, 8*60*60*1000)) / 3600000.0;
  -- matches client: baseProd * (1 + (upgradeLevel-1) * 0.50)
  base_rate  := public.idw_base_prod(tier_idx) * (1.0 + (lvl - 1) * 0.50);
  -- matches client: 1 + bonusProd(playerLevel) = 1 + (level-1)*0.001
  level_mult := 1.0 + (greatest(player_level, 1) - 1) * 0.001;
  -- matches client: 1 + researchProdBonus(resId)
  res_mult   := 1.0 + public.idw_research_prod_bonus(p_research, p_res_id);
  amount     := coalesce((ns->>'storedAmount')::numeric, 0)
                + base_rate * level_mult * res_mult * elapsed_hours;
  cap        := public.idw_storage_cap(tier_idx, lvl);
  return floor(least(amount, cap))::integer;
end $$;

create or replace function public.idw_tick_silo_upgrades(p public.idw_player_state)
returns public.idw_player_state language plpgsql security definer set search_path=public as $$
declare res_id text; i int; ss jsonb; now_ms numeric := extract(epoch from now())*1000; new_silo jsonb := p.silo; did_complete boolean := false;
begin
  foreach res_id in array array['wood','stone','fiber','leather','ore'] loop
    for i in 0..4 loop
      ss := new_silo->res_id->i;
      if coalesce((ss->>'upgrading')::boolean,false)
         and now_ms >= coalesce((ss->>'upgradeStartMs')::numeric,0)+coalesce((ss->>'upgradeDurationMs')::numeric,0) then
        ss := jsonb_set(ss,'{level}',to_jsonb(coalesce((ss->>'level')::int,1)+1),true);
        ss := jsonb_set(ss,'{upgrading}','false'::jsonb,true);
        ss := jsonb_set(ss,'{upgradeStartMs}','0'::jsonb,true);
        ss := jsonb_set(ss,'{upgradeDurationMs}','0'::jsonb,true);
        ss := jsonb_set(ss,'{upgradeCostPaid}','0'::jsonb,true);
        new_silo := jsonb_set(new_silo, array[res_id,i::text], ss, true);
        did_complete := true;
      end if;
    end loop;
  end loop;
  if did_complete then
    update public.idw_player_state set silo=new_silo, player_xp=player_xp+20, updated_at=now() where user_id=p.user_id returning * into p;
  else
    p.silo := new_silo;
  end if;
  return p;
end $$;

create or replace function public.idw_get_state()
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; v_old_last_seen timestamptz;
begin
  p := public.idw_ensure_player();
  -- Capture the OLD last_seen BEFORE stamping so the client can compute
  -- the true offline duration (now - old_last_seen).
  v_old_last_seen := p.last_seen;
  p := public.idw_tick_upgrades(p);
  p := public.idw_tick_silo_upgrades(p);
  -- Stamp last_seen = now() so the NEXT call to idw_get_state (i.e. next login)
  -- sees the accurate "last time this player was online" instead of the stale
  -- row-creation default.
  update public.idw_player_state
    set last_seen = now(), updated_at = now()
    where user_id = p.user_id;
  -- Restore old value into p so idw_state_to_v2 returns it to the client.
  -- The client uses this to display the correct "Offline Xh Ym" banner.
  p.last_seen := v_old_last_seen;
  return jsonb_build_object('v2', public.idw_state_to_v2(p));
end $$;

create or replace function public.idw_unlock_silo(p_res_id text, p_tier_idx int, p_cost int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; ss jsonb; costj jsonb; new_silo jsonb;
begin
  if p_res_id not in ('wood','stone','fiber','leather','ore') or p_tier_idx not between 0 and 4 then raise exception 'Invalid silo'; end if;
  p := public.idw_ensure_player();
  new_silo := p.silo;
  ss := new_silo->p_res_id->p_tier_idx;
  if coalesce((ss->>'unlocked')::boolean,false) then return public.idw_get_state(); end if;
  if p_tier_idx > 0 and not coalesce((new_silo->p_res_id->(p_tier_idx-1)->>'unlocked')::boolean,false) then raise exception 'Previous tier not unlocked'; end if;
  costj := jsonb_build_object(p_res_id, p_cost);
  if not public.idw_can_pay(p.resources, costj) then raise exception 'Not enough resources'; end if;
  ss := jsonb_set(ss,'{unlocked}','true'::jsonb,true);
  new_silo := jsonb_set(new_silo, array[p_res_id,p_tier_idx::text], ss, true);
  update public.idw_player_state set resources=public.idw_apply_resource_delta(resources, public.idw_negative(costj)), silo=new_silo, updated_at=now() where user_id=p.user_id;
  return public.idw_get_state();
end $$;

create or replace function public.idw_start_silo_upgrade(p_res_id text, p_tier_idx int, p_cost int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; ss jsonb; lvl int; costj jsonb; new_silo jsonb; now_ms numeric := extract(epoch from now())*1000; dur_ms int;
begin
  if p_res_id not in ('wood','stone','fiber','leather','ore') or p_tier_idx not between 0 and 4 then raise exception 'Invalid silo'; end if;
  p := public.idw_tick_silo_upgrades(public.idw_ensure_player());
  new_silo := p.silo;
  ss := new_silo->p_res_id->p_tier_idx;
  if not coalesce((ss->>'unlocked')::boolean,false) or coalesce((ss->>'upgrading')::boolean,false) then raise exception 'Cannot upgrade silo'; end if;
  lvl := coalesce((ss->>'level')::int,1);
  costj := jsonb_build_object(p_res_id, p_cost);
  if not public.idw_can_pay(p.resources, costj) then raise exception 'Not enough resources'; end if;
  dur_ms := public.idw_silo_upgrade_duration_ms(p_tier_idx, lvl);
  ss := jsonb_set(ss,'{upgrading}','true'::jsonb,true);
  ss := jsonb_set(ss,'{upgradeStartMs}',to_jsonb(now_ms),true);
  ss := jsonb_set(ss,'{upgradeDurationMs}',to_jsonb(dur_ms),true);
  ss := jsonb_set(ss,'{upgradeCostPaid}',to_jsonb(p_cost),true);
  new_silo := jsonb_set(new_silo, array[p_res_id,p_tier_idx::text], ss, true);
  update public.idw_player_state set resources=public.idw_apply_resource_delta(resources, public.idw_negative(costj)), silo=new_silo, updated_at=now() where user_id=p.user_id;
  return public.idw_get_state();
end $$;

create or replace function public.idw_touch()
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state;
begin
  p:=public.idw_ensure_player();
  update public.idw_player_state set last_seen=now(), updated_at=now() where user_id=p.user_id returning * into p;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.idw_collect_resource(p_res_id text, p_tier_idx integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p            public.idw_player_state;
  ns           jsonb;
  amount       int;
  n            jsonb;
  now_ms       numeric := extract(epoch from now())*1000;
  v_terr       int     := 0;
  v_prod_bon   numeric := 0;
  v_mult       numeric := 1.0;
  v_silo_bonus numeric := 0;
  v_cap        int;
  v_cur_res    int;
  v_space      int;
  v_collected  int;
  v_leftover   int;
begin
  if p_res_id not in ('wood','stone','fiber','leather','ore') or p_tier_idx not between 0 and 4
    then raise exception 'Invalid node'; end if;

  p  := public.idw_tick_upgrades(public.idw_ensure_player());
  ns := p.nodes->p_res_id->p_tier_idx;
  amount := public.idw_node_stored_amount(ns, p_tier_idx, p.player_level, p.research, p_res_id);
  if amount <= 0 then return public.idw_get_state(); end if;

  -- Alliance territory value + per-tile production bonuses
  select
    coalesce(sum(pw.territory_value), 0)::int,
    coalesce(sum(case when pw.territory_bonus_type = 'production' then pw.territory_bonus_value else 0 end), 0)
  into v_terr, v_prod_bon
  from public.pvp_world pw
  join public.idw_alliance_members am1 on am1.user_id = pw.owner_id
  join public.idw_alliance_members am2 on am2.alliance_id = am1.alliance_id
  where am2.user_id = p.user_id;

  -- Milestone bonuses (territory value thresholds) — all apply to ALL resource types
  if v_terr >= 1 then v_mult := v_mult + 0.05; end if;  -- +5% all resources
  if v_terr >= 5 then v_mult := v_mult + 0.10; end if;  -- +10% all resources
  -- Per-tile production bonus (stacks on top of milestones)
  v_mult := v_mult + v_prod_bon;

  amount := greatest(1, floor(amount::numeric * v_mult)::int);

  -- Compute silo inventory capacity (mirrors client-side totalCapacity)
  if coalesce((p.research->'econ1_i'->>'done')::boolean, false)         then v_silo_bonus := v_silo_bonus + 0.15; end if;
  if coalesce((p.research->'econ1_ii'->>'done')::boolean, false)        then v_silo_bonus := v_silo_bonus + 0.25; end if;
  if coalesce((p.research->'econ1_iii'->>'done')::boolean, false)       then v_silo_bonus := v_silo_bonus + 0.40; end if;
  if coalesce((p.research->'unified_econ_iv'->>'done')::boolean, false) then v_silo_bonus := v_silo_bonus + 0.60; end if;

  select round((5000 + coalesce(sum(
    case when coalesce((elem->>'unlocked')::boolean, false)
      then round((array[10000,25000,60000,150000,400000])[idx] * power(1.5, greatest(coalesce((elem->>'level')::int, 1), 1) - 1))
      else 0
    end
  ), 0)) * (1 + v_silo_bonus))::int
  into v_cap
  from jsonb_array_elements(p.silo->p_res_id) with ordinality as t(elem, idx);

  -- Cap collected amount to available inventory space; leftover stays in the node
  v_cur_res   := coalesce((p.resources->>p_res_id)::int, 0);
  v_space     := greatest(0, v_cap - v_cur_res);
  v_collected := least(amount, v_space);

  -- Nothing fits — leave the node completely untouched so it keeps accumulating naturally
  if v_collected <= 0 then return public.idw_get_state(); end if;

  v_leftover  := amount - v_collected;

  ns := jsonb_set(ns, '{storedAmount}', to_jsonb(v_leftover), true);
  ns := jsonb_set(ns, '{lastCollectAt}', to_jsonb(now_ms), true);
  n  := jsonb_set(p.nodes, array[p_res_id, p_tier_idx::text], ns, true);

  update public.idw_player_state
    set resources  = public.idw_apply_resource_delta(resources, jsonb_build_object(p_res_id, v_collected)),
        nodes      = n,
        updated_at = now()
  where user_id = p.user_id
  returning * into p;

  return public.idw_get_state();
end $$;

create or replace function public.idw_unlock_node(p_res_id text, p_tier_idx int, p_cost int, p_currency text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; ns jsonb; n jsonb; costj jsonb; now_ms numeric := extract(epoch from now())*1000;
begin
  p:=public.idw_ensure_player();
  if p_tier_idx not between 1 and 4 then raise exception 'Invalid tier'; end if;
  if p.player_level < public.idw_level_unlock(p_tier_idx) then raise exception 'Need higher level'; end if;
  ns := p.nodes->p_res_id->p_tier_idx;
  if coalesce((ns->>'unlocked')::boolean,false) then return public.idw_get_state(); end if;
  costj:=jsonb_build_object(p_currency,p_cost);
  if not public.idw_can_pay(p.resources,costj) then raise exception 'Not enough resources'; end if;
  ns := jsonb_set(ns,'{unlocked}','true'::jsonb,true); ns := jsonb_set(ns,'{lastCollectAt}',to_jsonb(now_ms),true);
  n := jsonb_set(p.nodes,array[p_res_id,p_tier_idx::text],ns,true);
  update public.idw_player_state set resources=public.idw_apply_resource_delta(resources, public.idw_negative(costj)), nodes=n, player_xp=player_xp+15, updated_at=now() where user_id=p.user_id;
  return public.idw_get_state();
end $$;

create or replace function public.idw_start_node_upgrade(p_res_id text, p_tier_idx int, p_cost int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; ns jsonb; lvl int; currency text; costj jsonb; n jsonb; now_ms numeric := extract(epoch from now())*1000; duration_ms int;
begin
  p:=public.idw_tick_upgrades(public.idw_ensure_player());
  ns := p.nodes->p_res_id->p_tier_idx; lvl:=coalesce((ns->>'upgradeLevel')::int,1);
  if not coalesce((ns->>'unlocked')::boolean,false) or coalesce((ns->>'upgrading')::boolean,false) or lvl>=50 then raise exception 'Cannot upgrade'; end if;
  currency:=public.idw_res_cost_currency(p_res_id); costj:=jsonb_build_object(currency,p_cost);
  if not public.idw_can_pay(p.resources,costj) then raise exception 'Not enough resources'; end if;
  duration_ms := greatest(5000, floor(5000.0 * power(1.4, lvl-1)))::int;
  ns := jsonb_set(ns,'{storedAmount}','0'::jsonb,true); ns := jsonb_set(ns,'{upgrading}','true'::jsonb,true); ns:=jsonb_set(ns,'{upgradeStartMs}',to_jsonb(now_ms),true); ns:=jsonb_set(ns,'{upgradeDurationMs}',to_jsonb(duration_ms),true); ns:=jsonb_set(ns,'{upgradeCostPaid}',to_jsonb(p_cost),true);
  n := jsonb_set(p.nodes,array[p_res_id,p_tier_idx::text],ns,true);
  update public.idw_player_state set resources=public.idw_apply_resource_delta(resources, public.idw_negative(costj)), nodes=n, updated_at=now() where user_id=p.user_id;
  return public.idw_get_state();
end $$;

create or replace function public.idw_craft_tower(p_tower_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state; base_cost jsonb; cost jsonb; disc numeric;
  slots int:=5; used int; entry jsonb;
begin
  p := public.idw_ensure_player();
  base_cost := public.idw_tower_cost(p_tower_id);
  if base_cost is null then raise exception 'Unknown tower'; end if;
  -- Apply craft_cost research discount (econ3_ii: -10% crafting cost)
  disc := 1.0 + case when coalesce((p.research->'econ3_ii'->>'done')::boolean, false) then -0.10 else 0.0 end;
  select coalesce(jsonb_object_agg(kv.key, ceil((kv.value::numeric) * disc)::integer), '{}'::jsonb)
  into cost from jsonb_each(base_cost) as kv;
  if p.player_level < public.idw_tower_unlock_level(p_tower_id) then raise exception 'Need higher level'; end if;
  if not public.idw_can_pay(p.resources, cost) then raise exception 'Not enough resources'; end if;
  if coalesce((p.research->'comb4'->>'done')::boolean, false) then slots := slots + 2; end if;
  used := jsonb_array_length(p.armory); if used >= slots then raise exception 'No armory slots'; end if;
  entry := jsonb_build_object('towerId', p_tower_id, 'level', 1, 'placedAt', extract(epoch from now())*1000);
  update public.idw_player_state
  set resources = public.idw_apply_resource_delta(resources, public.idw_negative(cost)),
      armory = armory || jsonb_build_array(entry),
      updated_at = now()
  where user_id = p.user_id;
  return public.idw_get_state();
end $$;

create or replace function public.idw_start_battle(p_stage_id text, p_armory_indexes int[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; idx int; towers jsonb:='[]'::jsonb; new_armory jsonb:='[]'::jsonb; i int; attempt_id uuid; can_play boolean; prev text; v_world int; v_stage_num int;
begin
  p:=public.idw_ensure_player();
  if p_stage_id !~ '^[0-9]+-[0-9]+$' then raise exception 'Invalid stage'; end if;
  v_world := split_part(p_stage_id, '-', 1)::int;
  v_stage_num := split_part(p_stage_id, '-', 2)::int;
  if v_stage_num > 1 then
    prev := v_world::text || '-' || (v_stage_num - 1)::text;
    can_play := prev = any(p.campaign_completed);
    if not can_play then raise exception 'Previous stage not complete'; end if;
  elsif v_world > 1 then
    prev := (v_world - 1)::text || '-10';
    can_play := prev = any(p.campaign_completed);
    if not can_play then raise exception 'Previous world not complete'; end if;
  end if;
  for i in 0..greatest(jsonb_array_length(p.armory)-1, -1) loop
    if i = any(p_armory_indexes) then towers := towers || jsonb_build_array(p.armory->i); else new_armory := new_armory || jsonb_build_array(p.armory->i); end if;
  end loop;
  update public.idw_player_state set armory=new_armory, updated_at=now() where user_id=p.user_id;
  insert into public.idw_battle_attempts(user_id,stage_id,consumed_towers) values(p.user_id,p_stage_id,towers) returning id into attempt_id;
  return jsonb_build_object('battleId',attempt_id,'seed',(select seed from public.idw_battle_attempts where id=attempt_id),'consumedTowers',towers,'state',(select public.idw_get_state()));
end $$;

-- ── Server-side battle purchase recording ────────────────────────────────────
-- Each shop buy (tower, upgrade, ascension) calls this mid-battle instead of
-- accumulating client-side. shopPlacements is now DB-generated, not client-trusted.

alter table public.idw_battle_attempts
  add column if not exists shop_purchases jsonb not null default '[]'::jsonb;

create or replace function public.idw_battle_purchase(
  p_battle_id uuid,
  p_purchase  jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_result text;
begin
  select result into v_result
    from public.idw_battle_attempts
   where id = p_battle_id and user_id = v_uid;

  if not found           then raise exception 'Battle not found';       end if;
  if v_result <> 'started' then raise exception 'Battle already resolved'; end if;

  update public.idw_battle_attempts
     set shop_purchases = shop_purchases || jsonb_build_array(p_purchase)
   where id = p_battle_id and user_id = v_uid;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.idw_battle_purchase(uuid, jsonb) to authenticated;

-- ── Gold anti-cheat helpers ───────────────────────────────────────────────────

-- idw_gacha_level: mirrors client _gachaHeroLevel(pts).
-- GACHA_LV_THRESH = [0,3,8,16,30,50,80,120,180,250]; returns level 1..10.
create or replace function public.idw_gacha_level(p_pts int)
returns int language plpgsql immutable as $$
declare i int;
begin
  for i in reverse 9..0 loop
    if p_pts >= (array[0,3,8,16,30,50,80,120,180,250])[i+1] then return least(i+1, 10); end if;
  end loop;
  return 1;
end $$;

-- idw_compute_gold_cap: exact mirror of client getResearchBonuses() start_gold + wave_gold.
-- Sources: research (p_research), pets/relics/market skills (p_market_state).
-- Alliance buffs do not affect gold — confirmed from getAllianceBuffs() in game.js.
-- Returns the maximum gold a player could legitimately accumulate in p_waves waves.
-- A small rounding buffer (+50) accounts for per-wave Math.round() drift.
create or replace function public.idw_compute_gold_cap(p_research jsonb, p_market_state jsonb, p_waves int)
returns int language plpgsql immutable as $$
declare
  v_start_gold  int     := 200; -- client base (game.js line 5278: 200 + rb.start_gold)
  v_wave_gold   numeric := 0;   -- fractional: 0.15 = 15% bonus on the 50-gold base per wave

  -- market sub-objects (null-safe)
  heroes        jsonb;
  relics        jsonb;
  skills        jsonb;
  pts           int;
  lv            int;
  dc            int; -- disenchantCount for disenchant-scaling relics
begin
  -- ── Research: start_gold ──────────────────────────────────────────────────
  -- type='start_gold': econ2_i(+25), econ2_ii(+50)
  if coalesce((p_research->'econ2_i' ->>'done')::boolean, false) then v_start_gold := v_start_gold + 25;  end if;
  if coalesce((p_research->'econ2_ii'->>'done')::boolean, false) then v_start_gold := v_start_gold + 50;  end if;
  -- type='trade_mastery': econ2_iii → start_gold:100, wave_gold:0.25
  if coalesce((p_research->'econ2_iii'->>'done')::boolean, false) then
    v_start_gold := v_start_gold + 100;
    v_wave_gold  := v_wave_gold  + 0.25;
  end if;
  -- type='empire_mastery': unified_econ_iv → start_gold:200, wave_gold:0.50
  if coalesce((p_research->'unified_econ_iv'->>'done')::boolean, false) then
    v_start_gold := v_start_gold + 200;
    v_wave_gold  := v_wave_gold  + 0.50;
  end if;
  -- type='transcendent': transcendent_v → start_gold:300 (no wave_gold)
  if coalesce((p_research->'transcendent_v'->>'done')::boolean, false) then
    v_start_gold := v_start_gold + 300;
  end if;
  -- type='wave_gold': def4_ii → +0.15
  if coalesce((p_research->'def4_ii'->>'done')::boolean, false) then
    v_wave_gold := v_wave_gold + 0.15;
  end if;

  -- ── Market state: pets, relics, market skills ─────────────────────────────
  if p_market_state is not null then
    heroes := coalesce(p_market_state->'heroes',       '{}'::jsonb);
    relics := coalesce(p_market_state->'relics',       '{}'::jsonb);
    skills := coalesce(p_market_state->'marketSkills', '{}'::jsonb);
    dc     := coalesce((p_market_state->>'disenchantCount')::int, 0);

    -- ── GACHA_HEROES with passiveStat='wave_gold' ────────────────────────
    -- ember_witch: basePerLv:0.5%
    pts := coalesce((heroes->'ember_witch'->>'pts')::int, 0);
    if pts > 0 then
      lv := idw_gacha_level(pts);
      v_wave_gold := v_wave_gold + 0.5 * lv / 100.0;
    end if;
    -- titan_wolf: passiveStat:'wave_gold' basePerLv:3.0%
    pts := coalesce((heroes->'titan_wolf'->>'pts')::int, 0);
    if pts > 0 then
      lv := idw_gacha_level(pts);
      v_wave_gold := v_wave_gold + 3.0 * lv / 100.0;
    end if;

    -- ── RELIC_DEFS with passiveStat/passiveStat2='wave_gold' ─────────────
    -- copper_coin: passiveStat:'wave_gold' basePerLv:0.40
    pts := coalesce((relics->'copper_coin'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.40 * lv / 100.0; end if;
    -- tarnished_medal: passiveStat:'wave_gold' basePerLv:0.35
    pts := coalesce((relics->'tarnished_medal'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.35 * lv / 100.0; end if;
    -- dusty_scroll: passiveStat:'wave_gold' basePerLv:0.30
    pts := coalesce((relics->'dusty_scroll'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.30 * lv / 100.0; end if;
    -- merchants_coin: passiveStat:'wave_gold' basePerLv:0.65
    pts := coalesce((relics->'merchants_coin'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.65 * lv / 100.0; end if;
    -- lucky_charm: passiveStat:'wave_gold' basePerLv:0.70
    pts := coalesce((relics->'lucky_charm'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.70 * lv / 100.0; end if;
    -- moonstone: passiveStat:'wave_gold' basePerLv:1.00
    pts := coalesce((relics->'moonstone'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 1.00 * lv / 100.0; end if;
    -- golden_scale: passiveStat:'wave_gold' basePerLv:1.10
    pts := coalesce((relics->'golden_scale'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 1.10 * lv / 100.0; end if;
    -- traders_codex: passiveStat:'wave_gold' basePerLv:0.90
    pts := coalesce((relics->'traders_codex'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.90 * lv / 100.0; end if;
    -- eclipse_gem: passiveStat2:'wave_gold' basePerLv2:0.80
    pts := coalesce((relics->'eclipse_gem'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.80 * lv / 100.0; end if;
    -- arcane_codex: passiveStat2:'wave_gold' basePerLv2:0.70
    pts := coalesce((relics->'arcane_codex'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.70 * lv / 100.0; end if;
    -- emperors_seal: passiveStat2:'wave_gold' basePerLv2:2.00
    pts := coalesce((relics->'emperors_seal'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 2.00 * lv / 100.0; end if;
    -- celestial_map: passiveStat2:'wave_gold' basePerLv2:1.50
    pts := coalesce((relics->'celestial_map'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 1.50 * lv / 100.0; end if;
    -- fortune_crown: passiveStat:'wave_gold' basePerLv:3.00
    pts := coalesce((relics->'fortune_crown'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 3.00 * lv / 100.0; end if;
    -- eternity_stone: passiveStat2:'wave_gold' basePerLv2:2.50
    pts := coalesce((relics->'eternity_stone'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 2.50 * lv / 100.0; end if;
    -- scrapper_seal: disenchantStat:'wave_gold' disenchantPerItem:0.10 (per disenchanted item)
    if dc > 0 then
      pts := coalesce((relics->'scrapper_seal'->>'pts')::int, 0);
      if pts > 0 then v_wave_gold := v_wave_gold + dc * 0.10 / 100.0; end if;
    end if;
    -- void_remnant: disenchantStat2:'wave_gold' disenchantPerItem2:0.15
    if dc > 0 then
      pts := coalesce((relics->'void_remnant'->>'pts')::int, 0);
      if pts > 0 then v_wave_gold := v_wave_gold + dc * 0.15 / 100.0; end if;
    end if;

    -- ── MARKET_SKILL_DEFS with passiveStat/passiveStat2='wave_gold' ──────
    -- sk_scavenge: passiveStat:'wave_gold' basePerLv:0.40
    pts := coalesce((skills->'sk_scavenge'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.40 * lv / 100.0; end if;
    -- sk_gold_finder: passiveStat:'wave_gold' basePerLv:0.70
    pts := coalesce((skills->'sk_gold_finder'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 0.70 * lv / 100.0; end if;
    -- sk_economic_mastery: passiveStat:'wave_gold' basePerLv:1.00
    pts := coalesce((skills->'sk_economic_mastery'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 1.00 * lv / 100.0; end if;
    -- sk_plunderers_mark: passiveStat:'wave_gold' basePerLv:1.60
    pts := coalesce((skills->'sk_plunderers_mark'->>'pts')::int, 0);
    if pts > 0 then lv := idw_gacha_level(pts); v_wave_gold := v_wave_gold + 1.60 * lv / 100.0; end if;
  end if;

  -- Total: starting gold + sum of per-wave gold across all waves cleared
  -- Per wave: round(50 * (1 + wave_gold)) — mirrors client killEnemy() line 10658
  -- +50 buffer for per-wave Math.round() drift across 10 waves
  return v_start_gold + p_waves * round(50.0 * (1.0 + v_wave_gold))::int + 50;
end $$;

-- ── Commander anti-cheat helpers ─────────────────────────────────────────────
-- idw_compute_gear_fingerprint: mirrors client _buildGearFingerprint().
-- Produces "slot:itemId:level|..." sorted by slot from stored hero_gear.
create or replace function public.idw_compute_gear_fingerprint(p_hero_gear jsonb)
returns text language plpgsql immutable as $$
declare
  eq      jsonb;
  all_inv jsonb;
  slot    text;
  item_id text;
  lv      int;
  parts   text[] := array[]::text[];
  slots   text[] := array['armor','boots','helmet','mainHand','offhand','pants'];
begin
  if p_hero_gear is null then return ''; end if;
  eq      := coalesce(p_hero_gear->'equippedGear', '{}'::jsonb);
  all_inv := coalesce(p_hero_gear->'ownedWeapons', '[]'::jsonb)
          || coalesce(p_hero_gear->'ownedGear',    '[]'::jsonb);
  foreach slot in array slots loop
    item_id := eq->>slot;
    if item_id is null then continue; end if;
    -- find level in inventory array; default 1 if not found
    select coalesce((
      select (e->>'level')::int
      from jsonb_array_elements(all_inv) e
      where e->>'id' = item_id
      limit 1
    ), 1) into lv;
    parts := parts || (slot || ':' || item_id || ':' || lv::text);
  end loop;
  return array_to_string(parts, '|');
end $$;

-- idw_compute_commander_stats: mirrors client getFinalCommanderStats().
-- Base stats: maxHP=300, defense=15, attackDamage=25, attackSpeed=1200ms, attackRange=2.2.
-- Gear atk adds to attackDamage; gear atkSpeed% reduces attackSpeed cooldown.
create or replace function public.idw_compute_commander_stats(p_hero_gear jsonb)
returns jsonb language plpgsql immutable as $$
declare
  eq           jsonb;
  all_items    jsonb;
  slots        text[] := array['mainHand','offhand','helmet','armor','pants','boots'];
  slot         text;
  item_id      text;
  item_stats   jsonb;
  g_atk        numeric := 0;
  g_defense    numeric := 0;
  g_hp         numeric := 0;
  g_atk_speed  numeric := 0;  -- percentage points (e.g. 5 = 5%)
  g_range      numeric := 0;
  -- gear stat tables: only the stats that affect getFinalCommanderStats()
  -- Source of truth: GEAR_WEAPON_DEFS and GEAR_ITEM_DEFS in game.js
  gear_stats   jsonb := jsonb_build_object(
    'iron_sword',         '{"atk":15,"atkSpeed":5,"range":0.2}'::jsonb,
    'shadow_dagger',      '{"atk":12,"atkSpeed":20,"range":0.1}'::jsonb,
    'war_axe',            '{"atk":35,"atkSpeed":-10,"range":0.4}'::jsonb,
    'elven_bow',          '{"atk":28,"atkSpeed":15,"range":1}'::jsonb,
    'enchanted_staff',    '{"atk":50,"atkSpeed":8,"range":2}'::jsonb,
    'stormcaller_blade',  '{"atk":80,"atkSpeed":15,"range":1}'::jsonb,
    'mythic_staff',       '{"atk":120,"atkSpeed":20,"range":3}'::jsonb,
    'iron_helmet',        '{"defense":8,"hp":20}'::jsonb,
    'leather_cap',        '{"defense":6,"hp":35,"atkSpeed":5}'::jsonb,
    'celestial_helm',     '{"defense":40,"hp":100,"atkSpeed":10}'::jsonb,
    'chain_armor',        '{"defense":18,"hp":50}'::jsonb,
    'iron_plate',         '{"defense":30,"hp":80}'::jsonb,
    'divine_plate',       '{"defense":55,"hp":150}'::jsonb,
    'linen_pants',        '{"defense":6}'::jsonb,
    'reinforced_leggings','{"defense":15,"hp":30}'::jsonb,
    'dragonhide_leggings','{"defense":22,"hp":50}'::jsonb,
    'shadow_leggings',    '{"defense":35,"hp":80}'::jsonb,
    'iron_boots',         '{"defense":5}'::jsonb,
    'swiftwalkers',       '{"defense":8,"atkSpeed":5}'::jsonb,
    'void_walker_boots',  '{"defense":20,"atkSpeed":10}'::jsonb,
    'wooden_shield',      '{"defense":12,"hp":30}'::jsonb,
    'magic_orb',          '{"atk":15,"range":1,"hp":40}'::jsonb,
    'phoenix_shield',     '{"defense":50,"hp":120,"atk":20}'::jsonb
  );
begin
  if p_hero_gear is null then
    return jsonb_build_object('maxHP',300,'defense',15,'attackDamage',25,'attackSpeedMs',1200,'attackRange',2.2);
  end if;
  eq := coalesce(p_hero_gear->'equippedGear', '{}'::jsonb);
  foreach slot in array slots loop
    item_id := eq->>slot;
    if item_id is null then continue; end if;
    item_stats := gear_stats->item_id;
    if item_stats is null then continue; end if;
    g_atk       := g_atk       + coalesce((item_stats->>'atk')::numeric,      0);
    g_defense   := g_defense   + coalesce((item_stats->>'defense')::numeric,   0);
    g_hp        := g_hp        + coalesce((item_stats->>'hp')::numeric,        0);
    g_atk_speed := g_atk_speed + coalesce((item_stats->>'atkSpeed')::numeric,  0);
    g_range     := g_range     + coalesce((item_stats->>'range')::numeric,     0);
  end loop;
  return jsonb_build_object(
    'maxHP',         300 + g_hp,
    'defense',       15  + g_defense,
    'attackDamage',  25  + g_atk,
    'attackSpeedMs', greatest(200, round(1200.0 / (1 + g_atk_speed / 100.0))),
    'attackRange',   2.2 + g_range
  );
end $$;

-- Shop tower gold costs — mirrors client: Math.round(sum(resource costs) * 0.4)
-- Source of truth: TOWER_DEFS cost objects in game.js
create or replace function public.idw_tower_shop_cost(p_tower_id text)
returns int language sql immutable as $$
  select case p_tower_id
    when 'archer'       then 48   -- wood:80+fiber:40=120 × 0.4
    when 'catapult'     then 72   -- stone:120+wood:60=180 × 0.4
    when 'crossbow'     then 108  -- wood:150+fiber:80+ore:40=270 × 0.4
    when 'ice_tower'    then 80   -- stone:100+fiber:60+leather:40=200 × 0.4
    when 'sniper'       then 152  -- ore:200+leather:100+wood:80=380 × 0.4
    when 'inferno'      then 340  -- ore:350+stone:200+leather:150+fiber:100=800 × 0.4
    when 'ballista'     then 144  -- ore:180+wood:120+leather:60=360 × 0.4
    when 'poison_tower' then 172  -- fiber:200+leather:150+stone:80=430 × 0.4
    when 'tesla_tower'  then 160  -- ore:250+stone:150+fiber:100=500 × 0.4
    when 'barricade'    then 140  -- stone:200+leather:100+ore:50=350 × 0.4
    else 0
  end;
$$;

-- Upgrade path costs — mirrors UPGRADE_PATHS in game.js
-- path key: 'range'(0) levels: 60/120/220 | 'speed'(1): 80/160/280 | 'damage'(2): 70/150/260
-- Ascension cost: always 100 gold flat
create or replace function public.idw_upgrade_cost(p_upgrade_key text, p_level int)
returns int language sql immutable as $$
  select case p_upgrade_key
    when 'range'  then (array[60,120,220])[p_level]
    when 'speed'  then (array[80,160,280])[p_level]
    when 'damage' then (array[70,150,260])[p_level]
    else 0
  end;
$$;

create or replace function public.idw_submit_battle_result(p_battle_id uuid, p_won boolean, p_waves int, p_lives int, p_client_gold int, p_gear_fingerprint text default '', p_shop_placements jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  b public.idw_battle_attempts;
  v_reward jsonb := '{}'::jsonb;
  v_resource_reward jsonb;
  v_xp_gained int := 0;
  max_duration   interval := interval '2 hours';
  -- Minimum time a legitimate battle can complete.
  min_duration   interval := interval '10 seconds';
  v_first_clear boolean := false;
  v_server_fingerprint text;
  v_server_cmd_stats   jsonb;
  v_anti_cheat         jsonb;
  v_gold_cap    int;
  v_gold_spent  int := 0;
  v_gold_ok     boolean;
  v_duration_ok boolean;
  e             jsonb;
  v_cost        int;
begin
  p := public.idw_ensure_player();
  select * into b from public.idw_battle_attempts where id=p_battle_id and user_id=p.user_id for update;
  if b.id is null then raise exception 'Battle not found'; end if;
  if b.result <> 'started' then raise exception 'Battle already submitted'; end if;
  if now() - b.started_at > max_duration then raise exception 'Battle expired'; end if;

  -- Require server simulation to have run — prevents clients calling this RPC directly
  if not coalesce((b.client_report->>'simVerified')::boolean, false) then
    raise exception 'Battle requires server-side simulation';
  end if;
  -- Server simulation result must match the claimed outcome
  if p_won and not coalesce((b.client_report->>'simResult')::boolean, false) then
    raise exception 'Server simulation determined defeat';
  end if;

  -- Fix 1: minimum battle duration — prevents instant-win RPC calls
  v_duration_ok := (now() - b.started_at >= min_duration);

  -- Anti-cheat: gear fingerprint and commander stats
  v_server_fingerprint := public.idw_compute_gear_fingerprint(p.hero_gear);
  v_server_cmd_stats   := public.idw_compute_commander_stats(p.hero_gear);

  -- Fix 2 & 3: recompute gold spent server-side from towerId/upgrade key — never trust client cost
  for e in select * from jsonb_array_elements(coalesce(p_shop_placements, '[]'::jsonb)) loop
    if e ? 'towerId' then
      -- Shop placement: cost derived from tower type
      v_cost := public.idw_tower_shop_cost(e->>'towerId');
    elsif e ? 'upgrade' then
      -- Tower upgrade: cost derived from path key + level
      v_cost := public.idw_upgrade_cost(e->>'upgrade', coalesce((e->>'level')::int, 1));
    elsif (e->>'ascension')::boolean then
      -- Ascension: fixed 100 gold
      v_cost := 100;
    else
      v_cost := 0;
    end if;
    v_gold_spent := v_gold_spent + v_cost;
  end loop;

  v_gold_cap := public.idw_compute_gold_cap(p.research, p.market_state, p_waves);
  v_gold_ok  := (v_gold_spent <= v_gold_cap);

  v_anti_cheat := jsonb_build_object(
    'durationOk',         v_duration_ok,
    'battleSeconds',      round(extract(epoch from (now() - b.started_at))),
    'fingerprintMatch',   (p_gear_fingerprint = '' or v_server_fingerprint = p_gear_fingerprint),
    'clientFingerprint',  p_gear_fingerprint,
    'serverFingerprint',  v_server_fingerprint,
    'serverCmdStats',     v_server_cmd_stats,
    'goldSpent',          v_gold_spent,
    'goldCap',            v_gold_cap,
    'goldOk',             v_gold_ok,
    'shopPlacements',     coalesce(p_shop_placements, '[]'::jsonb)
  );

  -- Win requires: sim won + 10 waves + lives + minimum duration + gear fingerprint + gold not overspent
  if p_won and p_waves >= 10 and p_lives > 0 and v_duration_ok and v_gold_ok
     and (p_gear_fingerprint = '' or v_server_fingerprint = p_gear_fingerprint) then
    v_first_clear := not (b.stage_id = any(p.campaign_completed));
    v_reward := public.idw_stage_reward(b.stage_id);
    v_xp_gained := coalesce((v_reward->>'xp')::int, 0);
    v_resource_reward := v_reward - 'xp';
    update public.idw_player_state
      set resources = public.idw_apply_resource_delta(resources, v_resource_reward),
          player_xp = player_xp + v_xp_gained,
          campaign_completed = (case when b.stage_id=any(campaign_completed) then campaign_completed else array_append(campaign_completed,b.stage_id) end),
          updated_at = now()
      where user_id = p.user_id;
    update public.idw_battle_attempts
      set result='victory', reward=v_reward, finished_at=now(),
          client_report=jsonb_build_object('waves',p_waves,'lives',p_lives,'clientGold',p_client_gold,'antiCheat',v_anti_cheat)
      where id=p_battle_id;
  else
    update public.idw_battle_attempts
      set result='defeat', finished_at=now(),
          client_report=jsonb_build_object('waves',p_waves,'lives',p_lives,'clientGold',p_client_gold,'antiCheat',v_anti_cheat)
      where id=p_battle_id;
  end if;
  return jsonb_build_object('reward',v_reward,'xp_gained',v_xp_gained,'first_clear',v_first_clear,'state',public.idw_get_state());
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- ENCHANTMENT SYSTEM FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.idw_apply_enchantment(p_tower_index int, p_enchant jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  armory jsonb;
  tower jsonb;
  effect jsonb;
  effect_type text;
  effect_value numeric;
  new_armory jsonb;
begin
  -- Ensure player exists and get current state
  p := public.idw_ensure_player();
  p := public.idw_tick_upgrades(p);
  p := public.idw_tick_silo_upgrades(p);

  -- Validate inputs
  if p_tower_index < 0 or p_tower_index >= jsonb_array_length(p.armory) then
    raise exception 'Invalid tower index: %', p_tower_index;
  end if;

  if not (p_enchant ? 'name' and p_enchant ? 'effect') then
    raise exception 'Invalid enchantment data';
  end if;

  -- Get the tower to enchant
  tower := p.armory->p_tower_index;
  if tower is null or not (tower ? 'towerId') then
    raise exception 'Tower not found at index: %', p_tower_index;
  end if;

  -- Initialize enchantments array if it doesn't exist
  if not (tower ? 'enchantments') then
    tower := jsonb_set(tower, '{enchantments}', '[]'::jsonb);
  end if;

  -- Add the new enchantment to the tower
  tower := jsonb_set(tower, '{enchantments}', (tower->'enchantments') || jsonb_build_array(p_enchant));

  -- Apply stat modifications based on enchantment effect
  effect := p_enchant->'effect';
  effect_type := effect->>'type';
  effect_value := (effect->>'value')::numeric;

  -- Initialize tower stats if they don't exist (based on level)
  -- Base stats and level scaling must match client-side TOWER_DEFS and applyEnchantmentLocally()
  -- Formula: base * (1 + (level-1) * 0.15)
  if not (tower ? 'dmg') then
    case tower->>'towerId'
      when 'archer'    then tower := jsonb_set(tower, '{dmg}', to_jsonb(25    * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'catapult'  then tower := jsonb_set(tower, '{dmg}', to_jsonb(40    * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'crossbow'  then tower := jsonb_set(tower, '{dmg}', to_jsonb(20    * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'ice_tower' then tower := jsonb_set(tower, '{dmg}', to_jsonb(15    * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'sniper'    then tower := jsonb_set(tower, '{dmg}', to_jsonb(150   * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'inferno'   then tower := jsonb_set(tower, '{dmg}', to_jsonb(40    * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'god_tower' then tower := jsonb_set(tower, '{dmg}', to_jsonb(99999 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      else                  tower := jsonb_set(tower, '{dmg}', to_jsonb(25    * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
    end case;
  end if;

  if not (tower ? 'atkSpeed') then
    case tower->>'towerId'
      when 'archer'    then tower := jsonb_set(tower, '{atkSpeed}', to_jsonb(1.2 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'catapult'  then tower := jsonb_set(tower, '{atkSpeed}', to_jsonb(5.0 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'crossbow'  then tower := jsonb_set(tower, '{atkSpeed}', to_jsonb(1.8 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'ice_tower' then tower := jsonb_set(tower, '{atkSpeed}', to_jsonb(1.5 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'sniper'    then tower := jsonb_set(tower, '{atkSpeed}', to_jsonb(4.0 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'inferno'   then tower := jsonb_set(tower, '{atkSpeed}', to_jsonb(0.8 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      when 'god_tower' then tower := jsonb_set(tower, '{atkSpeed}', to_jsonb(1.0 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
      else                  tower := jsonb_set(tower, '{atkSpeed}', to_jsonb(1.2 * (1 + (coalesce((tower->>'level')::numeric, 1) - 1) * 0.15)));
    end case;
  end if;

  if not (tower ? 'range') then
    case tower->>'towerId'
      when 'archer'    then tower := jsonb_set(tower, '{range}', to_jsonb(2.5));
      when 'catapult'  then tower := jsonb_set(tower, '{range}', to_jsonb(2.2));
      when 'crossbow'  then tower := jsonb_set(tower, '{range}', to_jsonb(2.5));
      when 'ice_tower' then tower := jsonb_set(tower, '{range}', to_jsonb(2.0));
      when 'sniper'    then tower := jsonb_set(tower, '{range}', to_jsonb(4.5));
      when 'inferno'   then tower := jsonb_set(tower, '{range}', to_jsonb(1.8));
      when 'god_tower' then tower := jsonb_set(tower, '{range}', to_jsonb(50.0));
      else                  tower := jsonb_set(tower, '{range}', to_jsonb(2.5));
    end case;
  end if;

  if not (tower ? 'projectiles') then
    case tower->>'towerId'
      when 'crossbow' then tower := jsonb_set(tower, '{projectiles}', to_jsonb(3));
      else                 tower := jsonb_set(tower, '{projectiles}', to_jsonb(1));
    end case;
  end if;

  -- Now apply enchantment effects
  case effect_type
    when 'damage' then
      tower := jsonb_set(tower, '{dmg}', to_jsonb((tower->>'dmg')::numeric * (1 + effect_value)));
    when 'atkSpeed' then
      -- atkSpeed is seconds-between-shots (cooldown): lower = faster.
      -- Multiply by (1 - value) to reduce the cooldown.
      tower := jsonb_set(tower, '{atkSpeed}', to_jsonb((tower->>'atkSpeed')::numeric * (1 - effect_value)));
    when 'range' then
      tower := jsonb_set(tower, '{range}', to_jsonb((tower->>'range')::numeric * (1 + effect_value)));
    when 'projectiles' then
      tower := jsonb_set(tower, '{projectiles}', to_jsonb((tower->>'projectiles')::numeric + effect_value));
    when 'level' then
      tower := jsonb_set(tower, '{level}', to_jsonb((tower->>'level')::numeric + effect_value));
    when 'allStats' then
      tower := jsonb_set(tower, '{dmg}', to_jsonb((tower->>'dmg')::numeric * (1 + effect_value)));
      tower := jsonb_set(tower, '{atkSpeed}', to_jsonb((tower->>'atkSpeed')::numeric * (1 - effect_value))); -- cooldown: lower = faster
      tower := jsonb_set(tower, '{range}', to_jsonb((tower->>'range')::numeric * (1 + effect_value)));
    when 'aoe' then
      null; -- AoE radius is not a tracked stat; enchant is stored for display only
    else
      raise exception 'Unknown enchantment effect type: %', effect_type;
  end case;

  -- Update the tower in the armory
  new_armory := jsonb_set(p.armory, array[p_tower_index::text], tower);

  -- Save the updated armory
  update public.idw_player_state
  set armory = new_armory, updated_at = now()
  where user_id = p.user_id;

  -- Return updated game state
  p.armory := new_armory;
  return jsonb_build_object('v2', public.idw_state_to_v2(p));
end $$;

create or replace function public.idw_save_state(p_state jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
begin
  -- Ensure player exists
  p := public.idw_ensure_player();

  -- Update player state with provided data
  -- Only update fields that are provided and valid
  if p_state ? 'resources' then
    update public.idw_player_state
    set resources = p_state->'resources', updated_at = now()
    where user_id = p.user_id;
  end if;

  -- playerXP / playerLevel: BLOCKED here and in the hardened version below.
  -- XP and level are awarded exclusively by idw_submit_battle_result,
  -- idw_unlock_node, idw_tick_silo_upgrades, and alliance RPCs.
  -- Silently ignore rather than raise so the client cannot probe this gate.
  -- (The hardened idw_save_state below also blocks and logs these fields.)
  if p_state ? 'playerXP' or p_state ? 'playerLevel' then
    null; -- intentional no-op; hardened version logs to idw_anti_cheat_logs
  end if;

  if p_state ? 'armoryTowers' then
    update public.idw_player_state
    set armory = p_state->'armoryTowers', updated_at = now()
    where user_id = p.user_id;
  end if;

  -- Return success confirmation with updated state
  return public.idw_get_state();
end $$;

grant execute on function public.idw_get_state() to authenticated;
grant execute on function public.idw_touch() to authenticated;
grant execute on function public.idw_collect_resource(text,int) to authenticated;
grant execute on function public.idw_unlock_node(text,int,int,text) to authenticated;
grant execute on function public.idw_start_node_upgrade(text,int,int) to authenticated;
grant execute on function public.idw_craft_tower(text) to authenticated;
grant execute on function public.idw_start_battle(text,int[]) to authenticated;
grant execute on function public.idw_unlock_silo(text,int,int) to authenticated;
grant execute on function public.idw_start_silo_upgrade(text,int,int) to authenticated;
grant execute on function public.idw_tick_silo_upgrades(public.idw_player_state) to authenticated;
grant execute on function public.idw_tower_shop_cost(text) to authenticated;
grant execute on function public.idw_upgrade_cost(text,int) to authenticated;
grant execute on function public.idw_submit_battle_result(uuid,boolean,int,int,int,text,jsonb) to authenticated;
grant execute on function public.idw_apply_enchantment(int,jsonb) to authenticated;
grant execute on function public.idw_save_state(jsonb) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- MISSING ARMORY FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Disenchant a tower: remove it from armory, refund 50% of base cost
create or replace function public.idw_disenchant_tower(p_slot_idx int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p         public.idw_player_state;
  tower     jsonb;
  base_cost jsonb;
  refund    jsonb;
  new_armory jsonb;
begin
  p := public.idw_ensure_player();

  if p_slot_idx < 0 or p_slot_idx >= jsonb_array_length(p.armory) then
    raise exception 'Invalid slot index';
  end if;

  tower     := p.armory->p_slot_idx;
  base_cost := public.idw_tower_cost(tower->>'towerId');
  if base_cost is null then raise exception 'Unknown tower type'; end if;

  -- 50% refund of base cost (floor each value)
  select coalesce(jsonb_object_agg(kv.key, floor(kv.value::numeric * 0.5)::integer), '{}'::jsonb)
  into refund from jsonb_each(base_cost) as kv;

  -- Remove slot: concatenate elements before and after the slot
  select jsonb_agg(elem)
  into new_armory
  from (
    select value as elem from jsonb_array_elements(p.armory) with ordinality as t(value, ord)
    where (ord - 1) <> p_slot_idx
  ) sub;

  update public.idw_player_state
  set armory    = coalesce(new_armory, '[]'::jsonb),
      resources = public.idw_apply_resource_delta(resources, refund),
      updated_at = now()
  where user_id = p.user_id;

  return public.idw_get_state();
end $$;
grant execute on function public.idw_disenchant_tower(int) to authenticated;

-- Upgrade a tower in the armory: deduct cost, increment level, recalc enchanted stats
create or replace function public.idw_upgrade_tower_in_armory(p_slot_idx int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p          public.idw_player_state;
  tower      jsonb;
  base_cost  jsonb;
  upg_cost   jsonb;
  cur_level  int;
  new_level  int;
  new_armory jsonb;
  -- for stat recalc
  v_base_dmg  numeric; v_base_atk  numeric; v_base_rng  numeric; v_base_proj numeric;
  v_dmg       numeric; v_atk       numeric; v_rng       numeric; v_proj      numeric;
  v_eff_type  text;    v_eff_val   numeric;
  i           int;
begin
  p := public.idw_ensure_player();

  if p_slot_idx < 0 or p_slot_idx >= jsonb_array_length(p.armory) then
    raise exception 'Invalid slot index';
  end if;

  tower     := p.armory->p_slot_idx;
  base_cost := public.idw_tower_cost(tower->>'towerId');
  if base_cost is null then raise exception 'Unknown tower type'; end if;

  cur_level := coalesce((tower->>'level')::int, 1);
  new_level := cur_level + 1;

  -- Upgrade cost: round(base_cost[k] * 0.5 * 1.4^(cur_level-1)) — matches client towerUpgradeCost
  select coalesce(
    jsonb_object_agg(kv.key, round(kv.value::numeric * 0.5 * power(1.4, cur_level - 1))::integer),
    '{}'::jsonb
  )
  into upg_cost from jsonb_each(base_cost) as kv;

  if not public.idw_can_pay(p.resources, upg_cost) then
    raise exception 'Not enough resources';
  end if;

  -- Increment level
  tower := jsonb_set(tower, '{level}', to_jsonb(new_level));

  -- If tower has explicit stats (has been enchanted), recalculate from new level
  -- Matches client recalcTowerStatsFromEnchants exactly
  if tower ? 'dmg' then
    case tower->>'towerId'
      when 'archer'    then v_base_dmg:=25;     v_base_atk:=1.2; v_base_rng:=2.5;  v_base_proj:=1;
      when 'catapult'  then v_base_dmg:=40;     v_base_atk:=5.0; v_base_rng:=2.2;  v_base_proj:=1;
      when 'crossbow'  then v_base_dmg:=20;     v_base_atk:=1.8; v_base_rng:=2.5;  v_base_proj:=3;
      when 'ice_tower' then v_base_dmg:=15;     v_base_atk:=1.5; v_base_rng:=2.0;  v_base_proj:=1;
      when 'sniper'    then v_base_dmg:=150;    v_base_atk:=4.0; v_base_rng:=4.5;  v_base_proj:=1;
      when 'inferno'   then v_base_dmg:=40;     v_base_atk:=0.8; v_base_rng:=1.8;  v_base_proj:=1;
      when 'god_tower' then v_base_dmg:=99999;  v_base_atk:=1.0; v_base_rng:=50.0; v_base_proj:=1;
      else                  v_base_dmg:=25;     v_base_atk:=1.2; v_base_rng:=2.5;  v_base_proj:=1;
    end case;

    -- Base stats at new level (matches recalcTowerStatsFromEnchants)
    v_dmg  := v_base_dmg  * (1.0 + (new_level - 1) * 0.15);
    v_atk  := v_base_atk  * (1.0 + (new_level - 1) * 0.15);
    v_rng  := v_base_rng  * (1.0 + (new_level - 1) * 0.15);
    v_proj := v_base_proj;

    -- Re-apply each enchantment on top
    for i in 0..jsonb_array_length(coalesce(tower->'enchantments', '[]'::jsonb)) - 1 loop
      v_eff_type := tower->'enchantments'->i->'effect'->>'type';
      v_eff_val  := (tower->'enchantments'->i->'effect'->>'value')::numeric;
      case v_eff_type
        when 'damage'      then v_dmg  := v_dmg  * (1 + v_eff_val);
        when 'atkSpeed'    then v_atk  := v_atk  * (1 - v_eff_val);
        when 'range'       then v_rng  := v_rng  * (1 + v_eff_val);
        when 'projectiles' then v_proj := v_proj + v_eff_val;
        when 'allStats'    then v_dmg  := v_dmg  * (1 + v_eff_val);
                                v_atk  := v_atk  * (1 - v_eff_val);
                                v_rng  := v_rng  * (1 + v_eff_val);
        else null;
      end case;
    end loop;

    tower := jsonb_set(tower, '{dmg}',         to_jsonb(v_dmg));
    tower := jsonb_set(tower, '{atkSpeed}',    to_jsonb(v_atk));
    tower := jsonb_set(tower, '{range}',       to_jsonb(v_rng));
    tower := jsonb_set(tower, '{projectiles}', to_jsonb(v_proj));
  end if;

  new_armory := jsonb_set(p.armory, array[p_slot_idx::text], tower);

  update public.idw_player_state
  set armory    = new_armory,
      resources = public.idw_apply_resource_delta(resources, public.idw_negative(upg_cost)),
      updated_at = now()
  where user_id = p.user_id;

  return public.idw_get_state();
end $$;
grant execute on function public.idw_upgrade_tower_in_armory(int) to authenticated;

-- Cancel an in-progress node upgrade: refund 50% of paid cost, reset node state
create or replace function public.idw_cancel_node_upgrade(p_res_id text, p_tier_idx int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p        public.idw_player_state;
  ns       jsonb;
  paid     int;
  currency text;
  refund   jsonb;
  n        jsonb;
begin
  if p_res_id not in ('wood','stone','fiber','leather','ore') or p_tier_idx not between 0 and 4 then
    raise exception 'Invalid node';
  end if;

  p  := public.idw_tick_upgrades(public.idw_ensure_player());
  ns := p.nodes->p_res_id->p_tier_idx;

  if not coalesce((ns->>'upgrading')::boolean, false) then
    raise exception 'Node is not upgrading';
  end if;

  paid     := coalesce((ns->>'upgradeCostPaid')::int, 0);
  currency := public.idw_res_cost_currency(p_res_id);
  -- 50% refund, minimum 1 if any was paid
  refund   := case when paid > 0
                then jsonb_build_object(currency, greatest(1, paid / 2))
                else '{}'::jsonb end;

  -- Reset node upgrading state
  ns := jsonb_set(ns, '{upgrading}',       'false'::jsonb,    true);
  ns := jsonb_set(ns, '{upgradeStartMs}',  '0'::jsonb,        true);
  ns := jsonb_set(ns, '{upgradeDurationMs}','0'::jsonb,       true);
  ns := jsonb_set(ns, '{upgradeCostPaid}', '0'::jsonb,        true);
  n  := jsonb_set(p.nodes, array[p_res_id, p_tier_idx::text], ns, true);

  update public.idw_player_state
  set nodes     = n,
      resources = public.idw_apply_resource_delta(resources, refund),
      updated_at = now()
  where user_id = p.user_id;

  return public.idw_get_state();
end $$;
grant execute on function public.idw_cancel_node_upgrade(text,int) to authenticated;

-- ── PVP world map ──────────────────────────────────────────────────────────

-- Add level column to pvp_world (safe to run multiple times)
alter table public.pvp_world add column if not exists level integer not null default 1;

-- Recreate pvp_get_tiles to expose level, territory value, and special territory data
drop function if exists public.pvp_get_tiles();
create function public.pvp_get_tiles()
returns table(
  tile_idx             integer,
  owner_id             uuid,
  color                text,
  attacking_until      timestamptz,
  level                integer,
  is_mine              boolean,
  territory_value      integer,
  territory_bonus_type text,
  territory_bonus_value numeric,
  special_id           text
)
language sql security definer set search_path=public as $$
  select
    w.tile_idx, w.owner_id, null::text as color, w.attacking_until, w.level,
    (w.owner_id = auth.uid()) as is_mine,
    coalesce(w.territory_value, 1) as territory_value,
    w.territory_bonus_type,
    coalesce(w.territory_bonus_value, 0) as territory_bonus_value,
    w.special_id
  from public.pvp_world w;
$$;
grant execute on function public.pvp_get_tiles() to authenticated;

-- RPC: upgrade a base the calling player owns (deducts ore + stone, raises level)
create or replace function public.pvp_upgrade_base(p_tile_idx integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p           public.idw_player_state;
  current_lvl integer;
  upg_cost    integer;
begin
  p := public.idw_ensure_player();

  select level into current_lvl from public.pvp_world
    where tile_idx = p_tile_idx and owner_id = p.user_id;
  if not found then raise exception 'You do not own this base'; end if;
  if current_lvl >= 10 then raise exception 'Base is already at maximum stage'; end if;

  upg_cost := round(1000.0 * power(2, current_lvl - 1))::integer;
  if not public.idw_can_pay(p.resources, jsonb_build_object('ore', upg_cost, 'stone', upg_cost))
    then raise exception 'Not enough resources'; end if;

  update public.idw_player_state
    set resources = public.idw_apply_resource_delta(
          resources, jsonb_build_object('ore', -upg_cost, 'stone', -upg_cost)),
        updated_at = now()
    where user_id = p.user_id;

  update public.pvp_world set level = current_lvl + 1
    where tile_idx = p_tile_idx and owner_id = p.user_id;

  return public.idw_get_state();
end $$;
grant execute on function public.pvp_upgrade_base(integer) to authenticated;

-- RPC: start a PvP battle — snapshots towers from armory, records battle attempt with tile_idx
create or replace function public.pvp_start_battle(p_tile_idx integer, p_tower_indexes integer[], p_stage_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p           public.idw_player_state;
  towers      jsonb := '[]'::jsonb;
  new_armory  jsonb := '[]'::jsonb;
  attempt_id  uuid;
  i           integer;
begin
  p := public.idw_ensure_player();
  if p_stage_id !~ '^pvp-[0-9]+$' then raise exception 'Invalid PvP stage ID'; end if;

  for i in 0..greatest(jsonb_array_length(p.armory)-1, -1) loop
    if i = any(p_tower_indexes) then
      towers := towers || jsonb_build_array(p.armory->i);
    else
      new_armory := new_armory || jsonb_build_array(p.armory->i);
    end if;
  end loop;

  update public.idw_player_state set armory=new_armory, updated_at=now() where user_id=p.user_id;

  insert into public.idw_battle_attempts(user_id, stage_id, consumed_towers, client_report)
    values(p.user_id, p_stage_id, towers, jsonb_build_object('pvpTileIdx', p_tile_idx))
    returning id into attempt_id;

  return jsonb_build_object(
    'battleId',       attempt_id,
    'consumedTowers', towers,
    'state',          (select public.idw_get_state())
  );
end $$;
grant execute on function public.pvp_start_battle(integer, integer[], text) to authenticated;

-- RPC: record a PvP battle result — replaces direct client writes to pvp_world
-- Fix 4: requires p_battle_id so the server verifies the battle was actually recorded
-- as 'victory' for this user before granting the territory claim.
-- The pvp-simulate Edge Function sets result='victory' in idw_battle_attempts;
-- this function reads that to decide, ignoring the client-supplied p_won entirely.
create or replace function public.pvp_battle_ended(p_tile_idx integer, p_won boolean, p_battle_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p              public.idw_player_state;
  cooldown_until timestamptz := now() + interval '30 seconds';
  v_server_won   boolean := false;
  b_result       text;
  b_started_at   timestamptz;
begin
  p := public.idw_ensure_player();

  -- If a battle ID is provided, verify server recorded a victory for this user.
  -- Ignores client p_won — server result is authoritative.
  -- Anti-cheat: battle ID is always required — the legacy no-ID path is blocked.
  -- pvp-simulate always passes p_battle_id; old clients that call this RPC directly
  -- without a verified battle ID would previously be able to set p_won=true freely.
  if p_battle_id is null then
    raise exception 'battle_id required for pvp_battle_ended';
  end if;

  select result, started_at into b_result, b_started_at
    from public.idw_battle_attempts
    where id = p_battle_id and user_id = p.user_id;

  if b_result is null then
    raise exception 'Battle not found or does not belong to this user';
  end if;
  -- Minimum duration check
  if now() - b_started_at < interval '20 seconds' then
    raise exception 'Battle completed too quickly';
  end if;
  -- Server simulation result is authoritative — p_won parameter is ignored entirely
  v_server_won := (b_result = 'victory');

  if v_server_won then
    insert into public.pvp_world (tile_idx, owner_id, attacking_until, claimed_at)
    values (p_tile_idx, p.user_id, cooldown_until, now())
    on conflict (tile_idx) do update
      set owner_id        = p.user_id,
          attacking_until = cooldown_until,
          claimed_at      = now();
  else
    update public.pvp_world
      set attacking_until = cooldown_until
    where tile_idx = p_tile_idx;
  end if;

  return jsonb_build_object('ok', true, 'won', v_server_won);
end $$;
grant execute on function public.pvp_battle_ended(integer, boolean, uuid) to authenticated;

-- RPC: capture enclosed tiles after a chain-enclosure victory (chain mechanic).
-- Anti-cheat: requires that the calling user won a PvP battle within the last
-- 60 seconds. Without this, any authenticated user could call this RPC from the
-- browser console to capture up to 10 tiles with no battle played.
create or replace function public.pvp_chain_capture(p_tile_idxs integer[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p              public.idw_player_state;
  cooldown_until timestamptz := now() + interval '10 seconds';
  tidx           integer;
  recent_victory boolean;
begin
  p := public.idw_ensure_player();

  -- Require a verified PvP victory within the last 60 seconds.
  -- pvp-simulate stamps result='victory' on the battle record; chain capture is only
  -- meaningful immediately after winning a tile, so 60s is a generous window.
  select exists(
    select 1 from public.idw_battle_attempts
    where user_id    = p.user_id
      and result     = 'victory'
      and stage_id like 'pvp-%'
      and finished_at >= now() - interval '60 seconds'
  ) into recent_victory;

  if not recent_victory then
    raise exception 'Chain capture requires a recent PvP victory';
  end if;

  -- Limit tile count to prevent bulk-capture abuse
  if array_length(p_tile_idxs, 1) > 20 then
    raise exception 'Too many tiles in chain capture (max 20)';
  end if;

  foreach tidx in array p_tile_idxs loop
    insert into public.pvp_world (tile_idx, owner_id, attacking_until, claimed_at)
    values (tidx, p.user_id, cooldown_until, now())
    on conflict (tile_idx) do update
      set owner_id        = p.user_id,
          attacking_until = cooldown_until,
          claimed_at      = now();
  end loop;

  return jsonb_build_object('ok', true, 'captured', array_length(p_tile_idxs, 1));
end $$;
grant execute on function public.pvp_chain_capture(integer[]) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- RESEARCH SYSTEM FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Start a research item: validate prereqs, deduct resources, begin timer
create or replace function public.idw_start_research(
  p_research_id text,
  p_cost jsonb,
  p_requires text[],
  p_duration_ms bigint
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  req text;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  rs jsonb;
begin
  p := public.idw_ensure_player();

  -- Only one research at a time (shared queue with tower research)
  if p.active_research_id is not null then
    raise exception 'Already researching: %', p.active_research_id;
  end if;
  if p.active_tower_research is not null then
    raise exception 'Tower research in progress: %', p.active_tower_research->>'towerId';
  end if;

  rs := p.research->p_research_id;
  if coalesce((rs->>'done')::boolean, false) then
    raise exception 'Research already completed';
  end if;
  if coalesce((rs->>'researching')::boolean, false) then
    raise exception 'Research already in progress';
  end if;

  -- Check all prerequisites are done
  if p_requires is not null then
    foreach req in array p_requires loop
      if not coalesce((p.research->req->>'done')::boolean, false) then
        raise exception 'Prerequisite not met: %', req;
      end if;
    end loop;
  end if;

  -- Check and deduct resources
  if not public.idw_can_pay(p.resources, p_cost) then
    raise exception 'Not enough resources';
  end if;

  update public.idw_player_state
  set
    resources = public.idw_apply_resource_delta(resources, public.idw_negative(p_cost)),
    research = jsonb_set(
      coalesce(research, '{}'::jsonb),
      array[p_research_id],
      jsonb_build_object(
        'done', false,
        'researching', true,
        'startMs', now_ms,
        'durationMs', p_duration_ms,
        'cost', p_cost
      )
    ),
    active_research_id = p_research_id,
    updated_at = now()
  where user_id = p.user_id;

  return public.idw_get_state();
end $$;
grant execute on function public.idw_start_research(text, jsonb, text[], bigint) to authenticated;

-- Cancel in-progress research and refund 50% of original cost
create or replace function public.idw_cancel_research(p_research_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  rs jsonb;
  orig_cost jsonb;
  refund jsonb := '{}'::jsonb;
  k text; v integer;
begin
  p := public.idw_ensure_player();

  rs := p.research->p_research_id;
  if not coalesce((rs->>'researching')::boolean, false) then
    raise exception 'Research not in progress';
  end if;

  -- Build 50% refund from stored cost
  orig_cost := coalesce(rs->'cost', '{}'::jsonb);
  for k, v in
    select key, greatest(1, (value::numeric / 2)::integer)
    from jsonb_each_text(orig_cost)
  loop
    refund := jsonb_set(refund, array[k], to_jsonb(v), true);
  end loop;

  update public.idw_player_state
  set
    resources = public.idw_apply_resource_delta(resources, refund),
    research = jsonb_set(
      research,
      array[p_research_id],
      jsonb_build_object('done', false, 'researching', false, 'startMs', 0, 'durationMs', 0)
    ),
    active_research_id = null,
    updated_at = now()
  where user_id = p.user_id;

  return public.idw_get_state();
end $$;
grant execute on function public.idw_cancel_research(text) to authenticated;

-- Called on login to resolve any research that completed while offline
create or replace function public.idw_resolve_offline_research()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  return public.idw_check_research_completion();
end $$;
grant execute on function public.idw_resolve_offline_research() to authenticated;

-- ══════════════════════════════════════════════════════════════
-- TOWER RESEARCH SYSTEM
-- ══════════════════════════════════════════════════════════════

-- Add tower research columns to player state
alter table public.idw_player_state
  add column if not exists tower_research_levels jsonb not null default '{}',
  add column if not exists active_tower_research jsonb;

-- Start tower research (runs independently from normal research queue)
create or replace function public.idw_start_tower_research(
  p_tower_id text,
  p_cost jsonb,
  p_duration_ms bigint
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  current_level int;
begin
  if p_tower_id not in ('archer','catapult','crossbow','ice_tower','sniper','inferno') then
    raise exception 'Invalid tower id: %', p_tower_id;
  end if;

  p := public.idw_ensure_player();

  if p.active_tower_research is not null then
    raise exception 'Tower research already in progress';
  end if;
  if p.active_research_id is not null then
    raise exception 'Already researching: %', p.active_research_id;
  end if;

  current_level := coalesce((p.tower_research_levels->>p_tower_id)::int, 0);
  if current_level >= 10 then
    raise exception 'Tower already at max research level (10)';
  end if;

  if not public.idw_can_pay(p.resources, p_cost) then
    raise exception 'Not enough resources';
  end if;

  update public.idw_player_state
  set
    resources = public.idw_apply_resource_delta(resources, public.idw_negative(p_cost)),
    active_tower_research = jsonb_build_object(
      'towerId', p_tower_id,
      'startMs', now_ms,
      'durationMs', p_duration_ms,
      'cost', p_cost
    ),
    updated_at = now()
  where user_id = p.user_id;

  return public.idw_get_state();
end $$;
grant execute on function public.idw_start_tower_research(text, jsonb, bigint) to authenticated;

-- Update idw_check_research_completion to also handle tower research
create or replace function public.idw_check_research_completion()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  rs jsonb;
  rid text;
  completed text[] := '{}';
  atr jsonb;
  tower_id text;
  cur_level int;
begin
  p := public.idw_ensure_player();

  -- Check normal research
  rid := p.active_research_id;
  if rid is not null then
    rs := p.research->rid;
    if coalesce((rs->>'researching')::boolean, false)
       and now_ms >= coalesce((rs->>'startMs')::bigint, 0) + coalesce((rs->>'durationMs')::bigint, 0) then

      update public.idw_player_state
      set
        research = jsonb_set(
          research,
          array[rid],
          jsonb_build_object('done', true, 'researching', false, 'startMs', 0, 'durationMs', 0)
        ),
        active_research_id = null,
        player_xp = player_xp + 30,
        updated_at = now()
      where user_id = p.user_id;

      completed := array_append(completed, rid);
      p := public.idw_ensure_player();
    end if;
  end if;

  -- Check tower research
  atr := p.active_tower_research;
  if atr is not null then
    if now_ms >= coalesce((atr->>'startMs')::bigint, 0) + coalesce((atr->>'durationMs')::bigint, 0) then
      tower_id := atr->>'towerId';
      cur_level := coalesce((p.tower_research_levels->>tower_id)::int, 0);

      update public.idw_player_state
      set
        tower_research_levels = jsonb_set(
          coalesce(tower_research_levels, '{}'::jsonb),
          array[tower_id],
          to_jsonb(cur_level + 1)
        ),
        active_tower_research = null,
        player_xp = player_xp + 30,
        updated_at = now()
      where user_id = p.user_id;

      completed := array_append(completed, 'tower_research:' || tower_id);
    end if;
  end if;

  return jsonb_build_object('completed_research', to_jsonb(completed), 'state', public.idw_get_state());
end $$;
grant execute on function public.idw_check_research_completion() to authenticated;

-- ══════════════════════════════════════════════════════════════
-- ALLIANCE SYSTEM
-- ══════════════════════════════════════════════════════════════

-- Power level columns (written by client syncPowerLevel())
alter table public.idw_player_state
  add column if not exists power_level          integer not null default 0,
  add column if not exists pl_account_level     integer not null default 0,
  add column if not exists pl_resources         integer not null default 0,
  add column if not exists pl_armory            integer not null default 0,
  add column if not exists pl_node_upgrades     integer not null default 0,
  add column if not exists pl_silo_upgrades     integer not null default 0,
  add column if not exists pl_research          integer not null default 0,
  add column if not exists pl_campaign_progress integer not null default 0,
  add column if not exists pl_permanent_buffs   integer not null default 0;

create table if not exists public.idw_alliances (
  id                      uuid    primary key default gen_random_uuid(),
  name                    text    not null,
  tag                     text    not null,
  description             text    not null default '',
  announcement            text    not null default '',
  announcement_updated_at timestamptz,
  announcement_updated_by text,
  join_type               text    not null default 'open' check (join_type in ('open','apply','invite')),
  min_power               integer not null default 0,
  language                text    not null default 'EN',
  max_members             integer not null default 20,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
-- (alter stmts for already-created DBs are in the migration scripts)

create unique index if not exists idw_alliances_name_ci on public.idw_alliances (lower(name));
create unique index if not exists idw_alliances_tag_ci  on public.idw_alliances (upper(tag));

create table if not exists public.idw_alliance_members (
  alliance_id uuid not null references public.idw_alliances(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rank        text not null default 'recruit' check (rank in ('commander','officer','veteran','member','recruit')),
  joined_at   timestamptz not null default now(),
  primary key (alliance_id, user_id),
  unique (user_id)  -- one alliance per player
);

create table if not exists public.idw_alliance_chat (
  id          uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.idw_alliances(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  message     text not null check (char_length(message) between 1 and 500),
  created_at  timestamptz not null default now()
);

alter table public.idw_alliances        enable row level security;
alter table public.idw_alliance_members enable row level security;
alter table public.idw_alliance_chat    enable row level security;

drop policy if exists idw_alliances_select        on public.idw_alliances;
drop policy if exists idw_alliance_members_select on public.idw_alliance_members;
drop policy if exists idw_alliance_chat_select    on public.idw_alliance_chat;

create policy idw_alliances_select        on public.idw_alliances        for select using (true);
create policy idw_alliance_members_select on public.idw_alliance_members for select using (true);
create policy idw_alliance_chat_select    on public.idw_alliance_chat    for select using (
  exists (select 1 from public.idw_alliance_members where alliance_id = idw_alliance_chat.alliance_id and user_id = auth.uid())
);

-- Rank helpers
create or replace function public.idw_rank_order(r text) returns int language sql immutable as $$
  select case r when 'commander' then 1 when 'officer' then 2 when 'veteran' then 3 when 'member' then 4 when 'recruit' then 5 else 9 end;
$$;
create or replace function public.idw_rank_up(r text) returns text language sql immutable as $$
  select case r when 'recruit' then 'member' when 'member' then 'veteran' when 'veteran' then 'officer' when 'officer' then 'commander' else null end;
$$;
create or replace function public.idw_rank_down(r text) returns text language sql immutable as $$
  select case r when 'commander' then 'officer' when 'officer' then 'veteran' when 'veteran' then 'member' when 'member' then 'recruit' else null end;
$$;

-- Get current player's full alliance state (membership + members list + chat + territory + special tiles)
create or replace function public.idw_get_alliance_state()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p                  public.idw_player_state;
  m                  public.idw_alliance_members;
  a                  public.idw_alliances;
  v_members          jsonb;
  v_chat             jsonb;
  v_territory_value  int     := 0;
  v_prod_bonus       numeric := 0;
  v_def_bonus        numeric := 0;
  v_owned_special    jsonb;
begin
  p := public.idw_ensure_player();
  select * into m from public.idw_alliance_members where user_id = p.user_id;
  if m.alliance_id is null then
    return jsonb_build_object('in_alliance', false);
  end if;
  select * into a from public.idw_alliances where id = m.alliance_id;

  -- Territory: sum territory_value of all pvp tiles owned by any alliance member
  select
    coalesce(sum(pw.territory_value), 0)::int,
    coalesce(sum(case when pw.territory_bonus_type = 'production' then pw.territory_bonus_value else 0 end), 0),
    coalesce(sum(case when pw.territory_bonus_type = 'defense'    then pw.territory_bonus_value else 0 end), 0)
  into v_territory_value, v_prod_bonus, v_def_bonus
  from public.pvp_world pw
  join public.idw_alliance_members am_t on am_t.user_id = pw.owner_id
  where am_t.alliance_id = m.alliance_id;

  -- Owned special territories (only tiles that are actually claimed by an alliance member)
  select jsonb_agg(jsonb_build_object('tile_idx', pw.tile_idx::int, 'special_id', pw.special_id))
  into v_owned_special
  from public.pvp_world pw
  join public.idw_alliance_members am_t on am_t.user_id = pw.owner_id
  where am_t.alliance_id = m.alliance_id
    and pw.special_id is not null
    and pw.owner_id is not null;

  -- Members: ordered by rank then power desc
  select jsonb_agg(
    jsonb_build_object(
      'user_id',     am.user_id,
      'username',    coalesce(au.raw_user_meta_data->>'username', split_part(au.email,'@',1)),
      'rank',        am.rank,
      'power',       coalesce(ps.power_level, 0),
      'level',       coalesce(ps.player_level, 1),
      'last_online', ps.last_seen
    ) order by public.idw_rank_order(am.rank), coalesce(ps.power_level,0) desc
  ) into v_members
  from public.idw_alliance_members am
  join auth.users au on au.id = am.user_id
  left join public.idw_player_state ps on ps.user_id = am.user_id
  where am.alliance_id = m.alliance_id;

  -- Chat: last 50 messages oldest-first
  select jsonb_agg(
    jsonb_build_object(
      'id',         c.id,
      'user_id',    c.user_id,
      'username',   coalesce(au.raw_user_meta_data->>'username', split_part(au.email,'@',1)),
      'rank',       coalesce(am2.rank, 'member'),
      'message',    c.message,
      'created_at', c.created_at
    ) order by c.created_at
  ) into v_chat
  from (select * from public.idw_alliance_chat
        where alliance_id = m.alliance_id
        order by created_at desc limit 50) c
  join auth.users au on au.id = c.user_id
  left join public.idw_alliance_members am2
    on am2.user_id = c.user_id and am2.alliance_id = m.alliance_id;

  return jsonb_build_object(
    'in_alliance',                true,
    'my_rank',                    m.rank,
    'my_user_id',                 p.user_id::text,
    'territory_value',            v_territory_value,
    'territory_production_bonus', v_prod_bonus,
    'territory_defense_bonus',    v_def_bonus,
    'owned_special_tiles',        coalesce(v_owned_special, '[]'::jsonb),
    'alliance', jsonb_build_object(
      'id',                      a.id,
      'name',                    a.name,
      'tag',                     a.tag,
      'description',             a.description,
      'announcement',            a.announcement,
      'announcement_updated_at', a.announcement_updated_at,
      'announcement_updated_by', a.announcement_updated_by,
      'join_type',               a.join_type,
      'min_power',               a.min_power,
      'language',                a.language,
      'max_members',             a.max_members,
      'member_count', (select count(*) from public.idw_alliance_members where alliance_id = a.id),
      'total_power',  coalesce((
        select sum(coalesce(ps2.power_level,0))
        from public.idw_alliance_members am3
        left join public.idw_player_state ps2 on ps2.user_id = am3.user_id
        where am3.alliance_id = a.id
      ), 0)
    ),
    'members', coalesce(v_members, '[]'::jsonb),
    'chat',    coalesce(v_chat,    '[]'::jsonb)
  );
end $$;
grant execute on function public.idw_get_alliance_state() to authenticated;

-- List alliances for the browser
create or replace function public.idw_list_alliances(
  p_search        text    default '',
  p_join_type     text    default 'all',
  p_min_power     bigint  default 0,
  p_max_power     bigint  default 0,
  p_lang          text    default 'all',
  p_sort          text    default 'power',
  p_joinable_only boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  select jsonb_agg(row_data order by sort_val desc) into result from (
    select
      jsonb_build_object(
        'id',           a.id,
        'name',         a.name,
        'tag',          a.tag,
        'description',  a.description,
        'join_type',    a.join_type,
        'min_power',    a.min_power,
        'language',     a.language,
        'max_members',  a.max_members,
        'member_count', md.cnt,
        'total_power',  md.tot
      ) row_data,
      case when p_sort = 'members' then md.cnt::float8 else md.tot::float8 end sort_val
    from public.idw_alliances a
    join lateral (
      select count(*)::int cnt, coalesce(sum(coalesce(ps.power_level,0)),0)::bigint tot
      from public.idw_alliance_members am
      left join public.idw_player_state ps on ps.user_id = am.user_id
      where am.alliance_id = a.id
    ) md on true
    where
      (p_search = '' or a.name ilike '%' || p_search || '%' or upper(a.tag) ilike '%' || upper(p_search) || '%')
      and (p_join_type = 'all' or a.join_type = p_join_type)
      and (p_min_power = 0 or md.tot >= p_min_power)
      and (p_max_power = 0 or md.tot <= p_max_power)
      and (p_lang = 'all' or a.language = p_lang)
      and (not p_joinable_only or (a.join_type <> 'invite' and md.cnt < a.max_members))
    limit 50
  ) sub;
  return coalesce(result, '[]'::jsonb);
end $$;
grant execute on function public.idw_list_alliances(text,text,bigint,bigint,text,text,boolean) to authenticated;

-- Join an open alliance
create or replace function public.idw_join_alliance(p_alliance_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  a public.idw_alliances;
  cnt int;
begin
  p := public.idw_ensure_player();
  if exists (select 1 from public.idw_alliance_members where user_id = p.user_id) then
    raise exception 'Already in an alliance';
  end if;
  select * into a from public.idw_alliances where id = p_alliance_id;
  if a.id is null then raise exception 'Alliance not found'; end if;
  if a.join_type <> 'open' then raise exception 'This alliance requires an application'; end if;
  select count(*) into cnt from public.idw_alliance_members where alliance_id = p_alliance_id;
  if cnt >= a.max_members then raise exception 'Alliance is full'; end if;
  if coalesce(p.power_level,0) < a.min_power then raise exception 'Your power level is too low'; end if;
  insert into public.idw_alliance_members (alliance_id, user_id, rank) values (p_alliance_id, p.user_id, 'recruit');
  return public.idw_get_alliance_state();
end $$;
grant execute on function public.idw_join_alliance(uuid) to authenticated;

-- Apply to an apply-type alliance (adds as recruit pending review)
create or replace function public.idw_apply_alliance(p_alliance_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  a public.idw_alliances;
  cnt int;
begin
  p := public.idw_ensure_player();
  if exists (select 1 from public.idw_alliance_members where user_id = p.user_id) then
    raise exception 'Already in an alliance';
  end if;
  select * into a from public.idw_alliances where id = p_alliance_id;
  if a.id is null then raise exception 'Alliance not found'; end if;
  if a.join_type = 'invite' then raise exception 'This alliance is invite-only'; end if;
  select count(*) into cnt from public.idw_alliance_members where alliance_id = p_alliance_id;
  if cnt >= a.max_members then raise exception 'Alliance is full'; end if;
  if coalesce(p.power_level,0) < a.min_power then raise exception 'Your power level is too low'; end if;
  insert into public.idw_alliance_members (alliance_id, user_id, rank) values (p_alliance_id, p.user_id, 'recruit');
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.idw_apply_alliance(uuid) to authenticated;

-- Leave alliance (commander can only leave if sole member, else must transfer first)
create or replace function public.idw_leave_alliance()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p   public.idw_player_state;
  m   public.idw_alliance_members;
  cnt int;
begin
  p := public.idw_ensure_player();
  select * into m from public.idw_alliance_members where user_id = p.user_id;
  if m.alliance_id is null then raise exception 'Not in an alliance'; end if;
  if m.rank = 'commander' then
    select count(*) into cnt from public.idw_alliance_members where alliance_id = m.alliance_id;
    if cnt > 1 then raise exception 'Transfer leadership before leaving'; end if;
    delete from public.idw_alliances where id = m.alliance_id;
  else
    delete from public.idw_alliance_members where user_id = p.user_id;
  end if;
  return jsonb_build_object('in_alliance', false);
end $$;
grant execute on function public.idw_leave_alliance() to authenticated;

-- Send alliance chat message
create or replace function public.idw_send_alliance_chat(p_message text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  m public.idw_alliance_members;
begin
  p := public.idw_ensure_player();
  select * into m from public.idw_alliance_members where user_id = p.user_id;
  if m.alliance_id is null then raise exception 'Not in an alliance'; end if;
  if trim(coalesce(p_message,'')) = '' then raise exception 'Empty message'; end if;
  insert into public.idw_alliance_chat (alliance_id, user_id, message)
  values (m.alliance_id, p.user_id, trim(p_message));
  return public.idw_get_alliance_state();
end $$;
grant execute on function public.idw_send_alliance_chat(text) to authenticated;

-- Promote a member (server validates actor's rank)
create or replace function public.idw_promote_member(p_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p      public.idw_player_state;
  actor  public.idw_alliance_members;
  target public.idw_alliance_members;
  new_rank text;
begin
  p := public.idw_ensure_player();
  select * into actor  from public.idw_alliance_members where user_id = p.user_id;
  if actor.alliance_id is null then raise exception 'Not in an alliance'; end if;
  select * into target from public.idw_alliance_members where user_id = p_target_user_id and alliance_id = actor.alliance_id;
  if target.user_id is null then raise exception 'Member not in your alliance'; end if;
  if public.idw_rank_order(actor.rank) >= public.idw_rank_order(target.rank) then
    raise exception 'Insufficient rank to promote this member';
  end if;
  new_rank := public.idw_rank_up(target.rank);
  if new_rank is null then raise exception 'Cannot promote further'; end if;
  -- Promoting to commander transfers leadership
  if new_rank = 'commander' then
    if actor.rank <> 'commander' then raise exception 'Only the commander can transfer leadership'; end if;
    update public.idw_alliance_members set rank = 'officer' where user_id = p.user_id;
  end if;
  update public.idw_alliance_members set rank = new_rank where user_id = p_target_user_id and alliance_id = actor.alliance_id;
  return public.idw_get_alliance_state();
end $$;
grant execute on function public.idw_promote_member(uuid) to authenticated;

-- Demote a member
create or replace function public.idw_demote_member(p_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p      public.idw_player_state;
  actor  public.idw_alliance_members;
  target public.idw_alliance_members;
  new_rank text;
begin
  p := public.idw_ensure_player();
  select * into actor  from public.idw_alliance_members where user_id = p.user_id;
  if actor.alliance_id is null then raise exception 'Not in an alliance'; end if;
  select * into target from public.idw_alliance_members where user_id = p_target_user_id and alliance_id = actor.alliance_id;
  if target.user_id is null then raise exception 'Member not in your alliance'; end if;
  if target.rank = 'commander' then raise exception 'Cannot demote the commander'; end if;
  if public.idw_rank_order(actor.rank) >= public.idw_rank_order(target.rank) then
    raise exception 'Insufficient rank to demote this member';
  end if;
  new_rank := public.idw_rank_down(target.rank);
  if new_rank is null then raise exception 'Cannot demote further'; end if;
  update public.idw_alliance_members set rank = new_rank where user_id = p_target_user_id and alliance_id = actor.alliance_id;
  return public.idw_get_alliance_state();
end $$;
grant execute on function public.idw_demote_member(uuid) to authenticated;

-- Kick a member
create or replace function public.idw_kick_member(p_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p      public.idw_player_state;
  actor  public.idw_alliance_members;
  target public.idw_alliance_members;
begin
  p := public.idw_ensure_player();
  select * into actor from public.idw_alliance_members where user_id = p.user_id;
  if actor.alliance_id is null then raise exception 'Not in an alliance'; end if;
  if p_target_user_id = p.user_id then raise exception 'Cannot kick yourself'; end if;
  select * into target from public.idw_alliance_members where user_id = p_target_user_id and alliance_id = actor.alliance_id;
  if target.user_id is null then raise exception 'Member not in your alliance'; end if;
  if target.rank = 'commander' then raise exception 'Cannot kick the commander'; end if;
  if public.idw_rank_order(actor.rank) >= public.idw_rank_order(target.rank) then
    raise exception 'Insufficient rank to kick this member';
  end if;
  delete from public.idw_alliance_members where user_id = p_target_user_id and alliance_id = actor.alliance_id;
  return public.idw_get_alliance_state();
end $$;
grant execute on function public.idw_kick_member(uuid) to authenticated;

-- Update alliance settings (commander: all fields; officer: description + announcement only)
create or replace function public.idw_update_alliance_settings(
  p_name         text,
  p_tag          text,
  p_description  text default '',
  p_announcement text default '',
  p_join_type    text default 'open'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.idw_player_state;
  m public.idw_alliance_members;
begin
  p := public.idw_ensure_player();
  select * into m from public.idw_alliance_members where user_id = p.user_id;
  if m.alliance_id is null then raise exception 'Not in an alliance'; end if;
  if m.rank not in ('commander','officer') then raise exception 'Only officers and commanders can edit settings'; end if;
  if m.rank = 'commander' then
    if trim(coalesce(p_name,'')) = '' then raise exception 'Name is required'; end if;
    if trim(coalesce(p_tag,'')) = '' then raise exception 'Tag is required'; end if;
    update public.idw_alliances
      set name = trim(p_name), tag = upper(trim(p_tag)), description = coalesce(trim(p_description),''),
          announcement = coalesce(trim(p_announcement),''), join_type = p_join_type, updated_at = now()
      where id = m.alliance_id;
  else
    -- Officers can only update description and announcement
    update public.idw_alliances
      set description = coalesce(trim(p_description),''), announcement = coalesce(trim(p_announcement),''), updated_at = now()
      where id = m.alliance_id;
  end if;
  return public.idw_get_alliance_state();
end $$;
grant execute on function public.idw_update_alliance_settings(text,text,text,text,text) to authenticated;

-- Create a new alliance (caller becomes commander)
create or replace function public.idw_create_alliance(
  p_name        text,
  p_tag         text,
  p_description text default '',
  p_join_type   text default 'open'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p      public.idw_player_state;
  new_id uuid;
begin
  p := public.idw_ensure_player();
  if exists (select 1 from public.idw_alliance_members where user_id = p.user_id) then
    raise exception 'Already in an alliance';
  end if;
  if trim(coalesce(p_name,'')) = '' then raise exception 'Name is required'; end if;
  if trim(coalesce(p_tag,'')) = '' then raise exception 'Tag is required'; end if;
  if length(trim(p_tag)) > 5 then raise exception 'Tag must be 5 characters or fewer'; end if;
  if p_join_type not in ('open','apply','invite') then raise exception 'Invalid join type'; end if;
  insert into public.idw_alliances (name, tag, description, join_type)
  values (trim(p_name), upper(trim(p_tag)), coalesce(trim(p_description),''), p_join_type)
  returning id into new_id;
  insert into public.idw_alliance_members (alliance_id, user_id, rank)
  values (new_id, p.user_id, 'commander');
  return public.idw_get_alliance_state();
end $$;
grant execute on function public.idw_create_alliance(text,text,text,text) to authenticated;

-- ── Territory map seed (migration: expand_special_territory_map) ──────────────
-- 32 named special territories + 25 basic high-TV tiles
-- ON CONFLICT: updates metadata only, never overwrites owner_id
INSERT INTO public.pvp_world (tile_idx, territory_value, territory_bonus_type, territory_bonus_value, special_id)
VALUES
  -- Production (10) — lower stats more common --
  ( 540, 2, 'production', 0.03, 'verdant_meadow'),
  (1822, 2, 'production', 0.03, 'verdant_grove'),
  (1090, 3, 'production', 0.05, 'fertile_plains'),
  (3572, 3, 'production', 0.05, 'ancient_grove'),
  (2345, 3, 'production', 0.05, 'crystal_springs'),
  (4200, 3, 'production', 0.08, 'crystal_vein'),
  (6700, 4, 'production', 0.10, 'ancient_quarry'),
  (7800, 4, 'production', 0.10, 'bountiful_vale'),
  (8500, 5, 'production', 0.12, 'golden_harvest'),
  (9500, 5, 'production', 0.15, 'life_spring'),
  -- Turret Buffs (10) — no turret HP, no boss damage --
  (1555, 3, null, 0, 'fortress_ruins'),
  (6830, 3, null, 0, 'watchtower_ridge'),
  (5050, 5, null, 0, 'arcane_battlefield'),
  (3300, 5, null, 0, 'iron_citadel'),
  (9260, 3, null, 0, 'iron_keep'),
  (4800, 3, null, 0, 'swift_barracks'),
  (2580, 7, null, 0, 'storm_citadel'),
  (6065, 7, null, 0, 'celestial_forge'),
  (7520, 3, null, 0, 'frozen_bastion'),
  (8815, 5, null, 0, 'shadow_citadel'),
  -- Mob HP Reduce (2) --
  (5535, 3, null, 0, 'sunfire_pass'),
  (3800, 5, null, 0, 'cursed_grounds'),
  -- Stage Value (10) --
  ( 450, 2, null, 0, 'stone_marker'),
  (1200, 2, null, 0, 'border_post'),
  (2100, 3, null, 0, 'frontier_camp'),
  (3150, 3, null, 0, 'waypoint_alpha'),
  (5100, 3, null, 0, 'command_ridge'),
  (7200, 3, null, 0, 'strategic_pass'),
  (4512, 5, null, 0, 'nexus_core'),
  (6500, 5, null, 0, 'valor_outpost'),
  (8200, 7, null, 0, 'dominion_spire'),
  (8080,10, null, 0, 'deep_frontier_gate'),
  -- Basic high-TV tiles (25) — no special buff, just territory value --
  -- +3 TV (15) --
  ( 150, 3, null, 0, null),
  ( 700, 3, null, 0, null),
  ( 900, 3, null, 0, null),
  (1400, 3, null, 0, null),
  (1650, 3, null, 0, null),
  (2000, 3, null, 0, null),
  (2700, 3, null, 0, null),
  (3000, 3, null, 0, null),
  (3450, 3, null, 0, null),
  (4050, 3, null, 0, null),
  (4350, 3, null, 0, null),
  (4650, 3, null, 0, null),
  (5300, 3, null, 0, null),
  (5700, 3, null, 0, null),
  (6100, 3, null, 0, null),
  -- +5 TV (10) --
  (6300, 5, null, 0, null),
  (6600, 5, null, 0, null),
  (7000, 5, null, 0, null),
  (7400, 5, null, 0, null),
  (7700, 5, null, 0, null),
  (8300, 5, null, 0, null),
  (8700, 5, null, 0, null),
  (8900, 5, null, 0, null),
  (9100, 5, null, 0, null),
  (9700, 5, null, 0, null)
ON CONFLICT (tile_idx) DO UPDATE SET
  territory_value       = EXCLUDED.territory_value,
  territory_bonus_type  = EXCLUDED.territory_bonus_type,
  territory_bonus_value = EXCLUDED.territory_bonus_value,
  special_id            = EXCLUDED.special_id;

-- ── Territory redesign (migration: territory_type_system_v2) ─────────────────
-- Separates TV (progression counter) from territory buffs.
-- All Resource/Combat/Stage territories now tv:1. Only Value territories have tv>1.
-- Stage bonus values updated to +5/+10/+15.

-- Reset territory_value to 1 for all named special territories
UPDATE public.pvp_world SET territory_value = 1
WHERE tile_idx IN (
  540,1822,1090,3572,2345,4200,6700,7800,8500,9500,   -- Resource
  1555,6830,5050,3300,9260,4800,2580,6065,7520,8815,5535,3800,  -- Combat
  450,1200,2100,3150,5100,7200,4512,6500,8200,8080     -- Stage
);

-- Update resource territory_bonus_value to match new bonusValues
UPDATE public.pvp_world SET territory_bonus_value = 0.05  WHERE tile_idx IN (540,1822,1090,3572);
UPDATE public.pvp_world SET territory_bonus_value = 0.10  WHERE tile_idx IN (2345,4200,6700,7800);
UPDATE public.pvp_world SET territory_bonus_value = 0.15  WHERE tile_idx IN (8500,9500);

-- Stage territories get no territory_bonus_type
UPDATE public.pvp_world SET territory_bonus_type = NULL, territory_bonus_value = 0
WHERE tile_idx IN (450,1200,2100,3150,5100,7200,4512,6500,8200,8080);

-- Insert 3 new legendary value territories (+10 TV)
INSERT INTO public.pvp_world (tile_idx, territory_value, territory_bonus_type, territory_bonus_value, special_id)
VALUES
  (5555, 10, null, 0, null),
  (2750, 10, null, 0, null),
  (9050, 10, null, 0, null)
ON CONFLICT (tile_idx) DO UPDATE SET
  territory_value       = EXCLUDED.territory_value,
  territory_bonus_type  = EXCLUDED.territory_bonus_type,
  territory_bonus_value = EXCLUDED.territory_bonus_value;

-- ── Reposition x=0 territories + rarity-based colors (migration: territory_reposition_v1) ──
-- Fixes: all special territories that landed at tx=0 (tile_idx % 100 = 0).
-- Replaces all 25 basic TV tiles with properly-spread positions.

-- Step 1: Clear special_id from old x=0 named special territory positions
-- (tiles keep their owner if claimed, but become regular defense tiles)
UPDATE public.pvp_world
SET special_id = NULL, territory_bonus_type = NULL, territory_bonus_value = 0
WHERE tile_idx IN (
  -- Resource (old x=0 positions)
  4200, 6700, 7800, 8500, 9500,
  -- Combat (old x=0 positions)
  3300, 4800, 3800,
  -- Stage (old x=0 positions)
  1200, 2100, 5100, 7200, 6500, 8200
);

-- Step 2: Insert named special territories at corrected positions
-- rare=#5090f0, epic=#c050f0, legendary=#f0c040 (glowColor now rarity-based on client)
INSERT INTO public.pvp_world (tile_idx, territory_value, territory_bonus_type, territory_bonus_value, special_id)
VALUES
  -- Resource territories (moved from x=0)
  (4275, 1, 'production', 0.10, 'resource_t6'),
  (6788, 1, 'production', 0.10, 'resource_t7'),
  (7845, 1, 'production', 0.10, 'resource_t8'),
  (8568, 1, 'production', 0.15, 'resource_t9'),
  (9535, 1, 'production', 0.15, 'resource_t10'),
  -- Combat territories (moved from x=0)
  (3418, 1, NULL, 0, 'combat_t4'),
  (4888, 1, NULL, 0, 'combat_t6'),
  (3828, 1, NULL, 0, 'combat_t12'),
  -- Stage territories (moved from x=0)
  (1272, 1, NULL, 0, 'stage_t2'),
  (2165, 1, NULL, 0, 'stage_t3'),
  (5782, 1, NULL, 0, 'stage_t5'),
  (7268, 1, NULL, 0, 'stage_t6'),
  (6548, 1, NULL, 0, 'stage_t8'),
  (8233, 1, NULL, 0, 'stage_t9')
ON CONFLICT (tile_idx) DO UPDATE SET
  territory_value       = EXCLUDED.territory_value,
  territory_bonus_type  = EXCLUDED.territory_bonus_type,
  territory_bonus_value = EXCLUDED.territory_bonus_value,
  special_id            = EXCLUDED.special_id;

-- Step 3: Reset old basic TV tiles to territory_value=1 (remove elevated TV)
UPDATE public.pvp_world
SET territory_value = 1
WHERE tile_idx IN (
  -- Old tv:3 tiles
  150, 700, 900, 1400, 1650, 2000, 2700, 3000, 3450, 4050, 4350, 4650, 5300, 5700, 6100,
  -- Old tv:5 tiles
  6300, 6600, 7000, 7400, 7700, 8300, 8700, 8900, 9100, 9700
)
AND special_id IS NULL;

-- Step 4: Insert new basic TV tiles at properly-spread positions
-- tv:3 (rare) — 15 tiles spread across the map
-- tv:5 (epic) — 10 tiles spread across the map
INSERT INTO public.pvp_world (tile_idx, territory_value, territory_bonus_type, territory_bonus_value, special_id)
VALUES
  -- +3 TV (rare) --
  ( 832, 3, NULL, 0, NULL),
  (1508, 3, NULL, 0, NULL),
  (1672, 3, NULL, 0, NULL),
  (2818, 3, NULL, 0, NULL),
  (3585, 3, NULL, 0, NULL),
  (4455, 3, NULL, 0, NULL),
  (5215, 3, NULL, 0, NULL),
  (5295, 3, NULL, 0, NULL),
  (5875, 3, NULL, 0, NULL),
  (6338, 3, NULL, 0, NULL),
  (7005, 3, NULL, 0, NULL),
  (7088, 3, NULL, 0, NULL),
  (7725, 3, NULL, 0, NULL),
  (8362, 3, NULL, 0, NULL),
  (9242, 3, NULL, 0, NULL),
  -- +5 TV (epic) --
  ( 348, 5, NULL, 0, NULL),
  (2015, 5, NULL, 0, NULL),
  (2688, 5, NULL, 0, NULL),
  (4033, 5, NULL, 0, NULL),
  (4768, 5, NULL, 0, NULL),
  (6222, 5, NULL, 0, NULL),
  (6582, 5, NULL, 0, NULL),
  (7543, 5, NULL, 0, NULL),
  (8592, 5, NULL, 0, NULL),
  (9325, 5, NULL, 0, NULL)
ON CONFLICT (tile_idx) DO UPDATE SET
  territory_value       = EXCLUDED.territory_value,
  territory_bonus_type  = EXCLUDED.territory_bonus_type,
  territory_bonus_value = EXCLUDED.territory_bonus_value;

-- ════════════════════════════════════════════════════════════════════════════
-- HERO GEAR, MARKET STATE & HERO SELECTION  (added this session)
-- All three are new client-side features that need server-authoritative storage
-- so data survives clearing localStorage / logging in from a different device.
-- ════════════════════════════════════════════════════════════════════════════

-- Add new columns (idempotent)
ALTER TABLE public.idw_player_state
  ADD COLUMN IF NOT EXISTS hero_gear    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS market_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hero_state   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── idw_state_to_v2: CANONICAL FINAL VERSION ────────────────────────────────
-- Includes every field the client reads in applyServerPayload:
--   resources, playerXP, playerLevel, nodes, research, armoryTowers,
--   campCompleted, lastSeen, silo, towerResearchLevels, activeTowerResearch,
--   heroGear, marketState, heroState
CREATE OR REPLACE FUNCTION public.idw_state_to_v2(p public.idw_player_state)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE n jsonb := p.nodes; res_id text; i int; ns jsonb; stored int;
BEGIN
  FOREACH res_id IN ARRAY array['wood','stone','fiber','leather','ore'] LOOP
    FOR i IN 0..4 LOOP
      ns := n->res_id->i;
      stored := public.idw_node_stored_amount(ns, i, p.player_level, p.research, res_id);
      ns := jsonb_set(ns,'{storedAmount}',to_jsonb(stored),true);
      n := jsonb_set(n, array[res_id,i::text], ns, true);
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object(
    'resources',           p.resources,
    'playerXP',            p.player_xp,
    'playerLevel',         p.player_level,
    'nodes',               n,
    'research',            p.research,
    'armoryTowers',        p.armory,
    'campCompleted',       to_jsonb(p.campaign_completed),
    'lastSeen',            extract(epoch from p.last_seen)*1000,
    'silo',                p.silo,
    'towerResearchLevels', COALESCE(p.tower_research_levels, '{}'::jsonb),
    'activeTowerResearch', p.active_tower_research,
    'heroGear',            p.hero_gear,
    'marketState',         p.market_state,
    'heroState',           p.hero_state
  );
END $$;

-- ── Save RPCs (called fire-and-forget after every mutation) ──────────────────

CREATE OR REPLACE FUNCTION public.idw_save_hero_gear(p_gear jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.idw_player_state SET hero_gear = p_gear, updated_at = now() WHERE user_id = u;
END $$;

CREATE OR REPLACE FUNCTION public.idw_save_market_state(p_market jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.idw_player_state SET market_state = p_market, updated_at = now() WHERE user_id = u;
END $$;

CREATE OR REPLACE FUNCTION public.idw_save_hero_state(p_hero_state jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.idw_player_state SET hero_state = p_hero_state, updated_at = now() WHERE user_id = u;
END $$;

-- ── Admin helpers ────────────────────────────────────────────────────────────

-- idw_craft_gem(p_gem_type text, p_amount int) → jsonb {resources, gemType, gemCount}
--   Deducts resources and adds gems to market_state. Costs per gem:
--   petGems: 200 wood + 100 fiber | weaponGems: 200 ore + 100 stone
--   relicGems: 200 leather + 100 fiber | skillGems: 100 of each resource

-- idw_admins table: user_ids that have admin privileges in-game.
-- idw_check_admin() → boolean: returns true if current user is in idw_admins.
-- idw_admin_set_level(p_level int): sets player_level and resets player_xp to 0.
-- idw_admin_reset_account(): resets idw_player_state to default fresh-account values.

-- Set gem balance for a player by email (run with service role in SQL editor)
-- Example: SELECT public.idw_admin_set_gems('player@example.com', 1000000);
CREATE OR REPLACE FUNCTION public.idw_admin_set_gems(p_email text, p_gems int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = p_email;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found: %', p_email; END IF;
  INSERT INTO public.idw_player_state(user_id) VALUES (v_uid) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.idw_player_state
    SET market_state = jsonb_set(
          CASE WHEN market_state = '{}'::jsonb OR market_state IS NULL
               THEN '{"totalRolls":0,"pityCount":0,"epicPity":0,"heroes":{},"gearPityCount":0,"gearEpicPity":0}'::jsonb
               ELSE market_state
          END,
          '{gems}', to_jsonb(p_gems)
        ),
        updated_at = now()
    WHERE user_id = v_uid;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- AUTH / SESSION FUNCTIONS  (live on DB but missing from this file)
-- Documented here for completeness; these already exist on the Supabase instance.
-- ════════════════════════════════════════════════════════════════════════════

-- idw_create_guest_account(p_username text, p_email text, p_password text)
-- Creates a pre-confirmed guest account with @idw.local email domain.
-- SECURITY DEFINER on auth schema — already deployed on Supabase.

-- idw_link_guest_account(p_new_email text, p_new_password text, p_username text)
-- Upgrades a guest account to a real email account.
-- SECURITY DEFINER on auth schema — already deployed on Supabase.

-- idw_claim_session(p_session_id text) → json {allowed, remaining_seconds}
-- Multi-tab kick: stamps active_session_id on auth.users; blocks concurrent sessions.
-- Already deployed on Supabase.

-- idw_release_session(p_session_id text)
-- Clears active_session_id when the tab closes gracefully.
-- Already deployed on Supabase.

-- idw_set_announcement(p_text text)
-- Commander-only: updates alliance announcement text.
-- Already deployed on Supabase (see alliance section above).

-- ══════════════════════════════════════════════════════════════════════════════
-- ANTI-CHEAT LOGGING & HARDENED SAVE FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════
-- This section hardens three previously unvalidated client-writable surfaces:
--   1. idw_save_market_state — gems/pts could be injected freely
--   2. idw_save_hero_gear    — unowned items could be equipped
--   3. idw_save_state        — resources/XP/armory could be set arbitrarily
-- It also creates idw_anti_cheat_logs to record suspicious events for review.
-- ══════════════════════════════════════════════════════════════════════════════

-- Anti-cheat event log. Never grants or revokes rewards automatically.
-- Populated when suspicious values are detected; reviewed manually.
CREATE TABLE IF NOT EXISTS public.idw_anti_cheat_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at   timestamptz NOT NULL DEFAULT now(),
  event_type  text        NOT NULL,  -- e.g. 'gems_increase', 'unowned_gear', 'resource_inject'
  detail      jsonb       NOT NULL DEFAULT '{}'  -- client_value, server_expected, delta, etc.
);

ALTER TABLE public.idw_anti_cheat_logs ENABLE ROW LEVEL SECURITY;
-- Users cannot read their own cheat logs (prevents self-audit and tampering evidence).
-- Admins use service-role access to review.

-- ── Hardened idw_save_market_state ───────────────────────────────────────────
-- Validates that:
--   • Each gem category (petGems, weaponGems, relicGems, skillGems) can only decrease
--     or stay the same — gems are added only via the server-side idw_craft_gem RPC.
--   • pityCount variants are bounded to [0, GACHA_HARD_PITY=80].
--   • epicPity variants are bounded to [0, GACHA_EPIC_PITY=10].
--   • totalRolls can only increase.
--   • Individual hero/relic/marketSkill pts can only increase (no pts removal).
-- Suspicious values are clamped to valid bounds and logged rather than rejected
-- outright, so a desync (e.g. offline play then re-sync) doesn't hard-error.
CREATE OR REPLACE FUNCTION public.idw_save_market_state(p_market jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u           uuid    := auth.uid();
  stored      jsonb;  -- current server-side market_state
  clean       jsonb   := coalesce(p_market, '{}'::jsonb);
  suspicious  boolean := false;
  log_detail  jsonb   := '{}'::jsonb;

  -- gem categories — each can only decrease (gems are added server-side only)
  gem_keys    text[]  := ARRAY['petGems','weaponGems','relicGems','skillGems'];
  gk          text;
  stored_val  int;
  client_val  int;

  -- pity bounds
  pity_keys   text[]  := ARRAY['pityCount','gearPityCount','relicPityCount','skillPityCount'];
  epity_keys  text[]  := ARRAY['epicPity','gearEpicPity','relicEpicPity','skillEpicPity'];
  pk          text;

  -- hero/relic/marketSkill pts: each entry's pts can only increase
  cat_keys    text[]  := ARRAY['heroes','relics','marketSkills'];
  cat         text;
  stored_cat  jsonb;
  client_cat  jsonb;
  item_id     text;
  stored_pts  int;
  client_pts  int;
  stored_rolls int;
  client_rolls int;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT market_state INTO stored
    FROM public.idw_player_state WHERE user_id = u;

  IF stored IS NULL THEN stored := '{}'::jsonb; END IF;

  -- ── 1. Clamp gems: client must not increase gem counts ─────────────────────
  FOREACH gk IN ARRAY gem_keys LOOP
    stored_val := coalesce((stored->>gk)::int, 0);
    client_val := coalesce((clean->>gk)::int, 0);
    IF client_val > stored_val THEN
      suspicious := true;
      log_detail := log_detail || jsonb_build_object(
        'gems_' || gk, jsonb_build_object('stored', stored_val, 'client', client_val, 'clamped_to', stored_val)
      );
      -- Clamp to stored value — prevent gem injection
      clean := jsonb_set(clean, ARRAY[gk], to_jsonb(stored_val));
    END IF;
    -- Ensure non-negative
    IF coalesce((clean->>gk)::int, 0) < 0 THEN
      clean := jsonb_set(clean, ARRAY[gk], '0'::jsonb);
    END IF;
  END LOOP;

  -- ── 2. Clamp pity counters to valid range ──────────────────────────────────
  FOREACH pk IN ARRAY pity_keys LOOP
    client_val := coalesce((clean->>pk)::int, 0);
    IF client_val < 0 OR client_val > 80 THEN
      suspicious := true;
      log_detail := log_detail || jsonb_build_object(
        'pity_' || pk, jsonb_build_object('client', client_val, 'clamped_to', GREATEST(0, LEAST(80, client_val)))
      );
      clean := jsonb_set(clean, ARRAY[pk], to_jsonb(GREATEST(0, LEAST(80, client_val))));
    END IF;
  END LOOP;
  FOREACH pk IN ARRAY epity_keys LOOP
    client_val := coalesce((clean->>pk)::int, 0);
    IF client_val < 0 OR client_val > 10 THEN
      suspicious := true;
      log_detail := log_detail || jsonb_build_object(
        'epity_' || pk, jsonb_build_object('client', client_val, 'clamped_to', GREATEST(0, LEAST(10, client_val)))
      );
      clean := jsonb_set(clean, ARRAY[pk], to_jsonb(GREATEST(0, LEAST(10, client_val))));
    END IF;
  END LOOP;

  -- ── 3. totalRolls can only increase ────────────────────────────────────────
  stored_rolls := coalesce((stored->>'totalRolls')::int, 0);
  client_rolls := coalesce((clean->>'totalRolls')::int, 0);
  IF client_rolls < stored_rolls THEN
    suspicious := true;
    log_detail := log_detail || jsonb_build_object(
      'totalRolls', jsonb_build_object('stored', stored_rolls, 'client', client_rolls, 'clamped_to', stored_rolls)
    );
    clean := jsonb_set(clean, ARRAY['totalRolls'], to_jsonb(stored_rolls));
  END IF;

  -- ── 4. Per-item pts can only increase (heroes, relics, marketSkills) ───────
  FOREACH cat IN ARRAY cat_keys LOOP
    stored_cat := coalesce(stored->cat, '{}'::jsonb);
    client_cat := coalesce(clean->cat, '{}'::jsonb);
    FOR item_id IN SELECT key FROM jsonb_object_keys(stored_cat) AS t(key) LOOP
      stored_pts := coalesce((stored_cat->item_id->>'pts')::int, 0);
      client_pts := coalesce((client_cat->item_id->>'pts')::int, 0);
      IF client_pts < stored_pts THEN
        suspicious := true;
        log_detail := log_detail || jsonb_build_object(
          cat || '_' || item_id || '_pts', jsonb_build_object('stored', stored_pts, 'client', client_pts, 'clamped_to', stored_pts)
        );
        -- Restore pts to stored value
        clean := jsonb_set(
          clean,
          ARRAY[cat, item_id, 'pts'],
          to_jsonb(stored_pts),
          true
        );
      END IF;
    END LOOP;
  END LOOP;

  -- ── 5. Log suspicious activity ─────────────────────────────────────────────
  IF suspicious THEN
    INSERT INTO public.idw_anti_cheat_logs(user_id, event_type, detail)
    VALUES (u, 'market_state_anomaly', log_detail);
  END IF;

  -- ── 6. Save the cleaned state ──────────────────────────────────────────────
  UPDATE public.idw_player_state SET market_state = clean, updated_at = now() WHERE user_id = u;
END $$;

-- ── Hardened idw_save_hero_gear ───────────────────────────────────────────────
-- Validates:
--   1. Every equipped item ID exists in the player's ownedGear or ownedWeapons list.
--      Unknown or unowned items are silently dropped from the slot and logged.
--   2. disenchantCount can only increase, and only by at most 50 per save call.
--      A tampered value (e.g. 9999) would give +2999% tower_dmg via disenchant-scaling
--      relics — a critical cheat vector that this check closes.
CREATE OR REPLACE FUNCTION public.idw_save_hero_gear(p_gear jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u            uuid    := auth.uid();
  eq           jsonb;
  owned_ids    text[];
  slot         text;
  item_id      text;
  clean_eq     jsonb   := '{}'::jsonb;
  suspicious   boolean := false;
  log_detail   jsonb   := '{}'::jsonb;
  -- All valid gear item IDs (from GEAR_WEAPON_DEFS + GEAR_ITEM_DEFS in game.js)
  valid_items  text[]  := ARRAY[
    'iron_sword','shadow_dagger','war_axe','elven_bow','enchanted_staff',
    'stormcaller_blade','mythic_staff',
    'iron_helmet','leather_cap','celestial_helm',
    'chain_armor','iron_plate','divine_plate',
    'linen_pants','reinforced_leggings','dragonhide_leggings','shadow_leggings',
    'iron_boots','swiftwalkers','void_walker_boots',
    'wooden_shield','magic_orb','phoenix_shield'
  ];
  all_slots    text[]  := ARRAY['mainHand','offhand','helmet','armor','pants','boots'];
  owned_weapons jsonb;
  owned_gear   jsonb;
  -- disenchantCount validation
  stored_dc    int;
  client_dc    int;
  capped_dc    int;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  eq            := coalesce(p_gear->'equippedGear', '{}'::jsonb);
  owned_weapons := coalesce(p_gear->'ownedWeapons', '[]'::jsonb);
  owned_gear    := coalesce(p_gear->'ownedGear',    '[]'::jsonb);

  -- Build set of all owned item IDs from ownedWeapons + ownedGear arrays
  SELECT array_agg(e->>'id')
  INTO owned_ids
  FROM (
    SELECT jsonb_array_elements(owned_weapons) AS e
    UNION ALL
    SELECT jsonb_array_elements(owned_gear)    AS e
  ) sub
  WHERE e->>'id' IS NOT NULL;

  owned_ids := coalesce(owned_ids, ARRAY[]::text[]);

  -- ── 1. Validate each equipped slot ─────────────────────────────────────────
  FOREACH slot IN ARRAY all_slots LOOP
    item_id := eq->>slot;
    IF item_id IS NULL THEN CONTINUE; END IF;

    -- Must be a known valid item
    IF NOT (item_id = ANY(valid_items)) THEN
      suspicious := true;
      log_detail := log_detail || jsonb_build_object('unknown_item_slot_' || slot, item_id);
      CONTINUE;
    END IF;

    -- Must exist in player's owned inventory
    IF NOT (item_id = ANY(owned_ids)) THEN
      suspicious := true;
      log_detail := log_detail || jsonb_build_object('unowned_item_slot_' || slot, item_id);
      CONTINUE;
    END IF;

    clean_eq := jsonb_set(clean_eq, ARRAY[slot], to_jsonb(item_id));
  END LOOP;

  -- ── 2. Validate disenchantCount — can only increase, bounded per call ──────
  -- disenchantCount feeds disenchant-scaling relics (dissolution_core, void_remnant,
  -- breakers_mark, scrapper_seal). With 9999 dc and dissolution_core at lv10:
  --   9999 × 0.20% = +1999% tower_dmg, +999% tower_spd — a critical cheat vector.
  SELECT coalesce((hero_gear->>'disenchantCount')::int, 0)
  INTO stored_dc
  FROM public.idw_player_state WHERE user_id = u;

  client_dc := coalesce((p_gear->>'disenchantCount')::int, 0);

  -- Must not go negative
  IF client_dc < 0 THEN
    suspicious := true;
    log_detail := log_detail || '{"disenchantCount_negative":true}'::jsonb;
    client_dc := 0;
  END IF;

  -- Max 50 new disenchants per save (a session limit; a normal session disenchants far fewer)
  IF client_dc > stored_dc + 50 THEN
    suspicious := true;
    log_detail := log_detail || jsonb_build_object(
      'disenchantCount_spike',
      jsonb_build_object('stored', stored_dc, 'client', client_dc, 'capped_to', stored_dc + 50)
    );
    client_dc := stored_dc + 50;
  END IF;

  -- Hard lifetime cap: there are only ~24 gear items in the game, so even a
  -- highly committed player will not legitimately exceed a few hundred disenchants.
  -- 5000 is an extremely generous ceiling that no legitimate player will reach.
  IF client_dc > 5000 THEN
    suspicious := true;
    log_detail := log_detail || jsonb_build_object('disenchantCount_over_cap', client_dc);
    client_dc := 5000;
  END IF;

  capped_dc := client_dc;

  -- ── 3. Log and save ─────────────────────────────────────────────────────────
  IF suspicious THEN
    INSERT INTO public.idw_anti_cheat_logs(user_id, event_type, detail)
    VALUES (u, 'hero_gear_anomaly', log_detail);
  END IF;

  -- Save with validated equippedGear and capped disenchantCount.
  -- ownedWeapons and ownedGear are passed through unchanged (ownership is verified
  -- at equip time; the inventory lists themselves are client-managed).
  UPDATE public.idw_player_state
    SET hero_gear = p_gear
                 || jsonb_build_object('equippedGear',    clean_eq)
                 || jsonb_build_object('disenchantCount', capped_dc),
        updated_at = now()
  WHERE user_id = u;
END $$;

-- ── Hardened idw_save_state ───────────────────────────────────────────────────
-- Blocks direct injection of resources, XP, and player level.
-- Resources change only via crafting/battle-reward RPCs.
-- XP/level change only via idw_submit_battle_result.
-- Armory writes are preserved (needed for sync) but tower levels are capped at 30
-- to prevent injecting impossibly high-level towers.
CREATE OR REPLACE FUNCTION public.idw_save_state(p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p           public.idw_player_state;
  suspicious  boolean := false;
  log_detail  jsonb   := '{}'::jsonb;
  -- Armory level cap — towers max out at level 30 in normal gameplay
  MAX_TOWER_LEVEL CONSTANT int := 30;
  new_armory  jsonb;
  tower       jsonb;
  i           int;
  capped_lv   int;
BEGIN
  p := public.idw_ensure_player();

  -- Resources: BLOCKED — only battle/crafting RPCs may modify resources
  IF p_state ? 'resources' THEN
    suspicious := true;
    log_detail := log_detail || '{"blocked":"direct_resource_write"}'::jsonb;
    -- Silently ignore; do not raise so client does not know the attempt was caught
  END IF;

  -- PlayerXP / playerLevel: BLOCKED — only idw_submit_battle_result may award XP
  IF p_state ? 'playerXP' OR p_state ? 'playerLevel' THEN
    suspicious := true;
    log_detail := log_detail || '{"blocked":"direct_xp_level_write"}'::jsonb;
  END IF;

  -- Armory: allowed but tower levels are capped
  IF p_state ? 'armoryTowers' THEN
    new_armory := '[]'::jsonb;
    FOR i IN 0..jsonb_array_length(p_state->'armoryTowers')-1 LOOP
      tower    := p_state->'armoryTowers'->i;
      capped_lv := LEAST(coalesce((tower->>'level')::int, 1), MAX_TOWER_LEVEL);
      IF coalesce((tower->>'level')::int, 1) > MAX_TOWER_LEVEL THEN
        suspicious := true;
        log_detail := log_detail || jsonb_build_object(
          'tower_level_clamped', jsonb_build_object(
            'towerId', tower->>'towerId', 'client_level', tower->>'level', 'capped_to', MAX_TOWER_LEVEL
          )
        );
        tower := jsonb_set(tower, '{level}', to_jsonb(capped_lv));
      END IF;
      new_armory := new_armory || jsonb_build_array(tower);
    END LOOP;
    UPDATE public.idw_player_state
      SET armory = new_armory, updated_at = now()
    WHERE user_id = p.user_id;
  END IF;

  IF suspicious THEN
    INSERT INTO public.idw_anti_cheat_logs(user_id, event_type, detail)
    VALUES (p.user_id, 'save_state_anomaly', log_detail);
  END IF;

  RETURN public.idw_get_state();
END $$;

GRANT EXECUTE ON FUNCTION public.idw_save_hero_gear(jsonb)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.idw_save_market_state(jsonb)      TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- ANTI-CHEAT HARDENING v2: pvp_world RLS, battle-ID reuse, chain-capture
-- per-battle tracking, direct-RPC-bypass logging.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Enable RLS on pvp_world ───────────────────────────────────────────────
-- Without RLS an authenticated user can call
--   supabase.from('pvp_world').update({owner_id: userId}).eq('tile_idx', X)
-- directly from the browser console and claim any tile with no battle.
ALTER TABLE public.pvp_world ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pvp_world_select_all ON public.pvp_world;
-- All users can read the map for rendering; no INSERT/UPDATE/DELETE policies —
-- all writes must go through verified RPCs (pvp_battle_ended, pvp_chain_capture).
CREATE POLICY pvp_world_select_all ON public.pvp_world FOR SELECT USING (true);

-- ── 2. Track battle-ID consumption ──────────────────────────────────────────
-- territory_claimed_at: stamped when pvp_battle_ended grants a tile.
--   Prevents calling pvp_battle_ended twice with the same battle_id to claim
--   two different tiles from a single win.
-- chain_capture_claimed_at: stamped when pvp_chain_capture uses this battle.
--   Prevents calling pvp_chain_capture multiple times in the 60-second window
--   that follows a single PvP victory.
ALTER TABLE public.idw_battle_attempts
  ADD COLUMN IF NOT EXISTS territory_claimed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS chain_capture_claimed_at timestamptz;

-- ── 3. Harden pvp_battle_ended ───────────────────────────────────────────────
-- Added checks:
--   a) p_battle_id IS NULL → log (transaction commits) + return error.
--      RAISE would roll back the log; returning keeps it durable.
--      The pvp-simulate Edge Function always passes a valid battle_id so this
--      path is unreachable from the normal game flow.
--   b) territory_claimed_at IS NOT NULL → log + return error.
--      Same reasoning: the Edge Function calls this exactly once per simulation.
CREATE OR REPLACE FUNCTION public.pvp_battle_ended(
  p_tile_idx  integer,
  p_won       boolean,
  p_battle_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p                    public.idw_player_state;
  cooldown_until       timestamptz := now() + interval '30 seconds';
  v_server_won         boolean := false;
  b_result             text;
  b_started_at         timestamptz;
  b_territory_claimed  timestamptz;
BEGIN
  p := public.idw_ensure_player();

  -- Null battle_id means a direct console call with no backing battle record.
  -- Log + return so the anti-cheat entry commits (RAISE would roll it back).
  IF p_battle_id IS NULL THEN
    INSERT INTO public.idw_anti_cheat_logs(user_id, event_type, detail)
    VALUES (p.user_id, 'pvp_battle_ended_no_battle_id', jsonb_build_object(
      'function',   'pvp_battle_ended',
      'p_tile_idx', p_tile_idx,
      'p_won',      p_won,
      'reason',     'battle_id required — direct RPC call without a battle record'
    ));
    RETURN jsonb_build_object('ok', false, 'error', 'battle_id_required');
  END IF;

  SELECT result, started_at, territory_claimed_at
    INTO b_result, b_started_at, b_territory_claimed
    FROM public.idw_battle_attempts
   WHERE id = p_battle_id AND user_id = p.user_id;

  -- Battle not found or belongs to another user.
  IF b_result IS NULL THEN
    RAISE EXCEPTION 'Battle not found or does not belong to this user';
  END IF;

  IF now() - b_started_at < interval '20 seconds' THEN
    RAISE EXCEPTION 'Battle completed too quickly';
  END IF;

  -- Reuse check: the same battle_id cannot be used to claim a second tile.
  -- The Edge Function never triggers this path; only a direct console call would.
  IF b_territory_claimed IS NOT NULL THEN
    INSERT INTO public.idw_anti_cheat_logs(user_id, event_type, detail)
    VALUES (p.user_id, 'pvp_battle_id_reuse', jsonb_build_object(
      'function',              'pvp_battle_ended',
      'battle_id',             p_battle_id,
      'p_tile_idx',            p_tile_idx,
      'territory_claimed_at',  b_territory_claimed,
      'reason',                'battle_id already used for a territory claim'
    ));
    RETURN jsonb_build_object('ok', false, 'error', 'battle_id_already_used');
  END IF;

  -- Server simulation result is authoritative; p_won is ignored entirely.
  v_server_won := (b_result = 'victory');

  IF v_server_won THEN
    INSERT INTO public.pvp_world (tile_idx, owner_id, attacking_until, claimed_at)
    VALUES (p_tile_idx, p.user_id, cooldown_until, now())
    ON CONFLICT (tile_idx) DO UPDATE
      SET owner_id        = p.user_id,
          attacking_until = cooldown_until,
          claimed_at      = now();
  ELSE
    UPDATE public.pvp_world
       SET attacking_until = cooldown_until
     WHERE tile_idx = p_tile_idx;
  END IF;

  -- Mark this battle_id as consumed so it cannot be reused.
  UPDATE public.idw_battle_attempts
     SET territory_claimed_at = now()
   WHERE id = p_battle_id;

  RETURN jsonb_build_object('ok', true, 'won', v_server_won);
END $$;
GRANT EXECUTE ON FUNCTION public.pvp_battle_ended(integer, boolean, uuid) TO authenticated;

-- ── 4. Harden pvp_chain_capture ──────────────────────────────────────────────
-- Old check: any recent PvP victory in the last 60 s.
--   A player could call pvp_chain_capture N times in that window and capture
--   N × 20 tiles from a single win.
-- New check: find the most recent *unclaimed* PvP victory (chain_capture_claimed_at
--   IS NULL) and mark it used. Each win may only fuel one chain-capture call.
CREATE OR REPLACE FUNCTION public.pvp_chain_capture(p_tile_idxs integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p              public.idw_player_state;
  cooldown_until timestamptz := now() + interval '10 seconds';
  tidx           integer;
  v_claim_id     uuid;
BEGIN
  p := public.idw_ensure_player();

  -- Require a verified, unclaimed PvP victory within the last 60 seconds.
  -- Using a specific battle_id and marking it prevents calling this RPC
  -- multiple times with the same underlying win.
  SELECT id INTO v_claim_id
    FROM public.idw_battle_attempts
   WHERE user_id                  = p.user_id
     AND result                   = 'victory'
     AND stage_id                LIKE 'pvp-%'
     AND finished_at             >= now() - interval '60 seconds'
     AND chain_capture_claimed_at IS NULL
   ORDER BY finished_at DESC
   LIMIT 1;

  IF v_claim_id IS NULL THEN
    INSERT INTO public.idw_anti_cheat_logs(user_id, event_type, detail)
    VALUES (p.user_id, 'pvp_chain_capture_no_unclaimed_victory', jsonb_build_object(
      'function',   'pvp_chain_capture',
      'tile_count', array_length(p_tile_idxs, 1),
      'reason',     'no unclaimed PvP victory in the last 60 s — direct call or double-claim attempt'
    ));
    RAISE EXCEPTION 'Chain capture requires a recent PvP victory';
  END IF;

  IF array_length(p_tile_idxs, 1) > 20 THEN
    RAISE EXCEPTION 'Too many tiles in chain capture (max 20)';
  END IF;

  -- Consume this victory so it cannot fuel a second chain-capture call.
  UPDATE public.idw_battle_attempts
     SET chain_capture_claimed_at = now()
   WHERE id = v_claim_id;

  FOREACH tidx IN ARRAY p_tile_idxs LOOP
    INSERT INTO public.pvp_world (tile_idx, owner_id, attacking_until, claimed_at)
    VALUES (tidx, p.user_id, cooldown_until, now())
    ON CONFLICT (tile_idx) DO UPDATE
      SET owner_id        = p.user_id,
          attacking_until = cooldown_until,
          claimed_at      = now();
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'captured', array_length(p_tile_idxs, 1));
END $$;
GRANT EXECUTE ON FUNCTION public.pvp_chain_capture(integer[]) TO authenticated;

-- ── 5. Harden idw_submit_battle_result: log direct RPC bypass ────────────────
-- When a client calls this RPC directly (skipping the campaign-simulate Edge
-- Function), b.client_report->>'simVerified' is null/false.
-- Old behaviour: RAISE EXCEPTION — the exception AND the log both roll back,
--   leaving no trace of the attempt in idw_anti_cheat_logs.
-- New behaviour: log + consume the battle as 'rejected' + return empty reward.
--   The transaction commits so the log entry is durable and the battle cannot
--   be retried (result != 'started').
-- Same pattern for a client claiming victory when the server recorded defeat.
CREATE OR REPLACE FUNCTION public.idw_submit_battle_result(
  p_battle_id        uuid,
  p_won              boolean,
  p_waves            int,
  p_lives            int,
  p_client_gold      int,
  p_gear_fingerprint text    DEFAULT '',
  p_shop_placements  jsonb   DEFAULT '[]'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p                   public.idw_player_state;
  b                   public.idw_battle_attempts;
  v_reward            jsonb := '{}'::jsonb;
  v_resource_reward   jsonb;
  v_xp_gained         int := 0;
  max_duration        interval := interval '2 hours';
  min_duration        interval := interval '10 seconds';
  v_first_clear       boolean := false;
  v_server_fingerprint text;
  v_server_cmd_stats  jsonb;
  v_anti_cheat        jsonb;
  v_gold_cap          int;
  v_gold_spent        int := 0;
  v_gold_ok           boolean;
  v_duration_ok       boolean;
  e                   jsonb;
  v_cost              int;
BEGIN
  p := public.idw_ensure_player();
  SELECT * INTO b FROM public.idw_battle_attempts
   WHERE id = p_battle_id AND user_id = p.user_id FOR UPDATE;

  IF b.id IS NULL     THEN RAISE EXCEPTION 'Battle not found';         END IF;
  IF b.result <> 'started' THEN RAISE EXCEPTION 'Battle already submitted'; END IF;
  IF now() - b.started_at > max_duration THEN RAISE EXCEPTION 'Battle expired'; END IF;

  -- ── Direct RPC bypass detection ──────────────────────────────────────────
  -- The campaign-simulate Edge Function sets simVerified=true before calling
  -- this RPC. A missing flag means the client called this RPC directly.
  -- Log + consume (instead of RAISE) so the anti-cheat entry commits.
  IF NOT coalesce((b.client_report->>'simVerified')::boolean, false) THEN
    INSERT INTO public.idw_anti_cheat_logs(user_id, event_type, detail)
    VALUES (p.user_id, 'direct_rpc_bypass', jsonb_build_object(
      'function',  'idw_submit_battle_result',
      'battle_id', p_battle_id,
      'stage_id',  b.stage_id,
      'p_won',     p_won,
      'reason',    'simVerified not set — Edge Function was bypassed'
    ));
    UPDATE public.idw_battle_attempts
       SET result = 'rejected', finished_at = now(),
           client_report = jsonb_build_object('rejected', true, 'reason', 'direct_rpc_bypass')
     WHERE id = p_battle_id;
    RETURN jsonb_build_object('reward', '{}', 'xp_gained', 0, 'first_clear', false,
      'state', public.idw_get_state());
  END IF;

  -- ── False victory claim detection ────────────────────────────────────────
  -- Server simulation must agree with the claimed outcome.
  IF p_won AND NOT coalesce((b.client_report->>'simResult')::boolean, false) THEN
    INSERT INTO public.idw_anti_cheat_logs(user_id, event_type, detail)
    VALUES (p.user_id, 'false_victory_claim', jsonb_build_object(
      'function',   'idw_submit_battle_result',
      'battle_id',  p_battle_id,
      'stage_id',   b.stage_id,
      'p_won',      p_won,
      'sim_result', b.client_report->>'simResult',
      'reason',     'client claimed victory but server simulation recorded defeat'
    ));
    UPDATE public.idw_battle_attempts
       SET result = 'rejected', finished_at = now(),
           client_report = jsonb_build_object(
             'rejected', true, 'reason', 'false_victory_claim',
             'clientWon', p_won, 'simResult', b.client_report->'simResult')
     WHERE id = p_battle_id;
    RETURN jsonb_build_object('reward', '{}', 'xp_gained', 0, 'first_clear', false,
      'state', public.idw_get_state());
  END IF;

  -- ── Normal path ──────────────────────────────────────────────────────────
  v_duration_ok        := (now() - b.started_at >= min_duration);
  v_server_fingerprint := public.idw_compute_gear_fingerprint(p.hero_gear);
  v_server_cmd_stats   := public.idw_compute_commander_stats(p.hero_gear);

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_shop_placements, '[]'::jsonb)) LOOP
    IF e ? 'towerId' THEN
      v_cost := public.idw_tower_shop_cost(e->>'towerId');
    ELSIF e ? 'upgrade' THEN
      v_cost := public.idw_upgrade_cost(e->>'upgrade', coalesce((e->>'level')::int, 1));
    ELSIF (e->>'ascension')::boolean THEN
      v_cost := 100;
    ELSE
      v_cost := 0;
    END IF;
    v_gold_spent := v_gold_spent + v_cost;
  END LOOP;

  v_gold_cap := public.idw_compute_gold_cap(p.research, p.market_state, p_waves);
  v_gold_ok  := (v_gold_spent <= v_gold_cap);

  v_anti_cheat := jsonb_build_object(
    'durationOk',        v_duration_ok,
    'battleSeconds',     round(extract(epoch FROM (now() - b.started_at))),
    'fingerprintMatch',  (p_gear_fingerprint = '' OR v_server_fingerprint = p_gear_fingerprint),
    'clientFingerprint', p_gear_fingerprint,
    'serverFingerprint', v_server_fingerprint,
    'serverCmdStats',    v_server_cmd_stats,
    'goldSpent',         v_gold_spent,
    'goldCap',           v_gold_cap,
    'goldOk',            v_gold_ok,
    'shopPlacements',    coalesce(p_shop_placements, '[]'::jsonb)
  );

  IF p_won AND p_waves >= 10 AND p_lives > 0 AND v_duration_ok AND v_gold_ok
     AND (p_gear_fingerprint = '' OR v_server_fingerprint = p_gear_fingerprint) THEN
    v_first_clear     := NOT (b.stage_id = ANY(p.campaign_completed));
    v_reward          := public.idw_stage_reward(b.stage_id);
    v_xp_gained       := coalesce((v_reward->>'xp')::int, 0);
    v_resource_reward := v_reward - 'xp';
    UPDATE public.idw_player_state
       SET resources          = public.idw_apply_resource_delta(resources, v_resource_reward),
           player_xp          = player_xp + v_xp_gained,
           campaign_completed = (CASE WHEN b.stage_id = ANY(campaign_completed)
                                      THEN campaign_completed
                                      ELSE array_append(campaign_completed, b.stage_id) END),
           updated_at         = now()
     WHERE user_id = p.user_id;
    UPDATE public.idw_battle_attempts
       SET result       = 'victory',
           reward       = v_reward,
           finished_at  = now(),
           client_report = jsonb_build_object('waves', p_waves, 'lives', p_lives,
                             'clientGold', p_client_gold, 'antiCheat', v_anti_cheat)
     WHERE id = p_battle_id;
  ELSE
    UPDATE public.idw_battle_attempts
       SET result       = 'defeat',
           finished_at  = now(),
           client_report = jsonb_build_object('waves', p_waves, 'lives', p_lives,
                             'clientGold', p_client_gold, 'antiCheat', v_anti_cheat)
     WHERE id = p_battle_id;
  END IF;

  RETURN jsonb_build_object(
    'reward',      v_reward,
    'xp_gained',   v_xp_gained,
    'first_clear', v_first_clear,
    'state',       public.idw_get_state()
  );
END $$;
GRANT EXECUTE ON FUNCTION public.idw_submit_battle_result(uuid,boolean,int,int,int,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.idw_save_state(jsonb)             TO authenticated;

-- ── idw_sync_power_level ──────────────────────────────────────────────────────
-- Replaces the old syncPowerLevel() direct table write in game.js.
-- The client computes breakdown components; the server caps each at 50 000
-- to prevent trivial inflation, then recomputes the weighted total using the
-- same formula as calculatePowerLevel() in game.js.
-- Weights: accountLevel×1 + resources×0.5 + armory×2 + nodeUpgrades×1.5
--        + siloUpgrades×1 + research×3 + campaignProgress×2
--        + permanentBuffs×1 + commanderGear×1
CREATE OR REPLACE FUNCTION public.idw_sync_power_level(
  p_account_level     integer DEFAULT 0,
  p_resources         integer DEFAULT 0,
  p_armory            integer DEFAULT 0,
  p_node_upgrades     integer DEFAULT 0,
  p_silo_upgrades     integer DEFAULT 0,
  p_research          integer DEFAULT 0,
  p_campaign_progress integer DEFAULT 0,
  p_permanent_buffs   integer DEFAULT 0,
  p_commander_gear    integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u     uuid    := auth.uid();
  cap   CONSTANT integer := 50000;  -- per-component ceiling (generous but blocks trivial cheats)
  al    integer; res integer; arm integer; nu integer; su  integer;
  rsch  integer; cp  integer; pb  integer; cg integer;
  total integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Clamp every component to [0, cap]
  al   := LEAST(GREATEST(p_account_level,     0), cap);
  res  := LEAST(GREATEST(p_resources,          0), cap);
  arm  := LEAST(GREATEST(p_armory,             0), cap);
  nu   := LEAST(GREATEST(p_node_upgrades,      0), cap);
  su   := LEAST(GREATEST(p_silo_upgrades,      0), cap);
  rsch := LEAST(GREATEST(p_research,           0), cap);
  cp   := LEAST(GREATEST(p_campaign_progress,  0), cap);
  pb   := LEAST(GREATEST(p_permanent_buffs,    0), cap);
  cg   := LEAST(GREATEST(p_commander_gear,     0), cap);

  -- Mirrors calculatePowerLevel() in game.js (formula is client-side source of truth)
  total := ROUND(al*1.0 + res*0.5 + arm*2.0 + nu*1.5 + su*1.0 + rsch*3.0 + cp*2.0 + pb*1.0 + cg*1.0);

  UPDATE public.idw_player_state
     SET power_level          = total,
         pl_account_level     = al,
         pl_resources         = res,
         pl_armory            = arm,
         pl_node_upgrades     = nu,
         pl_silo_upgrades     = su,
         pl_research          = rsch,
         pl_campaign_progress = cp,
         pl_permanent_buffs   = pb,
         pl_commander_gear    = cg,
         updated_at           = now()
   WHERE user_id = u;
END $$;
GRANT EXECUTE ON FUNCTION public.idw_sync_power_level(integer,integer,integer,integer,integer,integer,integer,integer,integer) TO authenticated;
