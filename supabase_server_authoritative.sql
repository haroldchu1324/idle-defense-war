
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
  when 'sniper' then '{"wood":250,"ore":120,"leather":60}'::jsonb
  else null end;
$$;
create or replace function public.idw_tower_unlock_level(tower_id text) returns integer language sql immutable as $$
select case tower_id when 'god_tower' then 0 when 'archer' then 0 when 'catapult' then 0 when 'crossbow' then 10 when 'ice_tower' then 10 when 'sniper' then 20 else 9999 end;
$$;

create or replace function public.idw_stage_reward(stage_id text) returns jsonb language sql immutable as $$
select case stage_id
  when '1-1' then '{"wood":50}'::jsonb
  when '1-2' then '{"wood":80,"fiber":30}'::jsonb
  when '1-3' then '{"stone":60}'::jsonb
  when '1-4' then '{"stone":70,"ore":40}'::jsonb
  when '1-5' then '{"ore":100,"leather":50}'::jsonb
  when '1-6' then '{"fiber":80,"leather":60}'::jsonb
  when '1-7' then '{"leather":150,"ore":50}'::jsonb
  when '1-8' then '{"stone":120,"ore":80}'::jsonb
  when '1-9' then '{"ore":200,"fiber":100}'::jsonb
  when '1-10' then '{"wood":500,"stone":500,"fiber":500,"leather":500,"ore":500}'::jsonb
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

create or replace function public.idw_node_stored_amount(ns jsonb, tier_idx int)
returns integer language plpgsql stable as $$
declare now_ms numeric := extract(epoch from now())*1000; last_ms numeric; lvl int; elapsed_hours numeric; amount numeric; cap numeric;
begin
  if not coalesce((ns->>'unlocked')::boolean,false) or coalesce((ns->>'upgrading')::boolean,false) then return 0; end if;
  last_ms := coalesce((ns->>'lastCollectAt')::numeric, now_ms);
  lvl := coalesce((ns->>'upgradeLevel')::int,1);
  elapsed_hours := greatest(0, least(now_ms-last_ms, 8*60*60*1000)) / 3600000.0;
  amount := coalesce((ns->>'storedAmount')::numeric,0) + public.idw_base_prod(tier_idx) * power(1.15,lvl-1) * elapsed_hours;
  cap := public.idw_storage_cap(tier_idx,lvl);
  return floor(least(amount, cap))::integer;
end $$;

create or replace function public.idw_state_to_v2(p public.idw_player_state)
returns jsonb language plpgsql stable as $$
declare n jsonb := p.nodes; res_id text; i int; ns jsonb; stored int;
begin
  foreach res_id in array array['wood','stone','fiber','leather','ore'] loop
    for i in 0..4 loop
      ns := n->res_id->i;
      stored := public.idw_node_stored_amount(ns, i);
      ns := jsonb_set(ns,'{storedAmount}',to_jsonb(stored),true);
      n := jsonb_set(n, array[res_id,i::text], ns, true);
    end loop;
  end loop;
  return jsonb_build_object('resources',p.resources,'playerXP',p.player_xp,'playerLevel',p.player_level,'nodes',n,'research',p.research,'armoryTowers',p.armory,'campCompleted',to_jsonb(p.campaign_completed),'lastSeen',extract(epoch from p.last_seen)*1000,'silo',p.silo);
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
declare p public.idw_player_state;
begin
  p := public.idw_ensure_player();
  p := public.idw_tick_upgrades(p);
  p := public.idw_tick_silo_upgrades(p);
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

create or replace function public.idw_collect_resource(p_res_id text, p_tier_idx int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; ns jsonb; amount int; n jsonb; now_ms numeric := extract(epoch from now())*1000;
begin
  if p_res_id not in ('wood','stone','fiber','leather','ore') or p_tier_idx not between 0 and 4 then raise exception 'Invalid node'; end if;
  p:=public.idw_tick_upgrades(public.idw_ensure_player());
  ns := p.nodes->p_res_id->p_tier_idx;
  amount := public.idw_node_stored_amount(ns,p_tier_idx);
  if amount <= 0 then return public.idw_get_state(); end if;
  ns := jsonb_set(ns,'{storedAmount}','0'::jsonb,true);
  ns := jsonb_set(ns,'{lastCollectAt}',to_jsonb(now_ms),true);
  n := jsonb_set(p.nodes, array[p_res_id,p_tier_idx::text], ns, true);
  update public.idw_player_state set resources=public.idw_apply_resource_delta(resources, jsonb_build_object(p_res_id,amount)), nodes=n, updated_at=now() where user_id=p.user_id returning * into p;
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
declare p public.idw_player_state; cost jsonb; slots int:=5; used int; entry jsonb;
begin
  p:=public.idw_ensure_player(); cost:=public.idw_tower_cost(p_tower_id);
  if cost is null then raise exception 'Unknown tower'; end if;
  if p.player_level < public.idw_tower_unlock_level(p_tower_id) then raise exception 'Need higher level'; end if;
  if not public.idw_can_pay(p.resources,cost) then raise exception 'Not enough resources'; end if;
  if coalesce((p.research->'comb4'->>'done')::boolean,false) then slots := slots + 2; end if;
  used := jsonb_array_length(p.armory); if used >= slots then raise exception 'No armory slots'; end if;
  entry := jsonb_build_object('towerId',p_tower_id,'level',1,'placedAt',extract(epoch from now())*1000);
  update public.idw_player_state set resources=public.idw_apply_resource_delta(resources, public.idw_negative(cost)), armory=armory||jsonb_build_array(entry), updated_at=now() where user_id=p.user_id;
  return public.idw_get_state();
end $$;

create or replace function public.idw_start_battle(p_stage_id text, p_armory_indexes int[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; idx int; towers jsonb:='[]'::jsonb; new_armory jsonb:='[]'::jsonb; i int; attempt_id uuid; can_play boolean; prev text;
begin
  p:=public.idw_ensure_player();
  if p_stage_id not in ('1-1','1-2','1-3','1-4','1-5','1-6','1-7','1-8','1-9','1-10') then raise exception 'Invalid stage'; end if;
  if p_stage_id <> '1-1' then
    prev := '1-' || ((split_part(p_stage_id,'-',2)::int)-1)::text;
    can_play := prev = any(p.campaign_completed);
    if not can_play then raise exception 'Previous stage not complete'; end if;
  end if;
  for i in 0..greatest(jsonb_array_length(p.armory)-1, -1) loop
    if i = any(p_armory_indexes) then towers := towers || jsonb_build_array(p.armory->i); else new_armory := new_armory || jsonb_build_array(p.armory->i); end if;
  end loop;
  update public.idw_player_state set armory=new_armory, updated_at=now() where user_id=p.user_id;
  insert into public.idw_battle_attempts(user_id,stage_id,consumed_towers) values(p.user_id,p_stage_id,towers) returning id into attempt_id;
  return jsonb_build_object('battleId',attempt_id,'seed',(select seed from public.idw_battle_attempts where id=attempt_id),'consumedTowers',towers,'state',(select public.idw_get_state()));
end $$;

create or replace function public.idw_submit_battle_result(p_battle_id uuid, p_won boolean, p_waves int, p_lives int, p_client_gold int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.idw_player_state; b public.idw_battle_attempts; reward jsonb:='{}'::jsonb; max_duration interval := interval '2 hours';
begin
  p:=public.idw_ensure_player();
  select * into b from public.idw_battle_attempts where id=p_battle_id and user_id=p.user_id for update;
  if b.id is null then raise exception 'Battle not found'; end if;
  if b.result <> 'started' then raise exception 'Battle already submitted'; end if;
  if now() - b.started_at > max_duration then raise exception 'Battle expired'; end if;
  if p_won and p_waves >= 10 and p_lives > 0 then
    reward := public.idw_stage_reward(b.stage_id);
    update public.idw_player_state set resources=public.idw_apply_resource_delta(resources,reward), campaign_completed=(case when b.stage_id=any(campaign_completed) then campaign_completed else array_append(campaign_completed,b.stage_id) end), updated_at=now() where user_id=p.user_id;
    update public.idw_battle_attempts set result='victory', reward=reward, finished_at=now(), client_report=jsonb_build_object('waves',p_waves,'lives',p_lives,'clientGold',p_client_gold) where id=p_battle_id;
  else
    update public.idw_battle_attempts set result='defeat', finished_at=now(), client_report=jsonb_build_object('waves',p_waves,'lives',p_lives,'clientGold',p_client_gold) where id=p_battle_id;
  end if;
  return jsonb_build_object('reward',reward,'state',public.idw_get_state());
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
grant execute on function public.idw_submit_battle_result(uuid,boolean,int,int,int) to authenticated;

-- ── PVP world map ──────────────────────────────────────────────────────────

-- Add level column to pvp_world (safe to run multiple times)
alter table public.pvp_world add column if not exists level integer not null default 1;

-- Recreate pvp_get_tiles to expose level
drop function if exists public.pvp_get_tiles();
create or replace function public.pvp_get_tiles()
returns table(tile_idx integer, owner_id uuid, color text, attacking_until timestamptz, level integer, is_mine boolean)
language sql security definer set search_path=public as $$
  select w.tile_idx, w.owner_id, null::text as color, w.attacking_until, w.level,
    (w.owner_id = auth.uid()) as is_mine
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
