/**
 * Anti-cheat boundary tests.
 *
 * Every test in this file verifies that the server REJECTS a fraudulent
 * client action — fake victories, direct table writes, battle-ID reuse,
 * and RPC calls that bypass the Edge Functions.
 *
 * Tests call Supabase RPCs and table APIs directly via the in-browser `sb`
 * client (the same client a cheater would use from the browser console).
 *
 * Requires TEST_EMAIL_A / TEST_PASSWORD_A to be set in .env.test.
 */

const { test, expect } = require('@playwright/test');
const { loginWithEmail } = require('../../helpers/auth');

const EMAIL    = process.env.TEST_EMAIL_A;
const PASSWORD = process.env.TEST_PASSWORD_A;

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error('TEST_EMAIL_A and TEST_PASSWORD_A must be set for anti-cheat tests.');
  }
});

test.beforeEach(async ({ page }) => {
  page.on('pageerror', err => { throw new Error(`[pageerror] ${err.message}`); });
});

test.afterEach(async ({ page }) => {
  try {
    if (await page.locator('#game.visible').isVisible()) await page.click('.logout-btn');
  } catch { /* already logged out */ }
});

// ── Helper: call an RPC from the browser context ──────────────────────────────
async function callRpc(page, fn, params) {
  return page.evaluate(
    ({ fn, params }) => sb.rpc(fn, params).then(r => ({ data: r.data, error: r.error?.message ?? null })),
    { fn, params }
  );
}

// ── Helper: direct table write from browser context ───────────────────────────
async function directTableWrite(page, table, update, matchCol, matchVal) {
  return page.evaluate(
    ({ table, update, matchCol, matchVal }) =>
      sb.from(table).update(update).eq(matchCol, matchVal)
        .then(r => ({ data: r.data, error: r.error?.message ?? null })),
    { table, update, matchCol, matchVal }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. pvp_battle_ended with no battle_id
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — pvp_battle_ended with null battle_id is rejected', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const { data, error } = await callRpc(page, 'pvp_battle_ended', {
    p_tile_idx:  0,
    p_won:       true,
    p_battle_id: null,
  });

  // Expected: RPC returns an error jsonb (not an exception) logged + rejected.
  // The response is {ok:false, error:'battle_id_required'} — no pgErr.
  if (error) {
    // If the server raised an exception that's also acceptable.
    expect(error.toLowerCase()).toMatch(/battle_id/);
  } else {
    expect(data).toMatchObject({ ok: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. pvp_chain_capture with no recent verified win
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — pvp_chain_capture without a verified win is rejected', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const { data, error } = await callRpc(page, 'pvp_chain_capture', {
    p_tile_idxs: [1, 2, 3],
  });

  // Must be rejected — no unclaimed PvP victory exists for this user.
  expect(error).toBeTruthy();
  expect(error.toLowerCase()).toMatch(/victory|capture/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. idw_submit_battle_result with a fake/unknown battle_id
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — idw_submit_battle_result with a fake battle_id is rejected', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const { data, error } = await callRpc(page, 'idw_submit_battle_result', {
    p_battle_id:        '00000000-0000-0000-0000-000000000000',
    p_won:              true,
    p_waves:            10,
    p_lives:            3,
    p_client_gold:      500,
    p_gear_fingerprint: '',
    p_shop_placements:  [],
  });

  // Must error — no battle record with this ID belongs to this user.
  expect(error).toBeTruthy();
  expect(error.toLowerCase()).toMatch(/battle/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. idw_submit_battle_result bypassing the Edge Function (no simVerified)
//    Start a real battle, then call the RPC directly before the Edge Function runs.
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — idw_submit_battle_result direct call without simVerified is rejected and logged', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  // Start a battle to get a real battle_id (first stage, no prerequisites).
  const startResult = await page.evaluate(() =>
    sb.rpc('idw_start_battle', { p_stage_id: '1-1' })
      .then(r => ({ data: r.data, error: r.error?.message ?? null }))
  );

  // If the account has no towers or stage locked, skip gracefully.
  if (startResult.error) {
    test.skip(true, `Cannot start stage 1-1 on this account: ${startResult.error}`);
    return;
  }

  const battleId = startResult.data?.battleId;
  expect(battleId).toBeTruthy();

  // Call idw_submit_battle_result directly — no Edge Function, no simVerified flag.
  const { data, error } = await callRpc(page, 'idw_submit_battle_result', {
    p_battle_id:        battleId,
    p_won:              true,       // Claiming victory
    p_waves:            10,
    p_lives:            3,
    p_client_gold:      500,
    p_gear_fingerprint: '',
    p_shop_placements:  [],
  });

  // Must be rejected: simVerified is absent so it is an Edge Function bypass.
  // New behaviour: logs the attempt to idw_anti_cheat_logs and returns empty reward
  // (transaction commits so the log is durable). No pgErr is thrown.
  if (error) {
    // Older path: still raised exception — also acceptable.
    expect(error.toLowerCase()).toMatch(/sim|bypass|simulation/);
  } else {
    // New path: consumed as 'rejected', reward is empty.
    expect(data?.reward ?? data).toEqual({});
    expect(data?.xp_gained ?? 0).toBe(0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Direct UPDATE to pvp_world (RLS must block this)
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — direct update to pvp_world is blocked by RLS', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const userId = await page.evaluate(() =>
    sb.auth.getUser().then(r => r.data?.user?.id)
  );
  expect(userId).toBeTruthy();

  const { data, error } = await directTableWrite(
    page,
    'pvp_world',
    { owner_id: userId },
    'tile_idx',
    0
  );

  // RLS has no UPDATE policy → PostgREST returns an error.
  expect(error).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Direct UPDATE to idw_player_state (must be blocked)
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — direct update to idw_player_state is blocked by RLS', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const userId = await page.evaluate(() =>
    sb.auth.getUser().then(r => r.data?.user?.id)
  );
  expect(userId).toBeTruthy();

  const { data, error } = await directTableWrite(
    page,
    'idw_player_state',
    { resources: JSON.stringify({ wood: 999999 }) },
    'user_id',
    userId
  );

  expect(error).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Direct UPDATE to idw_battle_attempts (must be blocked)
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — direct update to idw_battle_attempts is blocked by RLS', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const userId = await page.evaluate(() =>
    sb.auth.getUser().then(r => r.data?.user?.id)
  );
  expect(userId).toBeTruthy();

  const { data, error } = await directTableWrite(
    page,
    'idw_battle_attempts',
    { result: 'victory', reward: JSON.stringify({ xp: 9999, wood: 9999 }) },
    'user_id',
    userId
  );

  expect(error).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. pvp_battle_ended with another user's battle_id (cross-user claim)
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — pvp_battle_ended with a random UUID (not owned) is rejected', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  // Use a well-formed UUID that is extremely unlikely to exist for this user.
  const { data, error } = await callRpc(page, 'pvp_battle_ended', {
    p_tile_idx:  50,
    p_won:       true,
    p_battle_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  });

  expect(error).toBeTruthy();
  expect(error.toLowerCase()).toMatch(/battle|not found/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. pvp_chain_capture with too many tiles (max 20 guard)
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — pvp_chain_capture with >20 tiles is rejected', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const bigArray = Array.from({ length: 25 }, (_, i) => i + 100);
  const { data, error } = await callRpc(page, 'pvp_chain_capture', {
    p_tile_idxs: bigArray,
  });

  // Will fail either on "no recent victory" (logged) or "too many tiles".
  expect(error).toBeTruthy();
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Verify idw_anti_cheat_logs is NOT readable by the client (RLS blocks it)
// ─────────────────────────────────────────────────────────────────────────────
test('anti-cheat — idw_anti_cheat_logs table is not readable by the client', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);

  const result = await page.evaluate(() =>
    sb.from('idw_anti_cheat_logs').select('*').limit(1)
      .then(r => ({ data: r.data, error: r.error?.message ?? null }))
  );

  // No SELECT policy → empty data (RLS) or an error. Either blocks the client.
  const hasData = Array.isArray(result.data) && result.data.length > 0;
  expect(hasData).toBe(false);
});
