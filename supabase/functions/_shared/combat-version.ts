// ─────────────────────────────────────────────────────────────────────────────
// COMBAT VERSIONING
// Bump the relevant version whenever you change the corresponding data.
//
//  COMBAT_CONFIG_VERSION — tower/enemy base stats, ascension multipliers,
//                          gear item stats, territory milestones, shop costs
//  BALANCE_VERSION       — numeric tuning (damage values, HP, speed, rewards)
//                          without structural changes
//  SIMULATION_VERSION    — changes to the tick loop, targeting, hit detection,
//                          or any simulation mechanic
//
// On battle start: record { configV, balanceV, simV } in idw_battle_attempts.
// On battle resolve: reject if any version mismatches the current constants.
// ─────────────────────────────────────────────────────────────────────────────

export const COMBAT_CONFIG_VERSION   = 1;
export const BALANCE_VERSION         = 1;
export const SIMULATION_VERSION      = 1;

export const FULL_VERSION = `${COMBAT_CONFIG_VERSION}.${BALANCE_VERSION}.${SIMULATION_VERSION}`;

export interface CombatVersionSnapshot {
  configV:    number;
  balanceV:   number;
  simV:       number;
}

export function currentVersionSnapshot(): CombatVersionSnapshot {
  return { configV: COMBAT_CONFIG_VERSION, balanceV: BALANCE_VERSION, simV: SIMULATION_VERSION };
}

/** Returns true if the snapshot matches the currently deployed versions. */
export function versionsMatch(snap: CombatVersionSnapshot): boolean {
  return snap.configV === COMBAT_CONFIG_VERSION
      && snap.balanceV === BALANCE_VERSION
      && snap.simV     === SIMULATION_VERSION;
}
